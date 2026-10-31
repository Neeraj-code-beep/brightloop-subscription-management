import { Router } from 'express';
import { taxesController } from './taxes.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { validateBody } from '../../middleware/validate.js';
import { createTaxSchema, updateTaxSchema, updateTaxStatusSchema } from './taxes.validation.js';

export const taxesRouter = Router();

// Require authentication for all tax endpoints
taxesRouter.use(authenticate);

taxesRouter.post(
  '/',
  authorize('ADMIN'),
  validateBody(createTaxSchema),
  taxesController.createTax.bind(taxesController)
);

taxesRouter.get(
  '/',
  authorize('ADMIN', 'STAFF', 'CUSTOMER'),
  taxesController.listTaxes.bind(taxesController)
);

taxesRouter.get(
  '/:id',
  authorize('ADMIN', 'STAFF', 'CUSTOMER'),
  taxesController.getTaxById.bind(taxesController)
);

// PATCH & PUT /api/v1/taxes/:id - Update tax rule
taxesRouter.patch(
  '/:id',
  authorize('ADMIN'),
  validateBody(updateTaxSchema),
  taxesController.updateTax.bind(taxesController)
);
taxesRouter.put(
  '/:id',
  authorize('ADMIN'),
  validateBody(updateTaxSchema),
  taxesController.updateTax.bind(taxesController)
);

taxesRouter.patch(
  '/:id/status',
  authorize('ADMIN'),
  validateBody(updateTaxStatusSchema),
  taxesController.updateTaxStatus.bind(taxesController)
);
