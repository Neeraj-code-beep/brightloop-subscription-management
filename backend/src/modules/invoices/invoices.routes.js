import { Router } from 'express';
import { successResponse } from '../../utils/response.js';
import { authenticate } from '../../middleware/auth.js';
import { authorizeOwnership } from '../../middleware/ownership.js';

export const invoicesRouter = Router();

invoicesRouter.get('/', authenticate, (req, res) => {
  return successResponse(res, {
    message: 'Invoices list retrieved',
    data: { items: [], pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } }
  });
});

invoicesRouter.get('/:id', authenticate, authorizeOwnership('invoice'), (req, res) => {
  return successResponse(res, {
    message: 'Invoice details retrieved successfully',
    data: req.resource || { id: req.params.id }
  });
});
