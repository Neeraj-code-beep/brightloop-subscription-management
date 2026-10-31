import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { authorizeOwnership } from '../../middleware/ownership.js';
import { validateBody } from '../../middleware/validate.js';
import { paymentsController } from './payments.controller.js';
import {
  recordPaymentSchema,
  recordRefundSchema,
  markFailedSchema
} from './payments.validation.js';

export const paymentsRouter = Router();

// =========================================================================
// 1. Webhooks (Public with provider signature verification)
// =========================================================================
paymentsRouter.post(
  '/webhooks/:provider',
  paymentsController.processWebhook.bind(paymentsController)
);

// Global authentication for remaining payment endpoints
paymentsRouter.use(authenticate);

// =========================================================================
// 2. Reconciliation Endpoints (Must be mounted before /:id)
// =========================================================================
paymentsRouter.get(
  '/reconciliation/summary',
  authorize('ADMIN', 'STAFF'),
  paymentsController.getReconciliationSummary.bind(paymentsController)
);

paymentsRouter.get(
  '/reconciliation/unmatched',
  authorize('ADMIN', 'STAFF'),
  paymentsController.getUnmatchedPayments.bind(paymentsController)
);

paymentsRouter.post(
  '/reconciliation/run',
  authorize('ADMIN'),
  paymentsController.runReconciliation.bind(paymentsController)
);

// =========================================================================
// 3. Payment Collection Endpoints
// =========================================================================
// POST /api/v1/payments - Record manual payment (ADMIN, STAFF)
paymentsRouter.post(
  '/',
  authorize('ADMIN', 'STAFF'),
  validateBody(recordPaymentSchema),
  paymentsController.recordPayment.bind(paymentsController)
);

// GET /api/v1/payments - List payments with dual pagination (ADMIN, STAFF, CUSTOMER own)
paymentsRouter.get(
  '/',
  paymentsController.listPayments.bind(paymentsController)
);

// =========================================================================
// 4. Single Payment Endpoints
// =========================================================================
// GET /api/v1/payments/:id - Payment details (ADMIN, STAFF, CUSTOMER own)
paymentsRouter.get(
  '/:id',
  authorizeOwnership('payment'),
  paymentsController.getPaymentById.bind(paymentsController)
);

// POST /api/v1/payments/:id/refund - Initiate or record a refund (ADMIN, STAFF)
paymentsRouter.post(
  '/:id/refund',
  authorize('ADMIN', 'STAFF'),
  validateBody(recordRefundSchema),
  paymentsController.processRefund.bind(paymentsController)
);

// POST /api/v1/payments/:id/mark-failed - Record failed payment (ADMIN, STAFF)
paymentsRouter.post(
  '/:id/mark-failed',
  authorize('ADMIN', 'STAFF'),
  validateBody(markFailedSchema),
  paymentsController.markFailed.bind(paymentsController)
);
