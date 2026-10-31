import { invoicesService } from './invoices.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export class InvoicesController {
  /**
   * POST /api/v1/invoices
   * Create a manual invoice (ADMIN, STAFF)
   */
  async createInvoice(req, res, next) {
    try {
      const invoice = await invoicesService.createInvoice(req.body);
      return successResponse(res, {
        message: 'Invoice created successfully',
        data: invoice,
        statusCode: 201
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/invoices
   * List invoices with dual pagination, search, and filters (ADMIN, STAFF, CUSTOMER own)
   */
  async listInvoices(req, res, next) {
    try {
      const result = await invoicesService.listInvoices({
        user: req.user,
        customerId: req.query.customerId,
        subscriptionId: req.query.subscriptionId,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        dueDateStart: req.query.dueDateStart,
        dueDateEnd: req.query.dueDateEnd,
        isOverdue: req.query.isOverdue,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit,
        cursor: req.query.cursor,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder
      });

      return successResponse(res, {
        message: 'Invoices retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/invoices/:id
   * Get invoice details (ADMIN, STAFF, CUSTOMER own)
   */
  async getInvoiceById(req, res, next) {
    try {
      const invoice = await invoicesService.getInvoiceById(req.params.id, req.user);
      return successResponse(res, {
        message: 'Invoice details retrieved successfully',
        data: invoice
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/invoices/:id
   * Update draft invoice (ADMIN, STAFF)
   */
  async updateInvoice(req, res, next) {
    try {
      const updated = await invoicesService.updateInvoice(req.params.id, req.body);
      return successResponse(res, {
        message: 'Invoice updated successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/invoices/:id/issue
   * Issue draft invoice (ADMIN, STAFF)
   */
  async issueInvoice(req, res, next) {
    try {
      const issued = await invoicesService.issueInvoice(req.params.id, req.body);
      return successResponse(res, {
        message: 'Invoice issued successfully',
        data: issued
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/invoices/:id/void
   * Void invoice (ADMIN, STAFF)
   */
  async voidInvoice(req, res, next) {
    try {
      const voided = await invoicesService.voidInvoice(req.params.id, req.body);
      return successResponse(res, {
        message: 'Invoice voided successfully',
        data: voided
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/customers/:id/invoices
   * List customer's invoices with dual pagination
   */
  async getCustomerInvoices(req, res, next) {
    try {
      const result = await invoicesService.listInvoices({
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
        message: 'Customer invoices retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/subscriptions/:id/invoices
   * List subscription's invoices with dual pagination
   */
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
        message: 'Subscription invoices retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const invoicesController = new InvoicesController();
