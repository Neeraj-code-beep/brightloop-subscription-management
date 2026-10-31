import { Router } from 'express';
import { successResponse } from '../../utils/response.js';

export const productsRouter = Router();

productsRouter.get('/', (req, res) => {
  return successResponse(res, {
    message: 'Products module scaffolded',
    data: { items: [] }
  });
});

