import { Router, type Request, type Response } from 'express';
import { mockAlerts, mockAlertStats } from '../../shared/mockData.js';
import type { Alert } from '../../shared/types.js';

let alertsData = [...mockAlerts];

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const level = req.query.level as string;
  const status = req.query.status as string;
  const region = req.query.region as string;

  let filtered = [...alertsData];

  if (level) {
    filtered = filtered.filter((a) => a.level === parseInt(level));
  }
  if (status) {
    filtered = filtered.filter((a) => a.status === status);
  }
  if (region) {
    filtered = filtered.filter((a) => a.region === region);
  }

  const start = (page - 1) * pageSize;
  const list = filtered.slice(start, start + pageSize);

  res.json({
    success: true,
    data: {
      list,
      total: filtered.length,
      page,
      pageSize,
    },
  });
});

router.get('/stats', (req: Request, res: Response): void => {
  const stats = {
    level1: alertsData.filter((a) => a.level === 1 && a.status !== 'resolved').length,
    level2: alertsData.filter((a) => a.level === 2 && a.status !== 'resolved').length,
    handled: alertsData.filter((a) => a.status === 'resolved').length,
    pending: alertsData.filter((a) => a.status === 'pending' || a.status === 'processing').length,
  };
  res.json({
    success: true,
    data: stats,
  });
});

router.post('/:id/handle', (req: Request, res: Response): void => {
  const { action, remark } = req.body;
  const alertId = req.params.id;
  const index = alertsData.findIndex((a) => a.id === alertId);

  if (index === -1) {
    res.status(404).json({
      success: false,
      error: 'Alert not found',
    });
    return;
  }

  alertsData[index] = {
    ...alertsData[index],
    status: action === 'resolve' ? 'resolved' : 'processing',
    handledAt: new Date().toISOString(),
    handledBy: '当前用户',
  };

  res.json({
    success: true,
    data: alertsData[index],
  });
});

router.post('/:id/escalate', (req: Request, res: Response): void => {
  const alertId = req.params.id;
  const index = alertsData.findIndex((a) => a.id === alertId);

  if (index === -1) {
    res.status(404).json({
      success: false,
      error: 'Alert not found',
    });
    return;
  }

  alertsData[index] = {
    ...alertsData[index],
    level: 2,
    status: 'escalated',
  };

  res.json({
    success: true,
    data: alertsData[index],
  });
});

export default router;
