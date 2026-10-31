import { taxesService } from './taxes.service.js';
import { successResponse } from '../../utils/response.js';

export class TaxesController {
  async createTax(req, res, next) {
    try {
      const tax = await taxesService.createTax(req.body);
      return successResponse(res, {
        message: 'Tax created successfully',
        data: tax,
        statusCode: 201
      });
    } catch (error) {
      next(error);
    }
  }

  async listTaxes(req, res, next) {
    try {
      const result = await taxesService.listTaxes(req.query);
      return successResponse(res, {
        message: 'Taxes retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getTaxById(req, res, next) {
    try {
      const tax = await taxesService.getTaxById(req.params.id);
      return successResponse(res, {
        message: 'Tax retrieved successfully',
        data: tax
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTax(req, res, next) {
    try {
      const tax = await taxesService.updateTax(req.params.id, req.body);
      return successResponse(res, {
        message: 'Tax updated successfully',
        data: tax
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTaxStatus(req, res, next) {
    try {
      const tax = await taxesService.updateTaxStatus(req.params.id, req.body.isActive);
      return successResponse(res, {
        message: `Tax status updated successfully to ${req.body.isActive ? 'ACTIVE' : 'INACTIVE'}`,
        data: tax
      });
    } catch (error) {
      next(error);
    }
  }
}

export const taxesController = new TaxesController();

