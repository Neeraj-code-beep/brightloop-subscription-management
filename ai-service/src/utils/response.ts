import { Response } from 'express';

export function successResponse(res: Response, { message = 'Operation successful', data = {}, statusCode = 200 }: { message?: string; data?: any; statusCode?: number }) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

export function errorResponse(res: Response, { message = 'An error occurred', errors = [], statusCode = 500 }: { message?: string; errors?: any[]; statusCode?: number }) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors
  });
}

