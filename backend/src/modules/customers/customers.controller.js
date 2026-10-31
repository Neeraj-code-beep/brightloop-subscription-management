import { customersService } from './customers.service.js';
import { updateCustomerAdminSchema, updateCustomerSelfSchema } from './customers.validation.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export class CustomersController {
  /**
   * POST /api/v1/customers
   * Access: ADMIN, STAFF
   */
  async create(req, res, next) {
    try {
      const result = await customersService.createCustomer(req.validatedBody, req.user);
      return successResponse(res, {
        message: 'Customer created successfully',
        data: result,
        statusCode: 201
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/customers
   * Access: ADMIN, STAFF
   */
  async list(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const { search, customerType, isActive, sortBy, sortOrder } = req.query;

      const result = await customersService.listCustomers({
        page,
        limit,
        search,
        customerType,
        isActive,
        sortBy,
        sortOrder
      });

      return successResponse(res, {
        message: 'Customers retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/customers/:id
   * Access: ADMIN, STAFF, CUSTOMER (own record)
   */
  async getById(req, res, next) {
    try {
      const customer = await customersService.getCustomerById(req.params.id);
      return successResponse(res, {
        message: 'Customer retrieved successfully',
        data: customer
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/customers/:id
   * Access: ADMIN, STAFF (operational fields), CUSTOMER (own permitted fields)
   */
  async update(req, res, next) {
    try {
      // Role-specific schema validation
      const schema = req.user.role === 'CUSTOMER'
        ? updateCustomerSelfSchema
        : updateCustomerAdminSchema;

      const parseResult = schema.safeParse(req.body);
      if (!parseResult.success) {
        const errors = parseResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        return errorResponse(res, {
          message: 'Validation failed',
          errors,
          statusCode: 422
        });
      }

      const updated = await customersService.updateCustomer(req.params.id, parseResult.data);
      return successResponse(res, {
        message: 'Customer updated successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/customers/:id/status
   * Access: ADMIN only
   */
  async updateStatus(req, res, next) {
    try {
      const updated = await customersService.updateCustomerStatus(req.params.id, req.validatedBody.isActive);
      return successResponse(res, {
        message: `Customer ${req.validatedBody.isActive ? 'activated' : 'deactivated'} successfully`,
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/customers/:id/subscriptions
   * Access: ADMIN, STAFF, CUSTOMER (own record)
   */
  async getSubscriptions(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

      const result = await customersService.getCustomerSubscriptions(req.params.id, { page, limit });
      return successResponse(res, {
        message: 'Customer subscriptions retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/customers/:id/invoices
   * Access: ADMIN, STAFF, CUSTOMER (own record)
   */
  async getInvoices(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

      const result = await customersService.getCustomerInvoices(req.params.id, { page, limit });
      return successResponse(res, {
        message: 'Customer invoices retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/customers/:id/payments
   * Access: ADMIN, STAFF, CUSTOMER (own record)
   */
  async getPayments(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

      const result = await customersService.getCustomerPayments(req.params.id, { page, limit });
      return successResponse(res, {
        message: 'Customer payments retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const customersController = new CustomersController();
