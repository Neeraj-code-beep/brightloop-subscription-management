import { Router } from 'express';
import { successResponse } from '../../utils/response.js';

export const taxesRouter = Router();

taxesRouter.get('/', (req, res) => {
  return successResponse(res, {
    message: 'Taxes module scaffolded',
    data: { items: [] }
  });
});

