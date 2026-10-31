import { Router } from 'express';
import { successResponse } from '../../utils/response.js';

export const analyticsRouter = Router();

analyticsRouter.get('/dashboard', (req, res) => {
  return successResponse(res, {
    message: 'Analytics dashboard metrics scaffolded',
    data: {
      mrrInCents: 0,
      arrInCents: 0,
      activeSubscriptions: 0,
      outstandingInvoicesCount: 0,
      totalOutstandingInCents: 0
    }
  });
});

