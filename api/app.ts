/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import lockersRoutes from './routes/lockers.js';
import alertsRoutes, { alertEngine } from './routes/alerts.js';
import approvalsRoutes, { approvalEngine } from './routes/approvals.js';
import forecastRoutes from './routes/forecast.js';
import reportsRoutes from './routes/reports.js';
import { dataCollector } from './data-collection.js';
import { dataCleaner } from './data-cleaning.js';
import { initDatabase } from './database/index.js';
import { seedDatabase } from './database/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app: express.Application = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/lockers', lockersRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/reports', reportsRoutes);

app.post('/api/events', (req: Request, res: Response): void => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    const result = dataCollector.receiveBatchEvents(events);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/events/batch', (req: Request, res: Response): void => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events)) {
      res.status(400).json({ success: false, error: 'events 必须是数组' });
      return;
    }
    const result = dataCollector.receiveBatchEvents(events);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

initDatabase();
seedDatabase();

dataCollector.start();
alertEngine.start();
approvalEngine.start();
console.log('=== 智能快递柜运营平台后端服务启动 ===');
console.log('- SQLite数据库: 已初始化');
console.log('- 数据接入服务: 已启动 (每2秒采集)');
console.log('- 数据清洗服务: 已启动');
console.log('- 预警引擎: 已启动 (每分钟检查)');
console.log('- 审批状态机: 已启动 (每5分钟检查超时)');
console.log('=========================================');

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
      services: {
        dataCollection: 'running',
        dataCleaning: 'running',
        alertEngine: 'running',
        approvalEngine: 'running',
      },
    })
  },
)

/**
 * 系统状态监控
 */
app.get('/api/system/status', (req: Request, res: Response): void => {
  const collectionStats = dataCollector.getStats();
  const cleaningStats = dataCleaner.getStats();
  const alertStats = alertEngine.getStats();
  const approvalStats = approvalEngine.getStats();

  res.json({
    success: true,
    data: {
      dataCollection: collectionStats,
      dataCleaning: cleaningStats,
      alerts: alertStats,
      approvals: approvalStats,
      uptime: process.uptime(),
    },
  });
});

/**
 * 实时数据接入状态
 */
app.get('/api/data/stream', (req: Request, res: Response): void => {
  const limit = parseInt(req.query.limit as string) || 50;
  const recentRecords = dataCollector.getRecentRecords(limit);
  
  res.json({
    success: true,
    data: {
      records: recentRecords,
      stats: dataCollector.getStats(),
    },
  });
});

/**
 * 柜机档案状态
 */
app.get('/api/data/archives', (req: Request, res: Response): void => {
  const region = req.query.region as string;
  const lockers = dataCleaner.getAllLockerDetails();
  
  let filtered = lockers;
  if (region) {
    filtered = lockers.filter(l => l.region === region);
  }

  const data = filtered.map(l => {
    const activeFaults = dataCleaner.getActiveFaults(l.id);
    return {
      lockerId: l.id,
      lockerName: l.name,
      status: l.status,
      todayUsage: l.todayUsage.toFixed(1),
      activeFaults: activeFaults.length,
      lastUpdate: new Date().toISOString(),
    };
  });

  res.json({ success: true, data });
});

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
