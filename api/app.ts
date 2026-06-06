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

dataCollector.start();
alertEngine.start();
approvalEngine.start();
console.log('=== 智能快递柜运营平台后端服务启动 ===');
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
  let archives = dataCleaner.getAllArchives();
  
  if (region) {
    archives = archives.filter(a => a.locker.region === region);
  }

  res.json({
    success: true,
    data: archives.map(a => ({
      lockerId: a.locker.id,
      lockerName: a.locker.name,
      status: a.locker.status,
      todayUsage: a.locker.todayUsage.toFixed(1),
      activeFaults: a.activeFaults.filter(f => !f.resolved).length,
      lastUpdate: a.lastUpdate,
    })),
  });
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
