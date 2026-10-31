import { analyticsService } from './analytics.service.js';
import { successResponse } from '../../utils/response.js';

export class AnalyticsController {
  async getSummary(req, res, next) {
    try {
      const data = await analyticsService.getSummary();
      return successResponse(res, {
        message: 'Analytics summary retrieved successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getRevenue(req, res, next) {
    try {
      const data = await analyticsService.getRevenue(req.query);
      return successResponse(res, {
        message: 'Revenue analytics retrieved successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getMrr(req, res, next) {
    try {
      const data = await analyticsService.getMrr();
      return successResponse(res, {
        message: 'MRR analytics retrieved successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getArr(req, res, next) {
    try {
      const data = await analyticsService.getArr();
      return successResponse(res, {
        message: 'ARR analytics retrieved successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getCustomers(req, res, next) {
    try {
      const data = await analyticsService.getCustomers(req.query);
      return successResponse(res, {
        message: 'Customer analytics retrieved successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getSubscriptions(req, res, next) {
    try {
      const data = await analyticsService.getSubscriptions(req.query);
      return successResponse(res, {
        message: 'Subscription analytics retrieved successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getInvoices(req, res, next) {
    try {
      const data = await analyticsService.getInvoices();
      return successResponse(res, {
        message: 'Invoice analytics retrieved successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getPayments(req, res, next) {
    try {
      const data = await analyticsService.getPayments(req.query);
      return successResponse(res, {
        message: 'Payment analytics retrieved successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getOverdue(req, res, next) {
    try {
      const data = await analyticsService.getOverdueInvoices(req.query);
      return successResponse(res, {
        message: 'Overdue invoices analytics retrieved successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getDashboard(req, res, next) {
    try {
      const data = await analyticsService.getDashboard();
      return successResponse(res, {
        message: 'Dashboard metrics retrieved successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsController = new AnalyticsController();

