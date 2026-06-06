import { Router, type Request, type Response } from 'express';
import { db } from '../database/index.js';
import { alertEngine } from './alerts.js';

const STEP_TIMEOUT = 2 * 3600000;

class ApprovalEngine {
  private checkInterval: NodeJS.Timeout | null = null;

  start() {
    if (this.checkInterval) return;
    console.log('[ApprovalEngine] 启动审批状态机...');
    this.checkTimeouts();
    this.checkInterval = setInterval(() => this.checkTimeouts(), 300000);
    this.listenForAlerts();
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('[ApprovalEngine] 停止审批状态机');
  }

  private listenForAlerts() {
    setInterval(() => {
      const escalated = db.prepare("SELECT * FROM alerts WHERE level = 2 AND status = 'escalated'").all() as any[];
      
      escalated.forEach(alert => {
        const existing = db.prepare('SELECT id FROM approvals WHERE created_from_alert = ?').get(alert.id) as any;
        if (!existing) {
          this.createFromAlert(alert);
        }
      });
    }, 60000);
  }

  createFromAlert(alert: any) {
    const now = new Date();
    const isRestock = alert.type === 'low_usage';
    const typeName = isRestock ? '调整补货频次' : '更换柜体';

    const approval = {
      id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      alert_id: alert.id,
      locker_name: alert.locker_name,
      type: isRestock ? 'restock_adjust' : 'replace_locker',
      type_name: typeName,
      current_step: 1,
      status: 'pending',
      description: isRestock
        ? `该柜机连续3小时使用率低于10%，建议调整补货频次或转移柜机`
        : `该柜机故障超过2小时未修复，建议更换柜体或升级维修`,
      created_from_alert: alert.id,
      auto_escalated: 0,
      created_at: now.toISOString(),
      step1_deadline: new Date(now.getTime() + STEP_TIMEOUT).toISOString(),
      step2_deadline: new Date(now.getTime() + STEP_TIMEOUT * 2).toISOString(),
      step3_deadline: new Date(now.getTime() + STEP_TIMEOUT * 3).toISOString(),
    };

    db.prepare(`
      INSERT INTO approvals (
        id, alert_id, locker_name, type, type_name, current_step, status,
        description, created_from_alert, auto_escalated, created_at,
        step1_deadline, step2_deadline, step3_deadline
      ) VALUES (
        @id, @alert_id, @locker_name, @type, @type_name, @current_step, @status,
        @description, @created_from_alert, @auto_escalated, @created_at,
        @step1_deadline, @step2_deadline, @step3_deadline
      )
    `).run(approval);

    console.log(`[ApprovalEngine] 自动创建审批: ${alert.locker_name}, 类型: ${typeName}`);
    return approval;
  }

  approve(approvalId: string, step: number, approver: string, opinion: string): any {
    const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId) as any;
    if (!approval) return null;
    if (approval.current_step !== step) return null;
    if (approval.status !== 'pending' && approval.status !== 'processing') return null;

    const now = new Date().toISOString();
    const stepField = `step${step}_`;

    const update: any = {};
    update[`${stepField}approver`] = approver;
    update[`${stepField}opinion`] = opinion;
    update[`${stepField}approved`] = 1;
    update[`${stepField}approved_at`] = now;

    if (step < 3) {
      update.current_step = step + 1;
      update.status = 'processing';
    } else {
      update.status = 'approved';
      this.executeApproval(approval);
    }

    const fields = Object.keys(update).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE approvals SET ${fields} WHERE id = @id`).run({ ...update, id: approvalId });

    console.log(`[ApprovalEngine] 审批通过: ${approval.locker_name}, 步骤: ${step}`);
    return db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId);
  }

  reject(approvalId: string, step: number, approver: string, opinion: string): any {
    const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId) as any;
    if (!approval) return null;
    if (approval.current_step !== step) return null;

    const now = new Date().toISOString();
    const stepField = `step${step}_`;

    db.prepare(`
      UPDATE approvals 
      SET status = 'rejected',
          ${stepField}approver = ?,
          ${stepField}opinion = ?,
          ${stepField}approved = 0,
          ${stepField}approved_at = ?
      WHERE id = ?
    `).run(approver, opinion, now, approvalId);

    console.log(`[ApprovalEngine] 审批驳回: ${approval.locker_name}, 步骤: ${step}`);
    return db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId);
  }

  private checkTimeouts() {
    const now = Date.now();

    const pending = db.prepare("SELECT * FROM approvals WHERE status IN ('pending', 'processing')").all() as any[];

    pending.forEach(approval => {
      const deadlineField = `step${approval.current_step}_deadline`;
      const deadline = new Date(approval[deadlineField]).getTime();

      if (now > deadline && approval.auto_escalated === 0) {
        if (approval.current_step < 3) {
          db.prepare(`
            UPDATE approvals 
            SET current_step = current_step + 1, auto_escalated = 1, escalation_time = ?
            WHERE id = ?
          `).run(new Date().toISOString(), approval.id);
          
          console.log(`[ApprovalEngine] 审批超时自动升级: ${approval.locker_name}, 升级到步骤 ${approval.current_step + 1}`);
        }
      }
    });
  }

  private executeApproval(approval: any) {
    console.log(`[ApprovalEngine] 执行审批决策: ${approval.locker_name}, 方案: ${approval.type_name}`);
    
    if (approval.created_from_alert) {
      alertEngine.handleAlert(approval.created_from_alert, 'resolve', '系统自动处理');
    }
  }

  getPending(): any[] {
    return db.prepare(`
      SELECT * FROM approvals 
      WHERE status IN ('pending', 'processing')
      ORDER BY created_at DESC
    `).all().map(a => this.mapApproval(a));
  }

  getHistory(): any[] {
    return db.prepare(`
      SELECT * FROM approvals 
      WHERE status IN ('approved', 'rejected')
      ORDER BY created_at DESC
    `).all().map(a => this.mapApproval(a));
  }

  getAll(page: number = 1, pageSize: number = 20, status?: string) {
    let query = 'SELECT * FROM approvals WHERE 1=1';
    const params: any[] = [];

    if (status && status !== 'all') {
      if (status === 'pending') {
        query += " AND status IN ('pending', 'processing')";
      } else {
        query += ' AND status = ?';
        params.push(status);
      }
    }

    query += ' ORDER BY created_at DESC';

    const all = db.prepare(query).all(...params) as any[];
    const start = (page - 1) * pageSize;
    const list = all.slice(start, start + pageSize).map(a => this.mapApproval(a));

    return { list, total: all.length, page, pageSize };
  }

  private mapApproval(a: any): any {
    const steps = [1, 2, 3].map(step => ({
      step,
      role: step === 1 ? 'branch' : step === 2 ? 'region' : 'director',
      roleName: step === 1 ? '网点运维员' : step === 2 ? '区域运营经理' : '总部设备总监',
      approver: a[`step${step}_approver`],
      opinion: a[`step${step}_opinion`],
      approved: a[`step${step}_approved`] === 1,
      approvedAt: a[`step${step}_approved_at`],
    }));

    return {
      id: a.id,
      alertId: a.alert_id,
      lockerName: a.locker_name,
      type: a.type,
      typeName: a.type_name,
      currentStep: a.current_step,
      status: a.status,
      steps,
      createdAt: a.created_at,
      description: a.description,
      autoEscalated: a.auto_escalated === 1,
      escalationTime: a.escalation_time,
    };
  }

  getById(id: string): any | null {
    const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as any;
    return approval ? this.mapApproval(approval) : null;
  }

  getStats() {
    const pending = db.prepare("SELECT COUNT(*) as count FROM approvals WHERE status IN ('pending', 'processing')").get() as any;
    const approved = db.prepare("SELECT COUNT(*) as count FROM approvals WHERE status = 'approved'").get() as any;
    const rejected = db.prepare("SELECT COUNT(*) as count FROM approvals WHERE status = 'rejected'").get() as any;
    const autoEscalated = db.prepare("SELECT COUNT(*) as count FROM approvals WHERE auto_escalated = 1").get() as any;
    const total = db.prepare("SELECT COUNT(*) as count FROM approvals").get() as any;

    return {
      pending: pending.count,
      approved: approved.count,
      rejected: rejected.count,
      autoEscalated: autoEscalated.count,
      total: total.count,
    };
  }
}

export const approvalEngine = new ApprovalEngine();

const router = Router();

router.get('/pending', (req: Request, res: Response): void => {
  res.json({ success: true, data: approvalEngine.getPending() });
});

router.get('/history', (req: Request, res: Response): void => {
  res.json({ success: true, data: approvalEngine.getHistory() });
});

router.get('/', (req: Request, res: Response): void => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const status = req.query.status as string;
  res.json({ success: true, data: approvalEngine.getAll(page, pageSize, status) });
});

router.get('/stats', (req: Request, res: Response): void => {
  res.json({ success: true, data: approvalEngine.getStats() });
});

router.get('/:id', (req: Request, res: Response): void => {
  const approval = approvalEngine.getById(req.params.id);
  if (!approval) {
    res.status(404).json({ success: false, error: '审批不存在' });
    return;
  }
  res.json({ success: true, data: approval });
});

router.post('/:id/approve', (req: Request, res: Response): void => {
  const { opinion, step } = req.body;
  const approver = req.headers['x-user-name'] as string || '系统管理员';
  const result = approvalEngine.approve(req.params.id, step, approver, opinion || '');
  if (!result) {
    res.status(400).json({ success: false, error: '审批操作失败' });
    return;
  }
  res.json({ success: true, data: result });
});

router.post('/:id/reject', (req: Request, res: Response): void => {
  const { opinion, step } = req.body;
  const approver = req.headers['x-user-name'] as string || '系统管理员';
  const result = approvalEngine.reject(req.params.id, step, approver, opinion || '');
  if (!result) {
    res.status(400).json({ success: false, error: '审批操作失败' });
    return;
  }
  res.json({ success: true, data: result });
});

router.post('/', (req: Request, res: Response): void => {
  const { lockerName, type, typeName, description } = req.body;
  if (!lockerName || !type) {
    res.status(400).json({ success: false, error: '请提供柜机名称和审批类型' });
    return;
  }

  const now = new Date();
  const approval = {
    id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    alert_id: '',
    locker_name: lockerName,
    type,
    type_name: typeName || type,
    current_step: 1,
    status: 'pending',
    description: description || '',
    created_from_alert: '',
    auto_escalated: 0,
    created_at: now.toISOString(),
    step1_deadline: new Date(now.getTime() + STEP_TIMEOUT).toISOString(),
    step2_deadline: new Date(now.getTime() + STEP_TIMEOUT * 2).toISOString(),
    step3_deadline: new Date(now.getTime() + STEP_TIMEOUT * 3).toISOString(),
  };

  db.prepare(`
    INSERT INTO approvals (
      id, alert_id, locker_name, type, type_name, current_step, status,
      description, created_from_alert, auto_escalated, created_at,
      step1_deadline, step2_deadline, step3_deadline
    ) VALUES (
      @id, @alert_id, @locker_name, @type, @type_name, @current_step, @status,
      @description, @created_from_alert, @auto_escalated, @created_at,
      @step1_deadline, @step2_deadline, @step3_deadline
    )
  `).run(approval);

  res.json({ success: true, data: approvalEngine.getById(approval.id) });
});

export default router;
