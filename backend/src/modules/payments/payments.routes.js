import { Router } from 'express';
import { successResponse } from '../../utils/response.js';

export const paymentsRouter = Router();

paymentsRouter.get('/', (req, res) => {
  return successResponse(res, {
    message: 'Payments module scaffolded',
    data: { items: [], pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } }
  });
});

