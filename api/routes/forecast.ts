import { Router, type Request, type Response } from 'express';
import { getForecast72h, mockRecommendations, mockCommunityEvents } from '../../shared/mockData.js';

const router = Router();

router.get('/72h', (req: Request, res: Response): void => {
  const regionId = req.query.regionId as string;
  const forecast = getForecast72h(regionId);
  res.json({
    success: true,
    data: forecast,
  });
});

router.get('/recommendations', (req: Request, res: Response): void => {
  res.json({
    success: true,
    data: mockRecommendations,
  });
});

router.get('/events', (req: Request, res: Response): void => {
  res.json({
    success: true,
    data: mockCommunityEvents,
  });
});

router.post('/upload', (req: Request, res: Response): void => {
  res.json({
    success: true,
    data: {
      extracted: true,
      events: mockCommunityEvents,
      message: '文件上传成功，已提取2个活动信息',
    },
  });
});

export default router;
