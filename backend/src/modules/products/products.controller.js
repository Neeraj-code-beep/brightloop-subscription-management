import { productsService } from './products.service.js';
import { successResponse } from '../../utils/response.js';

export class ProductsController {
  async create(req, res, next) {
    try {
      const product = await productsService.createProduct(req.validatedBody);
      return successResponse(res, {
        message: 'Product created successfully',
        data: product,
        statusCode: 201
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const result = await productsService.listProducts(req.query);
      return successResponse(res, {
        message: 'Products retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const product = await productsService.getProductById(req.params.id);
      return successResponse(res, {
        message: 'Product details retrieved successfully',
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const updated = await productsService.updateProduct(req.params.id, req.validatedBody);
      return successResponse(res, {
        message: 'Product updated successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const updated = await productsService.updateProductStatus(req.params.id, req.validatedBody.isActive);
      return successResponse(res, {
        message: `Product ${req.validatedBody.isActive ? 'activated' : 'deactivated'} successfully`,
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  // --- Variant Handlers ---

  async createVariant(req, res, next) {
    try {
      const variant = await productsService.createVariant(req.params.id, req.validatedBody);
      return successResponse(res, {
        message: 'Product variant created successfully',
        data: variant,
        statusCode: 201
      });
    } catch (error) {
      next(error);
    }
  }

  async listVariants(req, res, next) {
    try {
      const result = await productsService.listVariants(req.params.id, req.query);
      return successResponse(res, {
        message: 'Product variants retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async updateVariant(req, res, next) {
    try {
      const updated = await productsService.updateVariant(req.params.id, req.params.variantId, req.validatedBody);
      return successResponse(res, {
        message: 'Product variant updated successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  async updateVariantStatus(req, res, next) {
    try {
      const updated = await productsService.updateVariantStatus(req.params.id, req.params.variantId, req.validatedBody.isActive);
      return successResponse(res, {
        message: `Product variant ${req.validatedBody.isActive ? 'activated' : 'deactivated'} successfully`,
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  async calculatePrice(req, res, next) {
    try {
      const result = await productsService.calculateFinalPrice(req.params.id, req.validatedBody.variantIds);
      return successResponse(res, {
        message: 'Final price calculated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const productsController = new ProductsController();

