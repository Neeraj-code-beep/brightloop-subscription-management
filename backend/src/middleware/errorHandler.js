import { errorResponse } from '../utils/response.js';

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  const message = err.message || 'Internal Server Error';
  const errors = err.errors || (err.details ? [err.details] : []);

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Error] ${req.method} ${req.url}:`, err);
  }

  return errorResponse(res, {
    message,
    errors,
    statusCode
  });
}

