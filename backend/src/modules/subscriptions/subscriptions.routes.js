import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { authorizeOwnership } from '../../middleware/ownership.js';
import { validateBody } from '../../middleware/validate.js';
import { subscriptionsController } from './subscriptions.controller.js';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  updateSubscriptionStatusSchema,
  cancelSubscriptionSchema,
  previewMigrationSchema,
  migratePlanSchema
} from './subscriptions.validation.js';

export const subscriptionsRouter = Router();

// Global authentication for all subscription endpoints
subscriptionsRouter.use(authenticate);

// POST /api/v1/subscriptions - Create subscription (ADMIN, STAFF)
subscriptionsRouter.post(
  '/',
  authorize('ADMIN', 'STAFF'),
  validateBody(createSubscriptionSchema),
  subscriptionsController.createSubscription
);

// GET /api/v1/subscriptions - List subscriptions with dual pagination (ADMIN, STAFF, CUSTOMER own)
subscriptionsRouter.get(
  '/',
  subscriptionsController.listSubscriptions
);

// GET /api/v1/subscriptions/:id - Get subscription details (ADMIN, STAFF, CUSTOMER own)
subscriptionsRouter.get(
  '/:id',
  authorizeOwnership('subscription'),
  subscriptionsController.getSubscriptionById
);

// GET /api/v1/subscriptions/:id/invoices - List subscription invoices
subscriptionsRouter.get(
  '/:id/invoices',
  authorizeOwnership('subscription'),
  subscriptionsController.getSubscriptionInvoices.bind(subscriptionsController)
);

// PATCH /api/v1/subscriptions/:id - Update subscription permitted fields (ADMIN, STAFF)
subscriptionsRouter.patch(
  '/:id',
  authorize('ADMIN', 'STAFF'),
  validateBody(updateSubscriptionSchema),
  subscriptionsController.updateSubscription
);

// PATCH /api/v1/subscriptions/:id/status - Change subscription status (ADMIN, STAFF)
subscriptionsRouter.patch(
  '/:id/status',
  authorize('ADMIN', 'STAFF'),
  validateBody(updateSubscriptionStatusSchema),
  subscriptionsController.updateSubscriptionStatus
);

// POST & PATCH /api/v1/subscriptions/:id/pause - Pause active subscription (ADMIN, STAFF)
subscriptionsRouter.post(
  '/:id/pause',
  authorize('ADMIN', 'STAFF'),
  subscriptionsController.pauseSubscription
);
subscriptionsRouter.patch(
  '/:id/pause',
  authorize('ADMIN', 'STAFF'),
  subscriptionsController.pauseSubscription
);

// POST & PATCH /api/v1/subscriptions/:id/resume - Resume paused subscription (ADMIN, STAFF)
subscriptionsRouter.post(
  '/:id/resume',
  authorize('ADMIN', 'STAFF'),
  subscriptionsController.resumeSubscription
);
subscriptionsRouter.patch(
  '/:id/resume',
  authorize('ADMIN', 'STAFF'),
  subscriptionsController.resumeSubscription
);

// POST & PATCH /api/v1/subscriptions/:id/cancel - Cancel subscription (ADMIN, STAFF)
subscriptionsRouter.post(
  '/:id/cancel',
  authorize('ADMIN', 'STAFF'),
  validateBody(cancelSubscriptionSchema),
  subscriptionsController.cancelSubscription
);
subscriptionsRouter.patch(
  '/:id/cancel',
  authorize('ADMIN', 'STAFF'),
  validateBody(cancelSubscriptionSchema),
  subscriptionsController.cancelSubscription
);

// POST /api/v1/subscriptions/:id/preview-migration - Preview proration calculation
subscriptionsRouter.post(
  '/:id/preview-migration',
  authorizeOwnership('subscription'),
  validateBody(previewMigrationSchema),
  subscriptionsController.previewMigration.bind(subscriptionsController)
);

// POST /api/v1/subscriptions/:id/migrate-plan - Execute plan migration
subscriptionsRouter.post(
  '/:id/migrate-plan',
  authorizeOwnership('subscription'),
  validateBody(migratePlanSchema),
  subscriptionsController.migratePlan.bind(subscriptionsController)
);

// POST /api/v1/subscriptions/:id/cancel-scheduled-migration - Cancel scheduled plan migration
subscriptionsRouter.post(
  '/:id/cancel-scheduled-migration',
  authorizeOwnership('subscription'),
  subscriptionsController.cancelScheduledMigration.bind(subscriptionsController)
);

// GET /api/v1/subscriptions/:id/migrations - List migration history
subscriptionsRouter.get(
  '/:id/migrations',
  authorizeOwnership('subscription'),
  subscriptionsController.listMigrations.bind(subscriptionsController)
);
