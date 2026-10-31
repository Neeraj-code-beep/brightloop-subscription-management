/**
 * Standard API response envelope helpers conforming to shared/API_CONTRACT.md
 */

export function successResponse(res, { message = 'Operation successful', data = {}, statusCode = 200 }) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

export function errorResponse(res, { message = 'An error occurred', errors = [], statusCode = 500 }) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors
  });
}

