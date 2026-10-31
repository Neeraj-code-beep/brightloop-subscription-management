import rateLimit from 'express-rate-limit';
import { errorResponse } from '../utils/response.js';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 login/auth attempts per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test', // Bypass in test environment
  handler: (req, res) => {
    return errorResponse(res, {
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
      statusCode: 429
    });
  }
});

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 AI requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test', // Bypass in test environment
  handler: (req, res) => {
    return errorResponse(res, {
      message: 'Too many requests to the AI service. Please slow down and try again later.',
      statusCode: 429
    });
  }
});
