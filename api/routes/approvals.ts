import { Router, type Request, type Response } from 'express';
import type { Approval, ApprovalStep } from '../../shared/types';
import { alertEngine } from './alerts';
import { dataCleaner } from '../data-cleaning';

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'timeout_escalated';
type ApprovalType = 'restock_adjust' | 'replace_locker' | 'add_locker' | 'transfer_locker';

interface ApprovalInternal extends Omit<Approval, 'status'> {
  status: ApprovalStatus;
  type: ApprovalType;
  createdFromAlert?: string;
  autoEscalated: boolean;
  escalationTime?: string;
  stepDeadlines: Record<number, string>;
}

const STEP_TIMEOUT = 2 * 3600000;

class ApprovalStateMachine {
  private approvals: Map<string, ApprovalInternal> = new Map();
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
      const pendingAlerts = alertEngine.getAlerts({ status: 'escalated', level: 2 });
      pendingAlerts.list.forEach(alert => {
        const existingApproval = this.findByAlertId(alert.id);
        if (!existingApproval) {
          this.createFromAlert(alert.id, alert.lockerId, alert.lockerName, alert.type);
        }
      });
    }, 60000);
  }

  private findByAlertId(alertId: string): ApprovalInternal | undefined {
    return Array.from(this.approvals.values()).find(a => a.createdFromAlert === alertId);
  }

  createFromAlert(alertId: string, lockerId: string, lockerName: string, alertType: string): ApprovalInternal {
    const now = new Date();
    const isRestock = alertType === 'low_usage';
    
    const steps: ApprovalStep[] = [
      { step: 1, role: 'branch', roleName: '网点运维员' },
      { step: 2, role: 'region', roleName: '区域运营经理' },
      { step: 3, role: 'director', roleName: '总部设备总监' },
    ];

    const approval: ApprovalInternal = {
      id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      alertId,
      lockerName,
      type: isRestock ? 'restock_adjust' : 'replace_locker',
      typeName: isRestock ? '调整补货频次' : '更换柜体',
      currentStep: 1,
      status: 'pending',
      steps,
      createdAt: now.toISOString(),
      description: isRestock
        ? `该柜机连续3小时使用率低于10%，建议调整补货频次或转移柜机`
        : `该柜机故障超过2小时未修复，建议更换柜体或升级维修`,
      createdFromAlert: alertId,
      autoEscalated: false,
      stepDeadlines: {
        1: new Date(now.getTime() + STEP_TIMEOUT).toISOString(),
        2: new Date(now.getTime() + STEP_TIMEOUT * 2).toISOString(),
        3: new Date(now.getTime() + STEP_TIMEOUT * 3).toISOString(),
      },
    };

    this.approvals.set(approval.id, approval);
    console.log(`[ApprovalEngine] 自动创建审批: ${lockerName}, 类型: ${approval.typeName}`);
    return approval;
  }

  createManual(
    lockerName: string,
    type: ApprovalType,
    typeName: string,
    description: string
  ): ApprovalInternal {
    const now = new Date();

    const steps: ApprovalStep[] = [
      { step: 1, role: 'branch', roleName: '网点运维员' },
      { step: 2, role: 'region', roleName: '区域运营经理' },
      { step: 3, role: 'director', roleName: '总部设备总监' },
    ];

    const approval: ApprovalInternal = {
      id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      alertId: '',
      lockerName,
      type,
      typeName,
      currentStep: 1,
      status: 'pending',
      steps,
      createdAt: now.toISOString(),
      description,
      autoEscalated: false,
      stepDeadlines: {
        1: new Date(now.getTime() + STEP_TIMEOUT).toISOString(),
        2: new Date(now.getTime() + STEP_TIMEOUT * 2).toISOString(),
        3: new Date(now.getTime() + STEP_TIMEOUT * 3).toISOString(),
      },
    };

    this.approvals.set(approval.id, approval);
    console.log(`[ApprovalEngine] 手动创建审批: ${lockerName}, 类型: ${typeName}`);
    return approval;
  }

  approve(
    approvalId: string,
    step: number,
    approver: string,
    opinion: string
  ): ApprovalInternal | null {
    const approval = this.approvals.get(approvalId);
    if (!approval) return null;
    if (approval.currentStep !== step) return null;
    if (approval.status !== 'pending') return null;

    const stepIndex = approval.steps.findIndex(s => s.step === step);
    if (stepIndex === -1) return null;

    approval.steps[stepIndex] = {
      ...approval.steps[stepIndex],
      approver,
      opinion,
      approved: true,
      approvedAt: new Date().toISOString(),
    };

    if (step < 3) {
      approval.currentStep = (step + 1) as 1 | 2 | 3;
      approval.status = 'processing';
    } else {
      approval.status = 'approved';
      this.executeApproval(approval);
    }

    console.log(`[ApprovalEngine] 审批通过: ${approval.lockerName}, 步骤: ${step}`);
    return approval;
  }

  reject(
    approvalId: string,
    step: number,
    approver: string,
    opinion: string
  ): ApprovalInternal | null {
    const approval = this.approvals.get(approvalId);
    if (!approval) return null;
    if (approval.currentStep !== step) return null;

    const stepIndex = approval.steps.findIndex(s => s.step === step);
    if (stepIndex === -1) return null;

    approval.steps[stepIndex] = {
      ...approval.steps[stepIndex],
      approver,
      opinion,
      approved: false,
      approvedAt: new Date().toISOString(),
    };

    approval.status = 'rejected';
    console.log(`[ApprovalEngine] 审批驳回: ${approval.lockerName}, 步骤: ${step}`);
    return approval;
  }

  private checkTimeouts() {
    const now = new Date().getTime();

    this.approvals.forEach(approval => {
      if (approval.status !== 'pending' && approval.status !== 'processing') return;

      const currentStepDeadline = new Date(approval.stepDeadlines[approval.currentStep]).getTime();
      
      if (now > currentStepDeadline && !approval.autoEscalated) {
        if (approval.currentStep < 3) {
          approval.currentStep = (approval.currentStep + 1) as 1 | 2 | 3;
          approval.autoEscalated = true;
          approval.escalationTime = new Date().toISOString();
          console.log(`[ApprovalEngine] 审批超时自动升级: ${approval.lockerName}, 升级到步骤 ${approval.currentStep}`);
        }
      }
    });
  }

  private executeApproval(approval: ApprovalInternal) {
    console.log(`[ApprovalEngine] 执行审批决策: ${approval.lockerName}, 方案: ${approval.typeName}`);
    
    if (approval.createdFromAlert) {
      alertEngine.handleAlert(approval.createdFromAlert, 'resolve', '系统自动处理');
    }
  }

  getPending(): ApprovalInternal[] {
    return Array.from(this.approvals.values())
      .filter(a => a.status === 'pending' || a.status === 'processing')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getHistory(): ApprovalInternal[] {
    return Array.from(this.approvals.values())
      .filter(a => a.status === 'approved' || a.status === 'rejected')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getAll(): ApprovalInternal[] {
    return Array.from(this.approvals.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getById(approvalId: string): ApprovalInternal | undefined {
    return this.approvals.get(approvalId);
  }

  getStats() {
    const all = Array.from(this.approvals.values());
    return {
      pending: all.filter(a => a.status === 'pending' || a.status === 'processing').length,
      approved: all.filter(a => a.status === 'approved').length,
      rejected: all.filter(a => a.status === 'rejected').length,
      autoEscalated: all.filter(a => a.autoEscalated).length,
      total: all.length,
    };
  }
}

export const approvalEngine = new ApprovalStateMachine();

const router = Router();

router.get('/pending', (req: Request, res: Response): void => {
  res.json({
    success: true,
    data: approvalEngine.getPending(),
  });
});

router.get('/history', (req: Request, res: Response): void => {
  res.json({
    success: true,
    data: approvalEngine.getHistory(),
  });
});

router.get('/', (req: Request, res: Response): void => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const status = req.query.status as string;

  let list = approvalEngine.getAll();
  
  if (status && status !== 'all') {
    if (status === 'pending') {
      list = list.filter(a => a.status === 'pending' || a.status === 'processing');
    } else {
      list = list.filter(a => a.status === status);
    }
  }

  const start = (page - 1) * pageSize;
  const paginatedList = list.slice(start, start + pageSize);

  res.json({
    success: true,
    data: {
      list: paginatedList,
      total: list.length,
      page,
      pageSize,
    },
  });
});

router.get('/stats', (req: Request, res: Response): void => {
  res.json({
    success: true,
    data: approvalEngine.getStats(),
  });
});

router.get('/:id', (req: Request, res: Response): void => {
  const approval = approvalEngine.getById(req.params.id);
  
  if (!approval) {
    res.status(404).json({
      success: false,
      error: '审批不存在',
    });
    return;
  }

  res.json({
    success: true,
    data: approval,
  });
});

router.post('/:id/approve', (req: Request, res: Response): void => {
  const { opinion, step } = req.body;
  const approver = req.headers['x-user-name'] as string || '系统管理员';

  const result = approvalEngine.approve(req.params.id, step, approver, opinion || '');

  if (!result) {
    res.status(400).json({
      success: false,
      error: '审批操作失败，请检查审批状态',
    });
    return;
  }

  res.json({
    success: true,
    data: result,
  });
});

router.post('/:id/reject', (req: Request, res: Response): void => {
  const { opinion, step } = req.body;
  const approver = req.headers['x-user-name'] as string || '系统管理员';

  const result = approvalEngine.reject(req.params.id, step, approver, opinion || '');

  if (!result) {
    res.status(400).json({
      success: false,
      error: '审批操作失败，请检查审批状态',
    });
    return;
  }

  res.json({
    success: true,
    data: result,
  });
});

router.post('/', (req: Request, res: Response): void => {
  const { lockerName, type, typeName, description } = req.body;

  if (!lockerName || !type) {
    res.status(400).json({
      success: false,
      error: '请提供柜机名称和审批类型',
    });
    return;
  }

  const approval = approvalEngine.createManual(
    lockerName,
    type as ApprovalType,
    typeName || type,
    description || ''
  );

  res.json({
    success: true,
    data: approval,
  });
});

router.get('/engine/status', (req: Request, res: Response): void => {
  res.json({
    success: true,
    data: {
      stats: approvalEngine.getStats(),
      dataCollection: dataCleaner.getStats(),
    },
  });
});

export default router;
