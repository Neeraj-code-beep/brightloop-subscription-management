import { Router } from 'express';
import { successResponse } from '../../utils/response.js';

export const subscriptionsRouter = Router();

subscriptionsRouter.get('/', (req, res) => {
  return successResponse(res, {
    message: 'Subscriptions module scaffolded',
    data: { items: [], pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } }
  });
});

