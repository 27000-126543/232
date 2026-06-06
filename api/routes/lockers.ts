import { Router, type Request, type Response } from 'express';
import {
  getUsageRecords,
  getPickupDistribution,
  getRegionStats,
} from '../../shared/mockData.js';
import { dataCleaner } from '../data-cleaning.js';
import { dataCollector } from '../data-collection.js';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const region = req.query.region as string;
  const city = req.query.city as string;
  const status = req.query.status as string;

  let archives = dataCleaner.getAllArchives();

  if (region) {
    archives = archives.filter(a => a.locker.region === region);
  }
  if (city) {
    archives = archives.filter(a => a.locker.city === city);
  }
  if (status) {
    archives = archives.filter(a => a.locker.status === status);
  }

  const start = (page - 1) * pageSize;
  const list = archives.slice(start, start + pageSize).map(a => a.locker);

  res.json({
    success: true,
    data: {
      list,
      total: archives.length,
      page,
      pageSize,
    },
  });
});

router.get('/stats/dashboard', (req: Request, res: Response): void => {
  const archives = dataCleaner.getAllArchives();
  const totalLockers = archives.length;
  const onlineCount = archives.filter(a => a.locker.status === 'online').length;
  const faultCount = archives.filter(a => a.locker.status === 'fault').length;
  
  const avgUsage = archives.length > 0
    ? archives.reduce((sum, a) => sum + a.locker.todayUsage, 0) / archives.length
    : 0;
  const avgTurnover = archives.length > 0
    ? archives.reduce((sum, a) => sum + a.locker.todayTurnover, 0) / archives.length
    : 0;

  res.json({
    success: true,
    data: {
      totalLockers,
      onlineRate: totalLockers > 0 ? (onlineCount / totalLockers) * 100 : 0,
      avgUsage,
      avgTurnover,
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
  const archive = dataCleaner.getLockerArchive(req.params.id);
  if (!archive) {
    res.status(404).json({
      success: false,
      error: '柜机不存在',
    });
    return;
  }
  res.json({
    success: true,
    data: archive.locker,
  });
});

router.get('/:id/usage', (req: Request, res: Response): void => {
  const days = parseInt(req.query.days as string) || 7;
  const archive = dataCleaner.getLockerArchive(req.params.id);
  
  let records = getUsageRecords(req.params.id, days);
  
  if (archive) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    for (let h = 0; h < now.getHours(); h++) {
      const key = `${today}_${h}`;
      const hourUsage = archive.hourlyUsage.get(key);
      if (hourUsage) {
        records = records.map(r => {
          if (r.date === today && r.hour === h) {
            return hourUsage;
          }
          return r;
        });
      }
    }
  }

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

router.get('/:id/raw-data', (req: Request, res: Response): void => {
  const limit = parseInt(req.query.limit as string) || 50;
  const records = dataCollector.getRecordsByLocker(req.params.id, limit);
  
  res.json({
    success: true,
    data: {
      records,
      archive: dataCleaner.getLockerArchive(req.params.id)
    },
  });
});

router.get('/:id/active-faults', (req: Request, res: Response): void => {
  const faults = dataCleaner.getActiveFaults(req.params.id);
  
  res.json({
    success: true,
    data: faults,
  });
});

router.post('/:id/resolve-fault', (req: Request, res: Response): void => {
  const { faultId } = req.body;
  const lockerId = req.params.id;
  
  const success = dataCleaner.resolveFault(lockerId, faultId);
  
  if (!success) {
    res.status(404).json({
      success: false,
      error: '故障记录不存在',
    });
    return;
  }

  res.json({
    success: true,
    message: '故障已标记为已解决',
  });
});

export default router;
