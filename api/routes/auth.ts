import { Router, type Request, type Response } from 'express';
import { mockUsers } from '../../shared/mockData.js';

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  const user = mockUsers.find((u) => u.username === username);

  if (!user) {
    res.status(401).json({
      success: false,
      error: '用户名或密码错误',
    });
    return;
  }

  const token = `mock-token-${Date.now()}-${user.id}`;

  res.json({
    success: true,
    data: {
      token,
      user,
      permissions: user.permissions,
    },
  });
});

router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: '未登录',
    });
    return;
  }

  const token = authHeader.replace('Bearer ', '');
  const userId = token.split('-').pop();
  const user = mockUsers.find((u) => u.id === userId) || mockUsers[0];

  res.json({
    success: true,
    data: {
      user,
      permissions: user.permissions,
      dataScope: {
        level: user.role === 'hq' || user.role === 'director' ? 'national' : 'region',
        regionIds: user.regionId ? [user.regionId] : undefined,
      },
    },
  });
});

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    message: '登出成功',
  });
});

router.get('/users', async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: mockUsers,
  });
});

export default router;
