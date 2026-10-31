import { Router } from 'express';
import { customersController } from './customers.controller.js';
import { createCustomerSchema, updateCustomerStatusSchema } from './customers.validation.js';
import { creditsController } from '../credits/credits.controller.js';
import { adjustCreditSchema } from '../credits/credits.validation.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { authorizeOwnership } from '../../middleware/ownership.js';
import { validateBody } from '../../middleware/validate.js';

export const customersRouter = Router();

// Create customer (ADMIN, STAFF)
customersRouter.post(
  '/',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  validateBody(createCustomerSchema),
  customersController.create.bind(customersController)
);

// List customers with pagination, search, and filters (ADMIN, STAFF)
customersRouter.get(
  '/',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  customersController.list.bind(customersController)
);

// Get customer by ID (ADMIN, STAFF, CUSTOMER own record)
customersRouter.get(
  '/:id',
  authenticate,
  authorizeOwnership('customer', 'id'),
  customersController.getById.bind(customersController)
);

// Update customer fields (ADMIN, STAFF, CUSTOMER own permitted fields) - supports both PATCH and PUT
customersRouter.patch(
  '/:id',
  authenticate,
  authorizeOwnership('customer', 'id'),
  customersController.update.bind(customersController)
);
customersRouter.put(
  '/:id',
  authenticate,
  authorizeOwnership('customer', 'id'),
  customersController.update.bind(customersController)
);

// Activate/Deactivate customer status (ADMIN only)
customersRouter.patch(
  '/:id/status',
  authenticate,
  authorize('ADMIN'),
  validateBody(updateCustomerStatusSchema),
  customersController.updateStatus.bind(customersController)
);

// Get customer billing summary (ADMIN, STAFF, CUSTOMER own record)
customersRouter.get(
  '/:id/billing-summary',
  authenticate,
  authorizeOwnership('customer', 'id'),
  customersController.getBillingSummary.bind(customersController)
);

// Get customer subscriptions (ADMIN, STAFF, CUSTOMER own records)
customersRouter.get(
  '/:id/subscriptions',
  authenticate,
  authorizeOwnership('customer', 'id'),
  customersController.getSubscriptions.bind(customersController)
);

// Get customer invoices (ADMIN, STAFF, CUSTOMER own records)
customersRouter.get(
  '/:id/invoices',
  authenticate,
  authorizeOwnership('customer', 'id'),
  customersController.getInvoices.bind(customersController)
);

// Get customer payments (ADMIN, STAFF, CUSTOMER own records)
customersRouter.get(
  '/:id/payments',
  authenticate,
  authorizeOwnership('customer', 'id'),
  customersController.getPayments.bind(customersController)
);

// Customer credit balance (ADMIN, STAFF, CUSTOMER own record)
customersRouter.get(
  '/:id/credits',
  authenticate,
  authorizeOwnership('customer', 'id'),
  creditsController.getBalance.bind(creditsController)
);

// Customer credit transactions (ADMIN, STAFF, CUSTOMER own record)
customersRouter.get(
  '/:id/credits/transactions',
  authenticate,
  authorizeOwnership('customer', 'id'),
  creditsController.listTransactions.bind(creditsController)
);

// Adjust customer credit balance (ADMIN only)
customersRouter.post(
  '/:id/credits/adjust',
  authenticate,
  authorize('ADMIN'),
  validateBody(adjustCreditSchema),
  creditsController.adjustBalance.bind(creditsController)
);
