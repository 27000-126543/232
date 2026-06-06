import { Router, type Request, type Response } from 'express';
import { dataCleaner } from '../data-cleaning.js';
import { db } from '../database/index.js';
import type { Alert } from '../../shared/types.js';

const LOW_USAGE_THRESHOLD = 10;
const LOW_USAGE_DURATION = 3 * 3600000;
const FAULT_TIMEOUT = 2 * 3600000;
const ESCALATION_TIMEOUT = 4 * 3600000;

class AlertEngine {
  private checkInterval: NodeJS.Timeout | null = null;

  start() {
    if (this.checkInterval) return;
    console.log('[AlertEngine] 启动预警检查服务...');
    this.checkAllLockers();
    this.checkInterval = setInterval(() => this.checkAllLockers(), 60000);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('[AlertEngine] 停止预警检查服务');
  }

  private checkAllLockers() {
    const now = new Date();
    const lockers = db.prepare('SELECT * FROM lockers').all() as any[];

    lockers.forEach(locker => {
      const avgUsage = dataCleaner.getLockerUsageRate(locker.id, 3);
      if (avgUsage < LOW_USAGE_THRESHOLD && avgUsage > 0) {
        this.checkLowUsageAlert(locker, avgUsage, now);
      }

      const activeFaults = dataCleaner.getActiveFaults(locker.id);
      activeFaults.forEach(fault => {
        const faultDuration = now.getTime() - new Date(fault.startTime).getTime();
        if (faultDuration > FAULT_TIMEOUT) {
          this.checkFaultAlert(locker, fault, now);
        }
      });
    });

    this.checkEscalation(now);
  }

  private checkLowUsageAlert(locker: any, avgUsage: number, now: Date) {
    const alertId = `low_usage_${locker.id}`;
    const existing = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId) as any;

    if (!existing) {
      db.prepare(`
        INSERT INTO alerts (
          id, locker_id, locker_name, region, level, type, message,
          status, created_at, last_checked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        alertId,
        locker.id,
        locker.name,
        locker.region,
        1,
        'low_usage',
        `该柜机连续3小时使用率低于10%，当前平均使用率：${avgUsage.toFixed(1)}%`,
        'pending',
        now.toISOString(),
        now.toISOString()
      );
      console.log(`[AlertEngine] 生成低使用率预警: ${locker.name}, 使用率: ${avgUsage.toFixed(1)}%`);
    } else {
      db.prepare(`
        UPDATE alerts 
        SET message = ?, last_checked_at = ?
        WHERE id = ?
      `).run(
        `该柜机连续3小时使用率低于10%，当前平均使用率：${avgUsage.toFixed(1)}%`,
        now.toISOString(),
        alertId
      );
    }
  }

  private checkFaultAlert(locker: any, fault: any, now: Date) {
    const alertId = `fault_${locker.id}_${fault.id}`;
    const existing = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId) as any;

    const duration = Math.floor((now.getTime() - new Date(fault.startTime).getTime()) / 60000);

    if (!existing) {
      db.prepare(`
        INSERT INTO alerts (
          id, locker_id, locker_name, region, level, type, message,
          status, created_at, last_checked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        alertId,
        locker.id,
        locker.name,
        locker.region,
        1,
        'fault_timeout',
        `故障类型: ${fault.faultType} (${fault.errorCode})，已持续${duration}分钟未修复`,
        'pending',
        now.toISOString(),
        now.toISOString()
      );
      console.log(`[AlertEngine] 生成故障超时预警: ${locker.name}, 故障: ${fault.faultType}`);
    } else {
      db.prepare(`
        UPDATE alerts 
        SET message = ?, last_checked_at = ?
        WHERE id = ?
      `).run(
        `故障类型: ${fault.faultType} (${fault.errorCode})，已持续${duration}分钟未修复`,
        now.toISOString(),
        alertId
      );
    }
  }

  private checkEscalation(now: Date) {
    const pendingAlerts = db.prepare(`
      SELECT * FROM alerts 
      WHERE level = 1 AND status IN ('pending', 'processing')
    `).all() as any[];

    pendingAlerts.forEach(alert => {
      const age = now.getTime() - new Date(alert.created_at).getTime();
      if (age > ESCALATION_TIMEOUT) {
        db.prepare(`
          UPDATE alerts 
          SET level = 2, status = 'escalated', escalated_at = ?
          WHERE id = ? AND level = 1
        `).run(now.toISOString(), alert.id);
        console.log(`[AlertEngine] 预警升级为二级: ${alert.locker_name}, 类型: ${alert.type}`);
      }
    });
  }

  handleAlert(alertId: string, action: string, handledBy: string): any {
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId) as any;
    if (!alert) return null;

    const now = new Date().toISOString();

    if (action === 'resolve') {
      db.prepare(`
        UPDATE alerts 
        SET status = 'resolved', handled_at = ?, handled_by = ?
        WHERE id = ?
      `).run(now, handledBy, alertId);

      if (alert.type === 'fault_timeout') {
        const parts = alert.id.split('_');
        const faultId = parts.slice(2).join('_');
        dataCleaner.resolveFault(alert.locker_id, faultId);
      }
    } else if (action === 'process') {
      db.prepare(`
        UPDATE alerts 
        SET status = 'processing', handled_at = ?, handled_by = ?
        WHERE id = ?
      `).run(now, handledBy, alertId);
    }

    return db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId);
  }

  escalateAlert(alertId: string): any {
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId) as any;
    if (!alert) return null;

    db.prepare(`
      UPDATE alerts 
      SET level = 2, status = 'escalated', escalated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), alertId);

    return db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId);
  }

  getAlerts(filters?: { level?: number; status?: string; region?: string; page?: number; pageSize?: number }) {
    let query = 'SELECT * FROM alerts WHERE 1=1';
    const params: any[] = [];

    if (filters?.level) {
      query += ' AND level = ?';
      params.push(filters.level);
    }
    if (filters?.status) {
      if (filters.status === 'pending') {
        query += ' AND status IN (?, ?)';
        params.push('pending', 'processing');
      } else {
        query += ' AND status = ?';
        params.push(filters.status);
      }
    }
    if (filters?.region) {
      query += ' AND region = ?';
      params.push(filters.region);
    }

    query += ' ORDER BY created_at DESC';

    const all = db.prepare(query).all(...params) as any[];

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 20;
    const start = (page - 1) * pageSize;
    const paginatedList = all.slice(start, start + pageSize);

    const list = paginatedList.map(a => ({
      id: a.id,
      lockerId: a.locker_id,
      lockerName: a.locker_name,
      region: a.region,
      level: a.level,
      type: a.type,
      message: a.message,
      createdAt: a.created_at,
      status: a.status,
      handledAt: a.handled_at,
      handledBy: a.handled_by,
    }));

    return {
      list,
      total: all.length,
      page,
      pageSize,
    };
  }

  getStats() {
    const level1 = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE level = 1 AND status != 'resolved'").get() as any;
    const level2 = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE level = 2 AND status != 'resolved'").get() as any;
    const handled = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'resolved'").get() as any;
    const pending = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status IN ('pending', 'processing')").get() as any;

    return {
      level1: level1.count,
      level2: level2.count,
      handled: handled.count,
      pending: pending.count,
    };
  }
}

export const alertEngine = new AlertEngine();

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const level = req.query.level ? parseInt(req.query.level as string) : undefined;
  const status = req.query.status as string;
  const region = req.query.region as string;

  const result = alertEngine.getAlerts({ level, status, region, page, pageSize });

  res.json({
    success: true,
    data: result,
  });
});

router.get('/stats', (req: Request, res: Response): void => {
  res.json({
    success: true,
    data: alertEngine.getStats(),
  });
});

router.post('/:id/handle', (req: Request, res: Response): void => {
  const { action, remark } = req.body;
  const alertId = req.params.id;
  const handledBy = req.headers['x-user-name'] as string || '系统管理员';

  const result = alertEngine.handleAlert(alertId, action, handledBy);

  if (!result) {
    res.status(404).json({
      success: false,
      error: '预警不存在',
    });
    return;
  }

  res.json({
    success: true,
    data: result,
  });
});

router.post('/:id/escalate', (req: Request, res: Response): void => {
  const alertId = req.params.id;
  const result = alertEngine.escalateAlert(alertId);

  if (!result) {
    res.status(404).json({
      success: false,
      error: '预警不存在',
    });
    return;
  }

  res.json({
    success: true,
    data: result,
  });
});

router.get('/engine/status', (req: Request, res: Response): void => {
  res.json({
    success: true,
    data: {
      stats: alertEngine.getStats(),
      dataCollection: dataCleaner.getStats(),
    },
  });
});

export default router;
