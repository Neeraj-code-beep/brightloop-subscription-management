import { paymentsService } from './payments.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export class PaymentsController {
  /**
   * POST /api/v1/payments
   * Record manual payment (ADMIN, STAFF)
   */
  async recordPayment(req, res, next) {
    try {
      const result = await paymentsService.recordManualPayment(req.body);
      return successResponse(res, {
        message: result.isDuplicate ? result.message : 'Payment recorded successfully',
        data: {
          ...result.payment,
          isDuplicate: Boolean(result.isDuplicate),
          isIdempotentReplay: Boolean(result.isDuplicate)
        },
        statusCode: result.isDuplicate ? 200 : 201
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/payments
   * List payments with dual pagination, search, and filters (ADMIN, STAFF, CUSTOMER own)
   */
  async listPayments(req, res, next) {
    try {
      const result = await paymentsService.listPayments({
        user: req.user,
        customerId: req.query.customerId,
        invoiceId: req.query.invoiceId,
        status: req.query.status,
        paymentMethod: req.query.paymentMethod,
        provider: req.query.provider,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit,
        cursor: req.query.cursor,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder
      });

      return successResponse(res, {
        message: 'Payments retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/payments/:id
   * Get payment details (ADMIN, STAFF, CUSTOMER own)
   */
  async getPaymentById(req, res, next) {
    try {
      const payment = await paymentsService.getPaymentById(req.params.id, req.user);
      return successResponse(res, {
        message: 'Payment details retrieved successfully',
        data: payment
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/invoices/:id/payments
   * Get payments for an invoice
   */
  async getInvoicePayments(req, res, next) {
    try {
      const payments = await paymentsService.getInvoicePayments(req.params.id, req.user);
      return successResponse(res, {
        message: 'Invoice payments retrieved successfully',
        data: { items: payments }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/customers/:id/payments
   * Customer payment history with dual pagination
   */
  async getCustomerPayments(req, res, next) {
    try {
      const result = await paymentsService.listPayments({
        user: req.user,
        customerId: req.params.id,
        status: req.query.status,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit,
        cursor: req.query.cursor,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder
      });

      return successResponse(res, {
        message: 'Customer payment history retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/:id/refund
   * Initiate or record a refund (ADMIN, STAFF)
   */
  async processRefund(req, res, next) {
    try {
      const result = await paymentsService.processRefund(req.params.id, req.body);
      return successResponse(res, {
        message: result.isDuplicate ? (result.message || 'Refund already processed') : 'Refund processed successfully',
        data: {
          ...result.refund,
          refund: result.refund,
          payment: result.payment,
          isDuplicate: Boolean(result.isDuplicate),
          isIdempotentReplay: Boolean(result.isDuplicate)
        },
        statusCode: result.isDuplicate ? 200 : 201
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/:id/mark-failed
   * Record failed payment (ADMIN, STAFF)
   */
  async markFailed(req, res, next) {
    try {
      const updated = await paymentsService.recordFailedPayment(req.params.id, req.body);
      return successResponse(res, {
        message: 'Payment marked as failed',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/webhooks/:provider
   * Ingest payment provider webhook (Public with signature check)
   */
  async processWebhook(req, res, next) {
    try {
      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
      const result = await paymentsService.processWebhook(
        req.params.provider,
        rawBody,
        req.headers,
        req.body
      );

      return successResponse(res, {
        message: 'Webhook processed successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/payments/reconciliation/summary
   * Summary of system-wide reconciliation (ADMIN, STAFF)
   */
  async getReconciliationSummary(req, res, next) {
    try {
      const summary = await paymentsService.getReconciliationSummary();
      return successResponse(res, {
        message: 'Reconciliation summary retrieved successfully',
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/payments/reconciliation/unmatched
   * List unmatched payments & discrepancies (ADMIN, STAFF)
   */
  async getUnmatchedPayments(req, res, next) {
    try {
      const unmatched = await paymentsService.getUnmatchedPayments();
      return successResponse(res, {
        message: 'Unmatched payments retrieved successfully',
        data: unmatched
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/reconciliation/run
   * Execute reconciliation sweep (ADMIN only)
   */
  async runReconciliation(req, res, next) {
    try {
      const result = await paymentsService.runReconciliation();
      return successResponse(res, {
        message: 'Reconciliation completed successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentsController = new PaymentsController();
