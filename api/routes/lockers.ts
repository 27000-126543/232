import { Router, type Request, type Response } from 'express';
import {
  mockLockers,
  getLockerDetail,
  getUsageRecords,
  getPickupDistribution,
  getRegionStats,
} from '../../shared/mockData.js';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const region = req.query.region as string;
  const city = req.query.city as string;
  const status = req.query.status as string;

  let filtered = [...mockLockers];

  if (region) {
    filtered = filtered.filter((l) => l.region === region);
  }
  if (city) {
    filtered = filtered.filter((l) => l.city === city);
  }
  if (status) {
    filtered = filtered.filter((l) => l.status === status);
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

router.get('/stats/dashboard', (req: Request, res: Response): void => {
  const totalLockers = mockLockers.length;
  const onlineCount = mockLockers.filter((l) => l.status === 'online').length;
  const faultCount = mockLockers.filter((l) => l.status === 'fault').length;

  res.json({
    success: true,
    data: {
      totalLockers,
      onlineRate: (onlineCount / totalLockers) * 100,
      avgUsage: 45.6,
      avgTurnover: 3.2,
      faultCount,
      totalLockersChange: 5.2,
      onlineRateChange: 1.1,
      avgUsageChange: -2.3,
      avgTurnoverChange: 8.5,
    },
  });
});

router.get('/stats/by-region', (req: Request, res: Response): void => {
  const stats = getRegionStats();
  res.json({
    success: true,
    data: stats,
  });
});

router.get('/:id', (req: Request, res: Response): void => {
  const detail = getLockerDetail(req.params.id);
  if (!detail) {
    res.status(404).json({
      success: false,
      error: 'Locker not found',
    });
    return;
  }
  res.json({
    success: true,
    data: detail,
  });
});

router.get('/:id/usage', (req: Request, res: Response): void => {
  const days = parseInt(req.query.days as string) || 7;
  const records = getUsageRecords(req.params.id, days);
  res.json({
    success: true,
    data: records,
  });
});

router.get('/:id/pickup-distribution', (req: Request, res: Response): void => {
  const distribution = getPickupDistribution(req.params.id);
  res.json({
    success: true,
    data: distribution,
  });
});

export default router;
