import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { authorizeOwnership } from '../../middleware/ownership.js';
import { validateBody } from '../../middleware/validate.js';
import { quotationsController } from './quotations.controller.js';
import {
  createQuotationSchema,
  updateQuotationSchema,
  updateQuotationStatusSchema,
  convertQuotationSchema
} from './quotations.validation.js';

export const quotationsRouter = Router();

// Global authentication for all quotation endpoints
quotationsRouter.use(authenticate);

// POST /api/v1/quotations - Create quotation (ADMIN, STAFF)
quotationsRouter.post(
  '/',
  authorize('ADMIN', 'STAFF'),
  validateBody(createQuotationSchema),
  quotationsController.createQuotation
);

// GET /api/v1/quotations - List quotations with dual pagination (ADMIN, STAFF, CUSTOMER own)
quotationsRouter.get(
  '/',
  quotationsController.listQuotations
);

// GET /api/v1/quotations/:id - Get quotation details (ADMIN, STAFF, CUSTOMER own)
quotationsRouter.get(
  '/:id',
  authorizeOwnership('quotation'),
  quotationsController.getQuotationById
);

// PATCH /api/v1/quotations/:id - Update draft quotation (ADMIN, STAFF)
quotationsRouter.patch(
  '/:id',
  authorize('ADMIN', 'STAFF'),
  validateBody(updateQuotationSchema),
  quotationsController.updateQuotation
);

// PATCH /api/v1/quotations/:id/status - Change quotation status (ADMIN, STAFF)
quotationsRouter.patch(
  '/:id/status',
  authorize('ADMIN', 'STAFF'),
  validateBody(updateQuotationStatusSchema),
  quotationsController.updateQuotationStatus
);

// POST /api/v1/quotations/:id/send - Mark quotation as sent (ADMIN, STAFF)
quotationsRouter.post(
  '/:id/send',
  authorize('ADMIN', 'STAFF'),
  quotationsController.sendQuotation
);

// POST /api/v1/quotations/:id/convert - Convert accepted quotation to subscription (ADMIN, STAFF)
quotationsRouter.post(
  '/:id/convert',
  authorize('ADMIN', 'STAFF'),
  validateBody(convertQuotationSchema),
  quotationsController.convertQuotation
);
