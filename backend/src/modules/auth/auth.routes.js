import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validateBody } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from './auth.validation.js';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), (req, res, next) => {
  return authController.register(req, res, next);
});

authRouter.post('/login', authRateLimiter, validateBody(loginSchema), (req, res, next) => {
  return authController.login(req, res, next);
});

authRouter.post('/refresh', validateBody(refreshSchema), (req, res, next) => {
  return authController.refresh(req, res, next);
});

authRouter.post('/logout', (req, res, next) => {
  return authController.logout(req, res, next);
});

authRouter.post('/forgot-password', authRateLimiter, validateBody(forgotPasswordSchema), (req, res, next) => {
  return authController.forgotPassword(req, res, next);
});

authRouter.post('/reset-password', validateBody(resetPasswordSchema), (req, res, next) => {
  return authController.resetPassword(req, res, next);
});

authRouter.get('/me', authenticate, (req, res) => {
  return authController.me(req, res);
});
