import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { authorizeOwnership } from '../../middleware/ownership.js';
import { validateBody } from '../../middleware/validate.js';
import { invoicesController } from './invoices.controller.js';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  issueInvoiceSchema,
  voidInvoiceSchema
} from './invoices.validation.js';

export const invoicesRouter = Router();

// Global authentication for all invoice routes
invoicesRouter.use(authenticate);

// POST /api/v1/invoices - Create manual invoice (ADMIN, STAFF)
invoicesRouter.post(
  '/',
  authorize('ADMIN', 'STAFF'),
  validateBody(createInvoiceSchema),
  invoicesController.createInvoice.bind(invoicesController)
);

// GET /api/v1/invoices - List invoices with dual pagination (ADMIN, STAFF, CUSTOMER own)
invoicesRouter.get(
  '/',
  invoicesController.listInvoices.bind(invoicesController)
);

// GET /api/v1/invoices/:id - Get invoice details (ADMIN, STAFF, CUSTOMER own)
invoicesRouter.get(
  '/:id',
  authorizeOwnership('invoice'),
  invoicesController.getInvoiceById.bind(invoicesController)
);

// PATCH /api/v1/invoices/:id - Update draft invoice (ADMIN, STAFF)
invoicesRouter.patch(
  '/:id',
  authorize('ADMIN', 'STAFF'),
  validateBody(updateInvoiceSchema),
  invoicesController.updateInvoice.bind(invoicesController)
);

// POST /api/v1/invoices/:id/issue - Issue draft invoice (ADMIN, STAFF)
invoicesRouter.post(
  '/:id/issue',
  authorize('ADMIN', 'STAFF'),
  validateBody(issueInvoiceSchema),
  invoicesController.issueInvoice.bind(invoicesController)
);

// POST /api/v1/invoices/:id/void - Void invoice (ADMIN, STAFF)
invoicesRouter.post(
  '/:id/void',
  authorize('ADMIN', 'STAFF'),
  validateBody(voidInvoiceSchema),
  invoicesController.voidInvoice.bind(invoicesController)
);
