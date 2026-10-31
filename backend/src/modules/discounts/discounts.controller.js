import { discountsService } from './discounts.service.js';
import { successResponse } from '../../utils/response.js';

export class DiscountsController {
  async createDiscount(req, res, next) {
    try {
      const discount = await discountsService.createDiscount(req.body);
      return successResponse(res, {
        message: 'Discount created successfully',
        data: discount,
        statusCode: 201
      });
    } catch (error) {
      next(error);
    }
  }

  async listDiscounts(req, res, next) {
    try {
      const result = await discountsService.listDiscounts(req.query);
      return successResponse(res, {
        message: 'Discounts retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getDiscountById(req, res, next) {
    try {
      const discount = await discountsService.getDiscountById(req.params.id);
      return successResponse(res, {
        message: 'Discount retrieved successfully',
        data: discount
      });
    } catch (error) {
      next(error);
    }
  }

  async updateDiscount(req, res, next) {
    try {
      const discount = await discountsService.updateDiscount(req.params.id, req.body);
      return successResponse(res, {
        message: 'Discount updated successfully',
        data: discount
      });
    } catch (error) {
      next(error);
    }
  }

  async updateDiscountStatus(req, res, next) {
    try {
      const discount = await discountsService.updateDiscountStatus(req.params.id, req.body.isActive);
      return successResponse(res, {
        message: `Discount status updated successfully to ${req.body.isActive ? 'ACTIVE' : 'INACTIVE'}`,
        data: discount
      });
    } catch (error) {
      next(error);
    }
  }

  async validateDiscount(req, res, next) {
    try {
      const customerId = req.body.customerId || (req.user?.role === 'CUSTOMER' ? (req.user.customer?.id || req.user.customerId) : null);
      const result = await discountsService.validateCoupon({
        code: req.body.code,
        customerId,
        purchaseAmount: req.body.purchaseAmount,
        currency: req.body.currency
      });

      return successResponse(res, {
        message: result.message,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const discountsController = new DiscountsController();

