import { Router, type Request, type Response } from 'express';
import { mockWeeklyReports } from '../../shared/mockData.js';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 10;

  const start = (page - 1) * pageSize;
  const list = mockWeeklyReports.slice(start, start + pageSize);

  res.json({
    success: true,
    data: {
      list,
      total: mockWeeklyReports.length,
      page,
      pageSize,
    },
  });
});

router.get('/:id', (req: Request, res: Response): void => {
  const report = mockWeeklyReports.find((r) => r.id === req.params.id);
  if (!report) {
    res.status(404).json({
      success: false,
      error: 'Report not found',
    });
    return;
  }
  res.json({
    success: true,
    data: report,
  });
});

router.post('/generate-weekly', (req: Request, res: Response): void => {
  res.json({
    success: true,
    data: {
      reportId: 'report-new',
      message: '周报生成任务已提交，请稍后在列表中查看',
    },
  });
});

export default router;
