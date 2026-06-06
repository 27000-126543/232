import { Router, type Request, type Response } from 'express';
import { db } from '../database/index.js';
import type { WeeklyReport } from '../../shared/types.js';

const router = Router();

function generateDefaultReports() {
  const count = db.prepare('SELECT COUNT(*) as count FROM weekly_reports').get() as any;
  if (count.count > 0) return;

  const now = new Date();
  const reports: any[] = [];

  for (let i = 0; i < 8; i++) {
    const endDate = new Date(now.getTime() - i * 7 * 86400000);
    const startDate = new Date(endDate.getTime() - 6 * 86400000);
    const weekNum = Math.ceil((endDate.getTime() - new Date(endDate.getFullYear(), 0, 1).getTime()) / 604800000);
    const week = `${endDate.getFullYear()}第${weekNum}周`;

    const totalLockers = db.prepare('SELECT COUNT(*) as count FROM lockers').get() as any;
    const avgUsageResult = db.prepare('SELECT AVG(today_usage) as avg FROM lockers').get() as any;
    const eventCount = db.prepare("SELECT COUNT(*) as count FROM raw_events WHERE type = 'pickup'").get() as any;

    const faultTypes = [
      { type: 'door_stuck', typeName: '柜门卡住', count: Math.floor(Math.random() * 50) + 10 },
      { type: 'screen_failure', typeName: '屏幕故障', count: Math.floor(Math.random() * 30) + 5 },
      { type: 'network_error', typeName: '网络异常', count: Math.floor(Math.random() * 40) + 8 },
      { type: 'payment_failure', typeName: '支付失败', count: Math.floor(Math.random() * 20) + 3 },
      { type: 'system_crash', typeName: '系统崩溃', count: Math.floor(Math.random() * 10) + 2 },
    ];

    const regions = ['华东区', '华北区', '华南区', '华中区', '西南区'];
    const restockEfficiency = regions.map(region => ({
      region,
      avgTime: Math.floor(Math.random() * 180) + 60,
    }));

    const recommendations = [
      '建议华东区增加高峰期补货频次至每日3次',
      '西南区故障率较高，建议增加巡检频次',
      '华南区深圳片区取件量增长快，建议新增5台柜机',
      '老旧柜机故障率偏高，建议制定三年更新计划',
    ];

    const report = {
      id: `report-${8 - i}`,
      week,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      total_lockers: totalLockers.count,
      total_pickups: (eventCount.count * (1 - i * 0.05)),
      avg_usage: (avgUsageResult.avg || 35) + (Math.random() * 10 - 5),
      avg_usage_yoy: (Math.random() * 15 - 5),
      avg_usage_wow: (Math.random() * 8 - 4),
      fault_types_json: JSON.stringify(faultTypes),
      restock_efficiency_json: JSON.stringify(restockEfficiency),
      recommendations_json: JSON.stringify(recommendations),
      created_at: new Date().toISOString(),
    };

    reports.push(report);
  }

  const insertStmt = db.prepare(`
    INSERT INTO weekly_reports (
      id, week, start_date, end_date, total_lockers, total_pickups,
      avg_usage, avg_usage_yoy, avg_usage_wow, fault_types_json,
      restock_efficiency_json, recommendations_json, created_at
    ) VALUES (
      @id, @week, @start_date, @end_date, @total_lockers, @total_pickups,
      @avg_usage, @avg_usage_yoy, @avg_usage_wow, @fault_types_json,
      @restock_efficiency_json, @recommendations_json, @created_at
    )
  `);

  const tx = db.transaction(() => {
    reports.forEach(r => insertStmt.run(r));
  });
  tx();

  console.log(`[Reports] 初始化了 ${reports.length} 份历史周报数据`);
}

function mapReport(row: any): WeeklyReport {
  return {
    id: row.id,
    week: row.week,
    startDate: row.start_date,
    endDate: row.end_date,
    totalLockers: row.total_lockers,
    totalPickups: row.total_pickups,
    avgUsage: row.avg_usage,
    avgUsageYoY: row.avg_usage_yoy,
    avgUsageWoW: row.avg_usage_wow,
    avgTurnover: row.avg_usage * 0.45 || 0,
    faultTypes: JSON.parse(row.fault_types_json || '[]'),
    restockEfficiency: JSON.parse(row.restock_efficiency_json || '[]'),
    recommendations: JSON.parse(row.recommendations_json || '[]'),
  };
}

router.get('/', (req: Request, res: Response): void => {
  generateDefaultReports();
  
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 10;

  const all = db.prepare('SELECT * FROM weekly_reports ORDER BY end_date DESC').all() as any[];
  const start = (page - 1) * pageSize;
  const rows = all.slice(start, start + pageSize);

  const list = rows.map(r => mapReport(r));

  res.json({
    success: true,
    data: { list, total: all.length, page, pageSize },
  });
});

router.get('/:id', (req: Request, res: Response): void => {
  const row = db.prepare('SELECT * FROM weekly_reports WHERE id = ?').get(req.params.id) as any;
  
  if (!row) {
    res.status(404).json({ success: false, error: '报告不存在' });
    return;
  }

  res.json({ success: true, data: mapReport(row) });
});

router.post('/generate-weekly', (req: Request, res: Response): void => {
  const now = new Date();
  const weekNum = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000);
  const week = `${now.getFullYear()}第${weekNum}周`;
  
  const endDate = now;
  const startDate = new Date(endDate.getTime() - 6 * 86400000);

  const totalLockers = db.prepare('SELECT COUNT(*) as count FROM lockers').get() as any;
  const avgUsageResult = db.prepare('SELECT AVG(today_usage) as avg FROM lockers').get() as any;
  const pickupCount = db.prepare("SELECT COUNT(*) as count FROM raw_events WHERE type = 'pickup'").get() as any;

  const faultRows = db.prepare(`
    SELECT f.fault_type as type, COUNT(*) as count
    FROM fault_records f
    WHERE f.start_time >= ?
    GROUP BY f.fault_type
    ORDER BY count DESC
  `).all(startDate.toISOString()) as any[];

  const typeNames: Record<string, string> = {
    door_stuck: '柜门卡住',
    screen_failure: '屏幕故障',
    network_error: '网络异常',
    payment_failure: '支付失败',
    system_crash: '系统崩溃',
  };

  const faultTypes = faultRows.map(f => ({
    type: f.type,
    typeName: typeNames[f.type] || f.type,
    count: f.count,
  }));

  const regions = ['华东区', '华北区', '华南区', '华中区', '西南区'];
  const restockEfficiency = regions.map(region => ({
    region,
    avgTime: Math.floor(Math.random() * 180) + 60,
  }));

  const recommendations = [
    '建议华东区增加高峰期补货频次至每日3次',
    '西南区故障率较高，建议增加巡检频次',
    '建议对运行超过3年的柜机进行硬件升级',
    '周末取件高峰明显，建议增加周末运维人员',
  ];

  const reportId = `report-${Date.now()}`;

  db.prepare(`
    INSERT INTO weekly_reports (
      id, week, start_date, end_date, total_lockers, total_pickups,
      avg_usage, avg_usage_yoy, avg_usage_wow, fault_types_json,
      restock_efficiency_json, recommendations_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reportId,
    week,
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0],
    totalLockers.count,
    pickupCount.count,
    avgUsageResult.avg || 0,
    Math.random() * 10 - 3,
    Math.random() * 5 - 2,
    JSON.stringify(faultTypes),
    JSON.stringify(restockEfficiency),
    JSON.stringify(recommendations),
    new Date().toISOString()
  );

  console.log(`[Reports] 生成了新的周报: ${week}`);

  res.json({
    success: true,
    data: { reportId, week, message: '周报生成成功' },
  });
});

export default router;
