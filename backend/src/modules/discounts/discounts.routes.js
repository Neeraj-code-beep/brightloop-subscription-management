import { Router } from 'express';
import { discountsController } from './discounts.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { validateBody } from '../../middleware/validate.js';
import {
  createDiscountSchema,
  updateDiscountSchema,
  updateDiscountStatusSchema,
  validateDiscountSchema
} from './discounts.validation.js';

export const discountsRouter = Router();

// Require authentication for all discount endpoints
discountsRouter.use(authenticate);

discountsRouter.post(
  '/',
  authorize('ADMIN'),
  validateBody(createDiscountSchema),
  discountsController.createDiscount.bind(discountsController)
);

discountsRouter.get(
  '/',
  authorize('ADMIN', 'STAFF', 'CUSTOMER'),
  discountsController.listDiscounts.bind(discountsController)
);

// Validate coupon route MUST precede /:id to prevent route shadowing
discountsRouter.post(
  '/validate',
  authorize('ADMIN', 'STAFF', 'CUSTOMER'),
  validateBody(validateDiscountSchema),
  discountsController.validateDiscount.bind(discountsController)
);

discountsRouter.get(
  '/:id',
  authorize('ADMIN', 'STAFF', 'CUSTOMER'),
  discountsController.getDiscountById.bind(discountsController)
);

// PATCH & PUT /api/v1/discounts/:id - Update discount
discountsRouter.patch(
  '/:id',
  authorize('ADMIN'),
  validateBody(updateDiscountSchema),
  discountsController.updateDiscount.bind(discountsController)
);
discountsRouter.put(
  '/:id',
  authorize('ADMIN'),
  validateBody(updateDiscountSchema),
  discountsController.updateDiscount.bind(discountsController)
);

discountsRouter.patch(
  '/:id/status',
  authorize('ADMIN'),
  validateBody(updateDiscountStatusSchema),
  discountsController.updateDiscountStatus.bind(discountsController)
);
