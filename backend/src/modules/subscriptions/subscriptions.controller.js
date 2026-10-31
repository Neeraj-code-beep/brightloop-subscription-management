import { subscriptionsService } from './subscriptions.service.js';
import { invoicesService } from '../invoices/invoices.service.js';
import { successResponse } from '../../utils/response.js';

export class SubscriptionsController {
  async createSubscription(req, res, next) {
    try {
      const subscription = await subscriptionsService.createSubscription(req.validatedBody);
      return successResponse(res, {
        statusCode: 201,
        message: 'Subscription created successfully',
        data: subscription
      });
    } catch (err) {
      next(err);
    }
  }

  async listSubscriptions(req, res, next) {
    try {
      const result = await subscriptionsService.listSubscriptions(req.query, req.user);
      return successResponse(res, {
        statusCode: 200,
        message: 'Subscriptions retrieved successfully',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getSubscriptionById(req, res, next) {
    try {
      const subscription = await subscriptionsService.getSubscriptionById(req.params.id, req.user);
      return successResponse(res, {
        statusCode: 200,
        message: 'Subscription details retrieved successfully',
        data: subscription
      });
    } catch (err) {
      next(err);
    }
  }

  async updateSubscription(req, res, next) {
    try {
      const updated = await subscriptionsService.updateSubscription(req.params.id, req.validatedBody);
      return successResponse(res, {
        statusCode: 200,
        message: 'Subscription updated successfully',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  async updateSubscriptionStatus(req, res, next) {
    try {
      const updated = await subscriptionsService.updateSubscriptionStatus(req.params.id, req.validatedBody.status);
      return successResponse(res, {
        statusCode: 200,
        message: `Subscription status updated to ${req.validatedBody.status}`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  async pauseSubscription(req, res, next) {
    try {
      const updated = await subscriptionsService.pauseSubscription(req.params.id);
      return successResponse(res, {
        statusCode: 200,
        message: 'Subscription paused successfully',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  async resumeSubscription(req, res, next) {
    try {
      const updated = await subscriptionsService.resumeSubscription(req.params.id);
      return successResponse(res, {
        statusCode: 200,
        message: 'Subscription resumed successfully',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  async cancelSubscription(req, res, next) {
    try {
      const updated = await subscriptionsService.cancelSubscription(req.params.id, req.validatedBody);
      return successResponse(res, {
        statusCode: 200,
        message: req.validatedBody.immediate
          ? 'Subscription cancelled immediately'
          : 'Subscription scheduled for cancellation at period end',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }
  async getSubscriptionInvoices(req, res, next) {
    try {
      const result = await invoicesService.listInvoices({
        user: req.user,
        subscriptionId: req.params.id,
        status: req.query.status,
        page: req.query.page,
        limit: req.query.limit,
        cursor: req.query.cursor,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder
      });
      return successResponse(res, {
        statusCode: 200,
        message: 'Subscription invoices retrieved successfully',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/subscriptions/:id/preview-migration
   * Pure read calculation, zero DB mutations.
   */
  async previewMigration(req, res, next) {
    try {
      const { id } = req.params;
      const result = await subscriptionsService.previewMigration(id, req.body);
      return successResponse(res, {
        statusCode: 200,
        message: 'Plan migration calculation preview generated successfully',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/subscriptions/:id/migrate-plan
   * Atomic plan migration execution.
   */
  async migratePlan(req, res, next) {
    try {
      const { id } = req.params;
      const result = await subscriptionsService.migratePlan(id, req.body, req.user);
      return successResponse(res, {
        statusCode: result.isDuplicate ? 200 : 201,
        message: result.message || 'Plan migrated successfully',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/subscriptions/:id/cancel-scheduled-migration
   * Cancel pending scheduled plan change.
   */
  async cancelScheduledMigration(req, res, next) {
    try {
      const { id } = req.params;
      const result = await subscriptionsService.cancelScheduledMigration(id, req.user);
      return successResponse(res, {
        statusCode: 200,
        message: result.message || 'Scheduled plan migration cancelled successfully',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/subscriptions/:id/migrations
   * List migration history for subscription.
   */
  async listMigrations(req, res, next) {
    try {
      const { id } = req.params;
      const result = await subscriptionsService.listMigrations(id);
      return successResponse(res, {
        statusCode: 200,
        message: 'Subscription migration history retrieved successfully',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

export const subscriptionsController = new SubscriptionsController();

