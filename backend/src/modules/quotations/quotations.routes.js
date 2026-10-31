import { Router } from 'express';
import { successResponse } from '../../utils/response.js';

export const quotationsRouter = Router();

quotationsRouter.get('/', (req, res) => {
  return successResponse(res, {
    message: 'Quotations module scaffolded',
    data: { items: [] }
  });
});

