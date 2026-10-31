import { Router } from 'express';
import { successResponse } from '../../utils/response.js';

export const usersRouter = Router();

usersRouter.get('/', (req, res) => {
  return successResponse(res, {
    message: 'Users module scaffolded',
    data: { items: [] }
  });
});

