import { Router } from 'express';
import { successResponse } from '../../utils/response.js';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  return successResponse(res, {
    message: 'Auth module ready for implementation',
    data: { status: 'scaffolded' }
  });
});

authRouter.post('/register', (req, res) => {
  return successResponse(res, {
    message: 'Auth registration ready for implementation',
    data: { status: 'scaffolded' },
    statusCode: 201
  });
});

