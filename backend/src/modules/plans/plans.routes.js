import { Router } from 'express';
import { successResponse } from '../../utils/response.js';

export const plansRouter = Router();

plansRouter.get('/', (req, res) => {
  return successResponse(res, {
    message: 'Plans module scaffolded',
    data: { items: [] }
  });
});

