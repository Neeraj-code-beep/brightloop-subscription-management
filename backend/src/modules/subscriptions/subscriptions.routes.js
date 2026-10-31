import { Router } from 'express';
import { successResponse } from '../../utils/response.js';
import { authenticate } from '../../middleware/auth.js';
import { authorizeOwnership } from '../../middleware/ownership.js';

export const subscriptionsRouter = Router();

subscriptionsRouter.get('/', authenticate, (req, res) => {
  return successResponse(res, {
    message: 'Subscriptions list retrieved',
    data: { items: [], pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } }
  });
});

subscriptionsRouter.get('/:id', authenticate, authorizeOwnership('subscription'), (req, res) => {
  return successResponse(res, {
    message: 'Subscription details retrieved successfully',
    data: req.resource || { id: req.params.id }
  });
});
