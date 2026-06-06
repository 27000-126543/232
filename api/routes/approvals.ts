import { Router, type Request, type Response } from 'express';
import { mockApprovals } from '../../shared/mockData.js';

let approvalsData = [...mockApprovals];

const router = Router();

router.get('/pending', (req: Request, res: Response): void => {
  const pending = approvalsData.filter((a) => a.status === 'pending');
  res.json({
    success: true,
    data: pending,
  });
});

router.get('/history', (req: Request, res: Response): void => {
  const history = approvalsData.filter((a) => a.status !== 'pending');
  res.json({
    success: true,
    data: history,
  });
});

router.post('/:id/approve', (req: Request, res: Response): void => {
  const { opinion, approve, step } = req.body;
  const approvalId = req.params.id;
  const index = approvalsData.findIndex((a) => a.id === approvalId);

  if (index === -1) {
    res.status(404).json({
      success: false,
      error: 'Approval not found',
    });
    return;
  }

  const approval = approvalsData[index];
  const stepIndex = approval.steps.findIndex((s) => s.step === step);

  if (stepIndex !== -1) {
    approval.steps[stepIndex] = {
      ...approval.steps[stepIndex],
      approver: '当前用户',
      opinion,
      approved: approve,
      approvedAt: new Date().toISOString(),
    };

    if (approve && step < 3) {
      approval.currentStep = (step + 1) as 1 | 2 | 3;
    } else if (!approve) {
      approval.status = 'rejected';
    } else if (approve && step === 3) {
      approval.status = 'approved';
    }
  }

  approvalsData[index] = { ...approval };

  res.json({
    success: true,
    data: approval,
  });
});

export default router;
