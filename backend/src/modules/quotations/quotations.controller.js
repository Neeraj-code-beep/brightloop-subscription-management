import { quotationsService } from './quotations.service.js';
import { successResponse } from '../../utils/response.js';

export class QuotationsController {
  async createQuotation(req, res, next) {
    try {
      const quotation = await quotationsService.createQuotation(req.validatedBody);
      return successResponse(res, {
        statusCode: 201,
        message: 'Quotation created successfully in DRAFT status',
        data: quotation
      });
    } catch (err) {
      next(err);
    }
  }

  async listQuotations(req, res, next) {
    try {
      const result = await quotationsService.listQuotations(req.query, req.user);
      return successResponse(res, {
        statusCode: 200,
        message: 'Quotations retrieved successfully',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getQuotationById(req, res, next) {
    try {
      const quotation = await quotationsService.getQuotationById(req.params.id, req.user);
      return successResponse(res, {
        statusCode: 200,
        message: 'Quotation details retrieved successfully',
        data: quotation
      });
    } catch (err) {
      next(err);
    }
  }

  async updateQuotation(req, res, next) {
    try {
      const updated = await quotationsService.updateQuotation(req.params.id, req.validatedBody);
      return successResponse(res, {
        statusCode: 200,
        message: 'Quotation updated successfully',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  async updateQuotationStatus(req, res, next) {
    try {
      const updated = await quotationsService.updateQuotationStatus(req.params.id, req.validatedBody.status);
      return successResponse(res, {
        statusCode: 200,
        message: `Quotation status updated to ${req.validatedBody.status}`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  async sendQuotation(req, res, next) {
    try {
      const updated = await quotationsService.sendQuotation(req.params.id);
      return successResponse(res, {
        statusCode: 200,
        message: 'Quotation marked as SENT successfully',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  async convertQuotation(req, res, next) {
    try {
      const result = await quotationsService.convertQuotation(req.params.id, req.body || {});
      return successResponse(res, {
        statusCode: 201,
        message: 'Quotation successfully converted to active subscription',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

export const quotationsController = new QuotationsController();

