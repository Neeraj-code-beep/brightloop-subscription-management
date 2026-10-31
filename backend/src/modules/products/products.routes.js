import { Router } from 'express';
import { productsController } from './products.controller.js';
import {
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
  createVariantSchema,
  updateVariantSchema,
  updateVariantStatusSchema,
  calculatePriceSchema
} from './products.validation.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { validateBody } from '../../middleware/validate.js';

export const productsRouter = Router();

// Global auth and RBAC for all product routes (ADMIN and STAFF allowed; CUSTOMER blocked)
productsRouter.use(authenticate, authorize('ADMIN', 'STAFF'));

// --- Product Endpoints ---

// POST /api/v1/products - Create product
productsRouter.post(
  '/',
  validateBody(createProductSchema),
  productsController.create.bind(productsController)
);

// GET /api/v1/products - List products (Dual pagination: offset or cursor)
productsRouter.get(
  '/',
  productsController.list.bind(productsController)
);

// GET /api/v1/products/:id - Get product details with variants
productsRouter.get(
  '/:id',
  productsController.getById.bind(productsController)
);

// PATCH & PUT /api/v1/products/:id - Update product
productsRouter.patch(
  '/:id',
  validateBody(updateProductSchema),
  productsController.update.bind(productsController)
);
productsRouter.put(
  '/:id',
  validateBody(updateProductSchema),
  productsController.update.bind(productsController)
);

// PATCH /api/v1/products/:id/status - Activate/deactivate product
productsRouter.patch(
  '/:id/status',
  validateBody(updateProductStatusSchema),
  productsController.updateStatus.bind(productsController)
);

// POST /api/v1/products/:id/calculate-price - Calculate final price with variants
productsRouter.post(
  '/:id/calculate-price',
  validateBody(calculatePriceSchema),
  productsController.calculatePrice.bind(productsController)
);

// Alias: POST /api/v1/products/:id/price
productsRouter.post(
  '/:id/price',
  validateBody(calculatePriceSchema),
  productsController.calculatePrice.bind(productsController)
);

// --- Product Variant Endpoints ---

// POST /api/v1/products/:id/variants - Create variant for product
productsRouter.post(
  '/:id/variants',
  validateBody(createVariantSchema),
  productsController.createVariant.bind(productsController)
);

// GET /api/v1/products/:id/variants - List variants for product (Dual pagination)
productsRouter.get(
  '/:id/variants',
  productsController.listVariants.bind(productsController)
);

// PATCH & PUT /api/v1/products/:id/variants/:variantId - Update variant
productsRouter.patch(
  '/:id/variants/:variantId',
  validateBody(updateVariantSchema),
  productsController.updateVariant.bind(productsController)
);
productsRouter.put(
  '/:id/variants/:variantId',
  validateBody(updateVariantSchema),
  productsController.updateVariant.bind(productsController)
);

// PATCH /api/v1/products/:id/variants/:variantId/status - Activate/deactivate variant
productsRouter.patch(
  '/:id/variants/:variantId/status',
  validateBody(updateVariantStatusSchema),
  productsController.updateVariantStatus.bind(productsController)
);
