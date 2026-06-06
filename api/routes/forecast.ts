import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { db } from '../database/index.js';
import { dataCleaner } from '../data-cleaning.js';
import type { CommunityEvent, ForecastPoint, Recommendation } from '../../shared/types.js';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/)) {
      cb(null, true);
    } else {
      cb(new Error('只支持Excel文件(.xlsx, .xls)'));
    }
  },
});

function parseExcelFile(buffer: Buffer): CommunityEvent[] {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

    const events: CommunityEvent[] = [];
    
    jsonData.forEach((row, index) => {
      if (index === 0 && !row['活动名称'] && !row['小区名称']) {
        return;
      }

      const name = row['活动名称'] || row['活动'] || row['name'] || row['event'];
      const community = row['小区名称'] || row['小区'] || row['community'];
      const region = row['区域'] || row['region'] || '华东区';
      const startTimeStr = row['开始时间'] || row['开始日期'] || row['startDate'] || row['start'];
      const endTimeStr = row['结束时间'] || row['结束日期'] || row['endDate'] || row['end'];
      const footTraffic = row['预计人流'] || row['预计人流量'] || row['footTraffic'] || row['people'];

      if (name && community && startTimeStr) {
        let startTime: string;
        let endTime: string;

        if (typeof startTimeStr === 'number') {
          const date = new Date((startTimeStr - 25569) * 86400 * 1000);
          startTime = date.toISOString();
        } else if (startTimeStr instanceof Date) {
          startTime = startTimeStr.toISOString();
        } else {
          startTime = new Date(startTimeStr).toISOString();
        }

        if (endTimeStr) {
          if (typeof endTimeStr === 'number') {
            const date = new Date((endTimeStr - 25569) * 86400 * 1000);
            endTime = date.toISOString();
          } else if (endTimeStr instanceof Date) {
            endTime = endTimeStr.toISOString();
          } else {
            endTime = new Date(endTimeStr).toISOString();
          }
        } else {
          const endDate = new Date(startTime);
          endDate.setDate(endDate.getDate() + 1);
          endTime = endDate.toISOString();
        }

        events.push({
          id: `event_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`,
          name: String(name),
          community: String(community),
          region: String(region),
          startTime,
          endTime,
          estimatedFootTraffic: parseInt(String(footTraffic || '500')),
        });
      }
    });

    return events;
  } catch (error) {
    console.error('Excel解析错误:', error);
    throw new Error('Excel文件解析失败，请检查文件格式');
  }
}

function generateBaseForecast(): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  const now = Date.now();

  for (let i = 0; i < 72; i++) {
    const time = new Date(now + i * 3600000);
    const hour = time.getHours();
    
    let baseValue = 50;
    if (hour >= 8 && hour <= 10) baseValue = 120;
    else if (hour >= 12 && hour <= 14) baseValue = 90;
    else if (hour >= 18 && hour <= 21) baseValue = 150;
    else if (hour >= 0 && hour <= 6) baseValue = 10;
    
    const variation = Math.random() * 30 - 15;
    const predicted = Math.max(10, baseValue + variation);

    points.push({
      time: time.toISOString(),
      predicted: Math.round(predicted),
      lower: Math.round(predicted * 0.8),
      upper: Math.round(predicted * 1.25),
    });
  }

  return points;
}

function calculateAdjustedForecast(baseForecast: ForecastPoint[], events: CommunityEvent[]): ForecastPoint[] {
  if (events.length === 0) return baseForecast;

  return baseForecast.map(point => {
    let multiplier = 1;
    const pointTime = new Date(point.time).getTime();

    events.forEach(event => {
      const eventStart = new Date(event.startTime).getTime();
      const eventEnd = new Date(event.endTime).getTime();
      
      if (pointTime >= eventStart && pointTime <= eventEnd) {
        const trafficFactor = 1 + (event.estimatedFootTraffic / 1000) * 0.3;
        multiplier = Math.max(multiplier, trafficFactor);
      }
    });

    return {
      ...point,
      predicted: Math.round(point.predicted * multiplier),
      lower: Math.round(point.lower * multiplier),
      upper: Math.round(point.upper * multiplier * 1.1),
    };
  });
}

function generateRecommendations(events: CommunityEvent[]): Recommendation[] {
  const baseRecs: Recommendation[] = [
    {
      id: 'rec-1',
      type: 'add_locker',
      typeName: '调整补货频次',
      region: '华东区',
      description: '华东区整体取件量呈上升趋势，建议将高峰期补货频次从2次/天调整为3次/天',
      cost: 8000,
      estimatedBenefit: 25000,
      priority: 'medium',
    },
  ];
  
  events.forEach((event, index) => {
    const trafficMultiplier = Math.min(event.estimatedFootTraffic / 1000, 3);
    const isAddLocker = Math.random() > 0.5;
    
    baseRecs.unshift({
      id: `rec-event-${Date.now()}-${index}`,
      type: isAddLocker ? 'add_locker' : 'transfer',
      typeName: isAddLocker ? '新增柜机' : '柜机调拨',
      region: event.region,
      description: `${event.community}${event.name}活动预计人流${event.estimatedFootTraffic}人次，建议${isAddLocker ? '新增临时柜机' : '从周边调拨柜机'}以应对取件高峰`,
      cost: isAddLocker ? Math.round(35000 * trafficMultiplier) : Math.round(5000 * trafficMultiplier),
      estimatedBenefit: Math.round(25000 * trafficMultiplier),
      priority: event.estimatedFootTraffic > 2000 ? 'high' : event.estimatedFootTraffic > 1000 ? 'medium' : 'low',
    });
  });

  return baseRecs.slice(0, 8);
}

router.get('/72h', (req: Request, res: Response): void => {
  const events = db.prepare('SELECT * FROM community_events ORDER BY start_time DESC').all() as any[];
  const baseForecast = generateBaseForecast();
  const adjusted = calculateAdjustedForecast(baseForecast, events);
  
  res.json({ success: true, data: adjusted });
});

router.get('/recommendations', (req: Request, res: Response): void => {
  const events = db.prepare('SELECT * FROM community_events ORDER BY start_time DESC').all() as any[];
  const recs = generateRecommendations(events);
  res.json({ success: true, data: recs });
});

router.get('/events', (req: Request, res: Response): void => {
  const events = db.prepare('SELECT * FROM community_events ORDER BY start_time DESC').all() as any[];
  res.json({ success: true, data: events });
});

router.post('/upload', upload.single('file'), (req: Request, res: Response): void => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: '请上传Excel文件' });
      return;
    }

    const events = parseExcelFile(req.file.buffer);
    
    if (events.length === 0) {
      res.status(400).json({
        success: false,
        error: '未从Excel中提取到有效活动数据，请检查列名是否正确（活动名称、小区名称、开始时间、预计人流）',
      });
      return;
    }

    const insertStmt = db.prepare(`
      INSERT INTO community_events (id, name, community, region, start_time, end_time, estimated_foot_traffic, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      events.forEach(event => {
        insertStmt.run(
          event.id,
          event.name,
          event.community,
          event.region,
          event.startTime,
          event.endTime,
          event.estimatedFootTraffic,
          new Date().toISOString()
        );
      });
    });
    tx();

    const allEvents = db.prepare('SELECT * FROM community_events ORDER BY start_time DESC').all() as any[];
    const baseForecast = generateBaseForecast();
    const adjustedForecast = calculateAdjustedForecast(baseForecast, allEvents);
    const recommendations = generateRecommendations(allEvents);

    console.log(`[Forecast] 成功解析Excel文件，提取${events.length}个活动`);

    res.json({
      success: true,
      data: {
        extracted: events.length,
        events,
        adjustedForecast,
        recommendations,
        message: `成功提取${events.length}个活动信息，已更新72小时取件量预测`,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || '文件上传失败' });
  }
});

router.delete('/events/:id', (req: Request, res: Response): void => {
  const result = db.prepare('DELETE FROM community_events WHERE id = ?').run(req.params.id);
  
  if (result.changes === 0) {
    res.status(404).json({ success: false, error: '活动不存在' });
    return;
  }

  res.json({ success: true, message: '活动已删除，预测已更新' });
});

router.get('/analysis', (req: Request, res: Response): void => {
  const stats = dataCleaner.getStats();
  const eventCount = db.prepare('SELECT COUNT(*) as count FROM community_events').get() as any;
  const baseForecast = generateBaseForecast();
  const events = db.prepare('SELECT * FROM community_events').all() as any[];
  const adjusted = calculateAdjustedForecast(baseForecast, events);

  res.json({
    success: true,
    data: {
      totalLockers: stats.totalLockers,
      avgUsage: (stats as any).avgUsage || '35.5',
      activeEvents: eventCount.count,
      forecastPeak: adjusted.length > 0 ? Math.max(...adjusted.map(f => f.predicted)) : 0,
    },
  });
});

export default router;
