import { creditsService } from './credits.service.js';
import { successResponse } from '../../utils/response.js';

export class CreditsController {
  /**
   * GET /api/v1/customers/:id/credits
   */
  async getBalance(req, res, next) {
    try {
      const { id } = req.params;
      const data = await creditsService.getBalance(id);
      return successResponse(res, {
        message: 'Customer credit balance retrieved successfully',
        data
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/customers/:id/credits/transactions
   */
  async listTransactions(req, res, next) {
    try {
      const { id } = req.params;
      const { page, limit, type } = req.query;
      const data = await creditsService.listTransactions(id, { page, limit, type });
      return successResponse(res, {
        message: 'Customer credit transactions retrieved successfully',
        data: data.items,
        pagination: data.pagination
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/customers/:id/credits/adjust
   */
  async adjustBalance(req, res, next) {
    try {
      const { id } = req.params;
      const { amount, reason, idempotencyKey } = req.body;
      const data = await creditsService.adjustBalance({
        customerId: id,
        amount,
        reason,
        idempotencyKey,
        adminUserId: req.user?.id
      });
      return successResponse(res, {
        statusCode: 201,
        message: 'Customer credit adjusted successfully',
        data
      });
    } catch (err) {
      next(err);
    }
  }
}

export const creditsController = new CreditsController();
