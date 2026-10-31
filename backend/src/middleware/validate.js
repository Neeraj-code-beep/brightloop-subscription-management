import { errorResponse } from '../utils/response.js';

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return errorResponse(res, {
        message: 'Validation failed',
        errors,
        statusCode: 422
      });
    }
    req.validatedBody = result.data;
    next();
  };
}

