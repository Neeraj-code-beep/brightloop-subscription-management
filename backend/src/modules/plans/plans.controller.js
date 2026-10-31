import { plansService } from './plans.service.js';
import { successResponse } from '../../utils/response.js';

export class PlansController {
  async createPlan(req, res, next) {
    try {
      const plan = await plansService.createPlan(req.validatedBody);
      return successResponse(res, {
        statusCode: 201,
        message: 'Plan created successfully',
        data: plan
      });
    } catch (err) {
      next(err);
    }
  }

  async listPlans(req, res, next) {
    try {
      const result = await plansService.listPlans(req.query);
      return successResponse(res, {
        statusCode: 200,
        message: 'Plans retrieved successfully',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getPlanById(req, res, next) {
    try {
      const plan = await plansService.getPlanById(req.params.id);
      return successResponse(res, {
        statusCode: 200,
        message: 'Plan details retrieved successfully',
        data: plan
      });
    } catch (err) {
      next(err);
    }
  }

  async updatePlan(req, res, next) {
    try {
      const updated = await plansService.updatePlan(req.params.id, req.validatedBody);
      return successResponse(res, {
        statusCode: 200,
        message: 'Plan updated successfully',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  async updatePlanStatus(req, res, next) {
    try {
      const updated = await plansService.updatePlanStatus(req.params.id, req.validatedBody.isActive);
      return successResponse(res, {
        statusCode: 200,
        message: `Plan ${req.validatedBody.isActive ? 'activated' : 'deactivated'} successfully`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }
}

export const plansController = new PlansController();
