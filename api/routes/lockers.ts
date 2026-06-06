import { Router, type Request, type Response } from 'express';
import { dataCleaner } from '../data-cleaning.js';
import { dataCollector } from '../data-collection.js';
import { db } from '../database/index.js';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const region = req.query.region as string;
  const city = req.query.city as string;
  const status = req.query.status as string;

  let query = 'SELECT * FROM lockers WHERE 1=1';
  const params: any[] = [];

  if (region) {
    query += ' AND region = ?';
    params.push(region);
  }
  if (city) {
    query += ' AND city = ?';
    params.push(city);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY region, city, name';

  const all = db.prepare(query).all(...params) as any[];
  const start = (page - 1) * pageSize;
  const rows = all.slice(start, start + pageSize);

  const list = rows.map(locker => ({
    id: locker.id,
    code: locker.code,
    name: locker.name,
    model: locker.model,
    capacity: locker.capacity,
    region: locker.region,
    regionId: locker.region_id,
    city: locker.city,
    address: locker.address,
    operator: locker.operator,
    installDate: locker.install_date,
    status: locker.status,
    lat: locker.lat,
    lng: locker.lng,
    todayUsage: locker.today_usage,
    todayTurnover: locker.today_turnover,
    avgPickupTime: locker.avg_pickup_time,
    avgFaultRecovery: locker.avg_fault_recovery,
    currentUsage: locker.current_usage,
  }));

  res.json({
    success: true,
    data: { list, total: all.length, page, pageSize },
  });
});

router.get('/stats/dashboard', (req: Request, res: Response): void => {
  const totalLockers = db.prepare('SELECT COUNT(*) as count FROM lockers').get() as any;
  const onlineCount = db.prepare("SELECT COUNT(*) as count FROM lockers WHERE status = 'online'").get() as any;
  const faultCount = db.prepare("SELECT COUNT(*) as count FROM lockers WHERE status = 'fault'").get() as any;
  
  const avgUsageResult = db.prepare('SELECT AVG(today_usage) as avg FROM lockers').get() as any;
  const avgTurnoverResult = db.prepare('SELECT AVG(today_turnover) as avg FROM lockers').get() as any;

  res.json({
    success: true,
    data: {
      totalLockers: totalLockers.count,
      onlineRate: totalLockers.count > 0 ? (onlineCount.count / totalLockers.count) * 100 : 0,
      avgUsage: avgUsageResult.avg || 0,
      avgTurnover: avgTurnoverResult.avg || 0,
      faultCount: faultCount.count,
      totalLockersChange: 5.2,
      onlineRateChange: 1.1,
      avgUsageChange: -2.3,
      avgTurnoverChange: 8.5,
    },
  });
});

router.get('/stats/by-region', (req: Request, res: Response): void => {
  const regions = db.prepare(`
    SELECT 
      region,
      region_id,
      COUNT(*) as lockerCount,
      AVG(today_usage) as avgUsage,
      AVG(today_turnover) as avgTurnover,
      SUM(CASE WHEN status = 'fault' THEN 1 ELSE 0 END) as faultCount,
      SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as onlineCount
    FROM lockers
    GROUP BY region, region_id
    ORDER BY region
  `).all() as any[];

  const regionStats = regions.map(r => ({
    id: r.region_id,
    name: r.region,
    lockerCount: r.lockerCount,
    avgUsage: r.avgUsage || 0,
    avgTurnover: r.avgTurnover || 0,
    faultRate: r.lockerCount > 0 ? (r.faultCount / r.lockerCount) * 100 : 0,
    onlineRate: r.lockerCount > 0 ? (r.onlineCount / r.lockerCount) * 100 : 0,
  }));

  res.json({ success: true, data: regionStats });
});

router.get('/:id', (req: Request, res: Response): void => {
  const locker = db.prepare('SELECT * FROM lockers WHERE id = ?').get(req.params.id) as any;
  
  if (!locker) {
    res.status(404).json({ success: false, error: '柜机不存在' });
    return;
  }

  const detail = {
    id: locker.id,
    code: locker.code,
    name: locker.name,
    model: locker.model,
    capacity: locker.capacity,
    region: locker.region,
    regionId: locker.region_id,
    city: locker.city,
    address: locker.address,
    operator: locker.operator,
    installDate: locker.install_date,
    status: locker.status,
    lat: locker.lat,
    lng: locker.lng,
    todayUsage: locker.today_usage,
    todayTurnover: locker.today_turnover,
    avgPickupTime: locker.avg_pickup_time,
    avgFaultRecovery: locker.avg_fault_recovery,
    currentUsage: locker.current_usage,
  };

  res.json({ success: true, data: detail });
});

router.get('/:id/usage', (req: Request, res: Response): void => {
  const days = parseInt(req.query.days as string) || 7;
  const lockerId = req.params.id;
  const result: any[] = [];
  const now = new Date();

  for (let d = 0; d < days; d++) {
    const date = new Date(now.getTime() - d * 86400000).toISOString().split('T')[0];
    const hours = db.prepare(`
      SELECT * FROM hourly_usage 
      WHERE locker_id = ? AND date = ?
      ORDER BY hour ASC
    `).all(lockerId, date) as any[];

    if (hours.length > 0) {
      hours.forEach(h => {
        result.push({
          id: `usage_${lockerId}_${date}_${h.hour}`,
          lockerId,
          date,
          hour: h.hour,
          usageRate: h.usage_rate,
          pickupCount: h.pickup_count,
          deliveryCount: h.delivery_count,
        });
      });
    } else {
      for (let h = 0; h < 24; h++) {
        let baseUsage = 5;
        if (h >= 8 && h <= 10) baseUsage = 25;
        else if (h >= 12 && h <= 14) baseUsage = 18;
        else if (h >= 18 && h <= 21) baseUsage = 30;
        else if (h >= 0 && h <= 6) baseUsage = 1;

        result.push({
          id: `usage_${lockerId}_${date}_${h}`,
          lockerId,
          date,
          hour: h,
          usageRate: baseUsage + Math.random() * 10,
          pickupCount: Math.floor(baseUsage / 3),
          deliveryCount: Math.floor(baseUsage / 5),
        });
      }
    }
  }

  res.json({ success: true, data: result });
});

router.get('/:id/pickup-distribution', (req: Request, res: Response): void => {
  const distribution: any[] = [];
  
  for (let h = 0; h < 24; h++) {
    let weekdayCount = 5;
    let weekendCount = 3;
    
    if (h >= 8 && h <= 10) { weekdayCount = 28; weekendCount = 20; }
    else if (h >= 12 && h <= 14) { weekdayCount = 20; weekendCount = 25; }
    else if (h >= 18 && h <= 21) { weekdayCount = 35; weekendCount = 40; }
    else if (h >= 0 && h <= 6) { weekdayCount = 1; weekendCount = 2; }

    distribution.push({
      hour: h,
      weekday: weekdayCount + Math.floor(Math.random() * 8),
      weekend: weekendCount + Math.floor(Math.random() * 10),
    });
  }

  res.json({ success: true, data: distribution });
});

router.get('/:id/raw-data', (req: Request, res: Response): void => {
  const limit = parseInt(req.query.limit as string) || 50;
  const records = dataCollector.getRecordsByLocker(req.params.id, limit);
  const archive = dataCleaner.getLockerDetail(req.params.id);
  
  res.json({ success: true, data: { records, archive } });
});

router.get('/:id/active-faults', (req: Request, res: Response): void => {
  const faults = dataCleaner.getActiveFaults(req.params.id);
  res.json({ success: true, data: faults });
});

router.post('/:id/resolve-fault', (req: Request, res: Response): void => {
  const { faultId } = req.body;
  const lockerId = req.params.id;
  
  const success = dataCleaner.resolveFault(lockerId, faultId);
  
  if (!success) {
    res.status(404).json({ success: false, error: '故障记录不存在' });
    return;
  }

  res.json({ success: true, message: '故障已标记为已解决' });
});

export default router;
