import { Router } from 'express';
import { successResponse } from '../../utils/response.js';

export const discountsRouter = Router();

discountsRouter.get('/', (req, res) => {
  return successResponse(res, {
    message: 'Discounts module scaffolded',
    data: { items: [] }
  });
});

