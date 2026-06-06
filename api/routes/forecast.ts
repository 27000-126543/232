import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { getForecast72h, mockRecommendations, generateRecommendations } from '../../shared/mockData.js';
import type { CommunityEvent, ForecastPoint, Recommendation } from '../../shared/types';
import { dataCleaner } from '../data-cleaning.js';

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

let uploadedEvents: CommunityEvent[] = [];
let adjustedForecast: ForecastPoint[] = [];
let adjustedRecommendations: Recommendation[] = [];

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
          id: `event_${Date.now()}_${index}`,
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

router.get('/72h', (req: Request, res: Response): void => {
  const regionId = req.query.regionId as string;
  let forecast = getForecast72h(regionId);
  
  if (adjustedForecast.length > 0) {
    forecast = adjustedForecast;
  }

  res.json({
    success: true,
    data: forecast,
  });
});

router.get('/recommendations', (req: Request, res: Response): void => {
  const recs = adjustedRecommendations.length > 0 ? adjustedRecommendations : mockRecommendations;
  res.json({
    success: true,
    data: recs,
  });
});

router.get('/events', (req: Request, res: Response): void => {
  const allEvents = [...uploadedEvents];
  res.json({
    success: true,
    data: allEvents,
  });
});

router.post('/upload', upload.single('file'), (req: Request, res: Response): void => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: '请上传Excel文件',
      });
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

    uploadedEvents = [...uploadedEvents, ...events];

    const baseForecast = getForecast72h();
    adjustedForecast = calculateAdjustedForecast(baseForecast, uploadedEvents);
    adjustedRecommendations = generateRecommendations(uploadedEvents);

    console.log(`[Forecast] 成功解析Excel文件，提取${events.length}个活动，已更新预测和推荐方案`);

    res.json({
      success: true,
      data: {
        extracted: events.length,
        events,
        adjustedForecast,
        recommendations: adjustedRecommendations,
        message: `成功提取${events.length}个活动信息，已更新72小时取件量预测`,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || '文件上传失败',
    });
  }
});

router.delete('/events/:id', (req: Request, res: Response): void => {
  const eventId = req.params.id;
  uploadedEvents = uploadedEvents.filter(e => e.id !== eventId);
  
  const baseForecast = getForecast72h();
  adjustedForecast = calculateAdjustedForecast(baseForecast, uploadedEvents);
  adjustedRecommendations = generateRecommendations(uploadedEvents);

  res.json({
    success: true,
    message: '活动已删除，预测已更新',
  });
});

router.get('/analysis', (req: Request, res: Response): void => {
  const archives = dataCleaner.getAllArchives();
  const totalLockers = archives.length;
  const avgUsage = archives.reduce((sum, a) => sum + a.locker.todayUsage, 0) / totalLockers;
  const activeEvents = uploadedEvents.length;

  res.json({
    success: true,
    data: {
      totalLockers,
      avgUsage: avgUsage.toFixed(1),
      activeEvents,
      forecastPeak: adjustedForecast.length > 0 
        ? Math.max(...adjustedForecast.map(f => f.predicted))
        : 0,
    },
  });
});

export default router;
