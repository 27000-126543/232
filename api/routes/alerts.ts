import { Router, type Request, type Response } from 'express';
import { dataCleaner } from '../data-cleaning';
import type { Alert } from '../../shared/types';

export interface AlertInternal extends Alert {
  lastCheckedAt: string;
  usageHistory: { time: string; usage: number }[];
}

class AlertEngine {
  private alerts: Map<string, AlertInternal> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly LOW_USAGE_THRESHOLD = 10;
  private readonly LOW_USAGE_DURATION = 3 * 3600000;
  private readonly FAULT_TIMEOUT = 2 * 3600000;
  private readonly ESCALATION_TIMEOUT = 4 * 3600000;

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
    const archives = dataCleaner.getAllArchives();
    const now = new Date();

    archives.forEach(archive => {
      const lockerId = archive.locker.id;

      const avgUsage = dataCleaner.getLockerUsageRate(lockerId, 3);
      if (avgUsage < this.LOW_USAGE_THRESHOLD) {
        this.checkLowUsageAlert(archive, avgUsage, now);
      }

      const activeFaults = dataCleaner.getActiveFaults(lockerId);
      activeFaults.forEach(fault => {
        const faultDuration = now.getTime() - new Date(fault.startTime).getTime();
        if (faultDuration > this.FAULT_TIMEOUT) {
          this.checkFaultAlert(archive, fault, now);
        }
      });

      this.checkEscalation(lockerId, now);
    });
  }

  private checkLowUsageAlert(archive: any, avgUsage: number, now: Date) {
    const alertId = `low_usage_${archive.locker.id}`;
    const existing = this.alerts.get(alertId);

    if (!existing) {
      const alert: AlertInternal = {
        id: alertId,
        lockerId: archive.locker.id,
        lockerName: archive.locker.name,
        region: archive.locker.region,
        level: 1,
        type: 'low_usage',
        message: `该柜机连续3小时使用率低于10%，当前平均使用率：${avgUsage.toFixed(1)}%`,
        createdAt: now.toISOString(),
        status: 'pending',
        lastCheckedAt: now.toISOString(),
        usageHistory: [{ time: now.toISOString(), usage: avgUsage }],
      };
      this.alerts.set(alertId, alert);
      console.log(`[AlertEngine] 生成低使用率预警: ${archive.locker.name}, 使用率: ${avgUsage.toFixed(1)}%`);
    } else {
      existing.lastCheckedAt = now.toISOString();
      existing.usageHistory.push({ time: now.toISOString(), usage: avgUsage });
      if (existing.usageHistory.length > 60) existing.usageHistory.shift();
      existing.message = `该柜机连续3小时使用率低于10%，当前平均使用率：${avgUsage.toFixed(1)}%`;
    }
  }

  private checkFaultAlert(archive: any, fault: any, now: Date) {
    const alertId = `fault_${archive.locker.id}_${fault.id}`;
    const existing = this.alerts.get(alertId);

    if (!existing) {
      const duration = Math.floor((now.getTime() - new Date(fault.startTime).getTime()) / 60000);
      const alert: AlertInternal = {
        id: alertId,
        lockerId: archive.locker.id,
        lockerName: archive.locker.name,
        region: archive.locker.region,
        level: 1,
        type: 'fault_timeout',
        message: `故障类型: ${fault.faultType} (${fault.errorCode})，已持续${duration}分钟未修复`,
        createdAt: now.toISOString(),
        status: 'pending',
        lastCheckedAt: now.toISOString(),
        usageHistory: [],
      };
      this.alerts.set(alertId, alert);
      console.log(`[AlertEngine] 生成故障超时预警: ${archive.locker.name}, 故障: ${fault.faultType}`);
    } else {
      const duration = Math.floor((now.getTime() - new Date(fault.startTime).getTime()) / 60000);
      existing.lastCheckedAt = now.toISOString();
      existing.message = `故障类型: ${fault.faultType} (${fault.errorCode})，已持续${duration}分钟未修复`;
    }
  }

  private checkEscalation(lockerId: string, now: Date) {
    this.alerts.forEach(alert => {
      if (alert.lockerId !== lockerId) return;
      if (alert.level !== 1 || alert.status === 'resolved') return;

      const age = now.getTime() - new Date(alert.createdAt).getTime();
      if (age > this.ESCALATION_TIMEOUT && alert.status !== 'escalated') {
        alert.level = 2;
        alert.status = 'escalated';
        console.log(`[AlertEngine] 预警升级为二级: ${alert.lockerName}, 类型: ${alert.type}`);
      }
    });
  }

  handleAlert(alertId: string, action: string, handledBy: string): AlertInternal | null {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    if (action === 'resolve') {
      alert.status = 'resolved';
      alert.handledAt = new Date().toISOString();
      alert.handledBy = handledBy;
      
      if (alert.type === 'fault_timeout') {
        const faultId = alert.id.split('_').slice(2).join('_');
        dataCleaner.resolveFault(alert.lockerId, faultId);
      }
    } else if (action === 'process') {
      alert.status = 'processing';
      alert.handledAt = new Date().toISOString();
      alert.handledBy = handledBy;
    }

    return alert;
  }

  escalateAlert(alertId: string): AlertInternal | null {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;
    alert.level = 2;
    alert.status = 'escalated';
    return alert;
  }

  getAlerts(filters?: { level?: number; status?: string; region?: string; page?: number; pageSize?: number }) {
    let list = Array.from(this.alerts.values());

    if (filters?.level) {
      list = list.filter(a => a.level === filters.level);
    }
    if (filters?.status) {
      if (filters.status === 'pending') {
        list = list.filter(a => a.status === 'pending' || a.status === 'processing');
      } else {
        list = list.filter(a => a.status === filters.status);
      }
    }
    if (filters?.region) {
      list = list.filter(a => a.region === filters.region);
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 20;
    const start = (page - 1) * pageSize;
    const paginatedList = list.slice(start, start + pageSize);

    return {
      list: paginatedList,
      total: list.length,
      page,
      pageSize,
    };
  }

  getStats() {
    const all = Array.from(this.alerts.values());
    return {
      level1: all.filter(a => a.level === 1 && a.status !== 'resolved').length,
      level2: all.filter(a => a.level === 2 && a.status !== 'resolved').length,
      handled: all.filter(a => a.status === 'resolved').length,
      pending: all.filter(a => a.status === 'pending' || a.status === 'processing').length,
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
