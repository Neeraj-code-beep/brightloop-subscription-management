import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { parsePaginationParams, paginate } from '../../utils/pagination.js';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export class ProductsService {
  /**
   * Create a new product.
   */
  async createProduct(data) {
    const slug = data.slug || `${slugify(data.name)}-${Math.random().toString(36).substring(2, 7)}`;

    // Verify slug uniqueness
    const existing = await prisma.product.findUnique({
      where: { slug }
    });
    if (existing) {
      const error = new Error(`A product with slug '${slug}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        slug,
        description: data.description || null,
        type: data.type || 'SOFTWARE',
        basePrice: new Prisma.Decimal(data.basePrice || '0.00'),
        costPrice: data.costPrice ? new Prisma.Decimal(data.costPrice) : null,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });

    return product;
  }

  /**
   * List products with dual pagination (offset or cursor), search, and filtering.
   */
  async listProducts(query) {
    const paginationParams = parsePaginationParams(query);
    const where = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.isActive !== undefined && query.isActive !== null && query.isActive !== '') {
      where.isActive = query.isActive === true || query.isActive === 'true';
    }

    if (query.search) {
      where.name = { contains: String(query.search).trim(), mode: 'insensitive' };
    }

    const allowedSortFields = ['createdAt', 'name', 'basePrice', 'updatedAt'];
    const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    return paginate({
      modelDelegate: prisma.product,
      where,
      paginationParams,
      sortBy,
      sortOrder,
      include: {
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            sku: true,
            description: true,
            additionalPrice: true,
            unit: true,
            isActive: true
          }
        }
      }
    });
  }

  /**
   * Get single product with all variants.
   */
  async getProductById(id) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
        }
      }
    });

    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    return product;
  }

  /**
   * Update product.
   */
  async updateProduct(id, data) {
    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    if (data.slug && data.slug !== product.slug) {
      const existing = await prisma.product.findUnique({
        where: { slug: data.slug }
      });
      if (existing) {
        const error = new Error(`A product with slug '${data.slug}' already exists.`);
        error.statusCode = 409;
        throw error;
      }
    }

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.basePrice !== undefined) updateData.basePrice = new Prisma.Decimal(data.basePrice);
    if (data.costPrice !== undefined) updateData.costPrice = data.costPrice ? new Prisma.Decimal(data.costPrice) : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        variants: true
      }
    });

    return updated;
  }

  /**
   * Activate or deactivate product.
   */
  async updateProductStatus(id, isActive) {
    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    return prisma.product.update({
      where: { id },
      data: { isActive }
    });
  }

  // --- Variant Operations ---

  /**
   * Create variant for a product.
   */
  async createVariant(productId, data) {
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    // Check duplicate variant name within the product
    const existingName = await prisma.productVariant.findFirst({
      where: {
        productId,
        name: { equals: data.name, mode: 'insensitive' }
      }
    });
    if (existingName) {
      const error = new Error(`A variant with name '${data.name}' already exists for this product.`);
      error.statusCode = 409;
      throw error;
    }

    const sku = data.sku || `SKU-${productId.substring(0, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Check SKU uniqueness
    const existingSku = await prisma.productVariant.findUnique({
      where: { sku }
    });
    if (existingSku) {
      const error = new Error(`A variant with SKU '${sku}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        name: data.name,
        sku,
        description: data.description || null,
        additionalPrice: new Prisma.Decimal(data.additionalPrice || '0.00'),
        unit: data.unit || 'seat',
        unitPriceInCents: 0,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });

    return variant;
  }

  /**
   * List variants for a product with dual pagination.
   */
  async listVariants(productId, query) {
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    const paginationParams = parsePaginationParams(query);
    const where = { productId };

    if (query.isActive !== undefined && query.isActive !== null && query.isActive !== '') {
      where.isActive = query.isActive === true || query.isActive === 'true';
    }

    if (query.search) {
      where.name = { contains: String(query.search).trim(), mode: 'insensitive' };
    }

    const allowedSortFields = ['createdAt', 'name', 'additionalPrice', 'updatedAt'];
    const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    return paginate({
      modelDelegate: prisma.productVariant,
      where,
      paginationParams,
      sortBy,
      sortOrder
    });
  }

  /**
   * Update variant.
   */
  async updateVariant(productId, variantId, data) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId }
    });

    if (!variant || variant.productId !== productId) {
      const error = new Error(`Variant not found or does not belong to product '${productId}'.`);
      error.statusCode = 404;
      throw error;
    }

    // Check duplicate name within same product
    if (data.name && data.name.toLowerCase() !== variant.name.toLowerCase()) {
      const existingName = await prisma.productVariant.findFirst({
        where: {
          productId,
          name: { equals: data.name, mode: 'insensitive' },
          NOT: { id: variantId }
        }
      });
      if (existingName) {
        const error = new Error(`A variant with name '${data.name}' already exists for this product.`);
        error.statusCode = 409;
        throw error;
      }
    }

    // Check SKU uniqueness
    if (data.sku && data.sku !== variant.sku) {
      const existingSku = await prisma.productVariant.findUnique({
        where: { sku: data.sku }
      });
      if (existingSku) {
        const error = new Error(`A variant with SKU '${data.sku}' already exists.`);
        error.statusCode = 409;
        throw error;
      }
    }

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.additionalPrice !== undefined) updateData.additionalPrice = new Prisma.Decimal(data.additionalPrice);
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.productVariant.update({
      where: { id: variantId },
      data: updateData
    });
  }

  /**
   * Activate or deactivate variant.
   */
  async updateVariantStatus(productId, variantId, isActive) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId }
    });

    if (!variant || variant.productId !== productId) {
      const error = new Error(`Variant not found or does not belong to product '${productId}'.`);
      error.statusCode = 404;
      throw error;
    }

    return prisma.productVariant.update({
      where: { id: variantId },
      data: { isActive }
    });
  }

  /**
   * Calculate final price on backend using Prisma Decimal arithmetic.
   * Final Price = Base Product Price + Selected Active Variant Prices
   * Validates variant ownership, active status, and prevents duplicates.
   */
  async calculateFinalPrice(productId, variantIds = []) {
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    // Check for duplicate variant IDs in the request
    const uniqueIds = [...new Set(variantIds)];
    if (uniqueIds.length !== variantIds.length) {
      const error = new Error('Duplicate variant IDs are not allowed in price calculation.');
      error.statusCode = 400;
      throw error;
    }

    let finalPrice = new Prisma.Decimal(product.basePrice);
    const selectedVariants = [];

    if (uniqueIds.length > 0) {
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: uniqueIds } }
      });

      // Verify all requested variants exist
      const foundIds = new Set(variants.map(v => v.id));
      for (const reqId of uniqueIds) {
        if (!foundIds.has(reqId)) {
          const error = new Error(`Variant '${reqId}' does not exist.`);
          error.statusCode = 400;
          throw error;
        }
      }

      // Verify all requested variants belong to this product
      for (const v of variants) {
        if (v.productId !== productId) {
          const error = new Error(`Variant '${v.id}' does not belong to product '${productId}'.`);
          error.statusCode = 400;
          throw error;
        }

        // Only active variants can be selected
        if (!v.isActive) {
          const error = new Error(`Cannot calculate price: Variant '${v.name}' (${v.id}) is inactive.`);
          error.statusCode = 400;
          throw error;
        }

        // Add additional price using Decimal arithmetic (never floating point)
        finalPrice = finalPrice.plus(v.additionalPrice);
        selectedVariants.push({
          id: v.id,
          name: v.name,
          sku: v.sku,
          additionalPrice: v.additionalPrice.toFixed(2)
        });
      }
    }

    return {
      productId: product.id,
      productName: product.name,
      productActive: product.isActive,
      basePrice: new Prisma.Decimal(product.basePrice).toFixed(2),
      selectedVariants,
      finalPrice: finalPrice.toFixed(2)
    };
  }
}

export const productsService = new ProductsService();

