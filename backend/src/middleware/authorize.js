import { errorResponse } from '../utils/response.js';

/**
 * Reusable Role-Based Access Control middleware
 * Validates that authenticated user has one of the required roles
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, {
        message: 'Authentication required before checking permissions',
        statusCode: 401
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(res, {
        message: 'Access denied: insufficient permissions',
        statusCode: 403
      });
    }

    next();
  };
}

