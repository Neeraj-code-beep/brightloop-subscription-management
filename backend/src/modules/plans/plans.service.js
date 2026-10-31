import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../utils/prisma.js';
import { parsePaginationParams, paginate } from '../../utils/pagination.js';
import { BILLING_CYCLES, calculateNextBillingDate } from '../../utils/billingCycle.js';

export class PlansService {
  get prisma() {
    return getPrismaClient();
  }

  /**
   * Format plan record into client response with transparent pricing breakdown.
   */
  formatPlanResponse(plan) {
    const basePrice = plan.product?.basePrice
      ? new Prisma.Decimal(plan.product.basePrice)
      : new Prisma.Decimal(0);

    const variants = (plan.planVariants || [])
      .map(pv => pv.variant)
      .filter(Boolean);

    const variantsTotal = variants.reduce(
      (acc, v) => acc.plus(new Prisma.Decimal(v.additionalPrice || 0)),
      new Prisma.Decimal(0)
    );

    const recurringPrice = new Prisma.Decimal(plan.price);
    const setupFee = new Prisma.Decimal(plan.setupFee || 0);
    const firstPaymentTotal = recurringPrice.plus(setupFee);

    let nextBillingDatePreview = null;
    try {
      nextBillingDatePreview = calculateNextBillingDate(
        new Date(),
        plan.billingCycle,
        plan.customDuration,
        plan.customDurationUnit
      ).toISOString();
    } catch {
      nextBillingDatePreview = null;
    }

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      productId: plan.productId,
      product: plan.product ? {
        id: plan.product.id,
        name: plan.product.name,
        slug: plan.product.slug,
        type: plan.product.type,
        basePrice: new Prisma.Decimal(plan.product.basePrice).toFixed(2),
        isActive: plan.product.isActive
      } : null,
      billingCycle: plan.billingCycle,
      customDuration: plan.customDuration,
      customDurationUnit: plan.customDurationUnit,
      price: recurringPrice.toFixed(2),
      setupFee: setupFee.toFixed(2),
      currency: plan.currency,
      isActive: plan.isActive,
      variants: variants.map(v => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        description: v.description,
        additionalPrice: new Prisma.Decimal(v.additionalPrice).toFixed(2),
        isActive: v.isActive
      })),
      pricingBreakdown: {
        basePrice: basePrice.toFixed(2),
        variantsTotal: variantsTotal.toFixed(2),
        setupFee: setupFee.toFixed(2),
        recurringPrice: recurringPrice.toFixed(2),
        firstPaymentTotal: firstPaymentTotal.toFixed(2)
      },
      nextBillingDatePreview,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt
    };
  }

  /**
   * Create a new plan tied to a product and selected variants.
   */
  async createPlan(data) {
    // 1. Verify Product exists and is active
    const product = await this.prisma.product.findUnique({
      where: { id: data.productId }
    });

    if (!product) {
      const error = new Error(`Product with ID '${data.productId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (!product.isActive) {
      const error = new Error(`Cannot create a plan for inactive product '${product.name}'. Activate the product first.`);
      error.statusCode = 400;
      throw error;
    }

    // 2. Prevent duplicate plan names for the same product and billing cycle
    const existing = await this.prisma.plan.findFirst({
      where: {
        productId: data.productId,
        name: data.name,
        billingCycle: data.billingCycle
      }
    });

    if (existing) {
      const error = new Error(`A plan named '${data.name}' with billing cycle '${data.billingCycle}' already exists for this product.`);
      error.statusCode = 409;
      throw error;
    }

    // 3. Validate Variants
    const variantIds = data.variantIds || [];
    const uniqueIds = [...new Set(variantIds)];
    if (uniqueIds.length !== variantIds.length) {
      const error = new Error('Duplicate variant IDs supplied in plan variant selection.');
      error.statusCode = 400;
      throw error;
    }

    let activeVariants = [];
    if (uniqueIds.length > 0) {
      activeVariants = await this.prisma.productVariant.findMany({
        where: { id: { in: uniqueIds } }
      });

      if (activeVariants.length !== uniqueIds.length) {
        const error = new Error('One or more selected variants do not exist.');
        error.statusCode = 404;
        throw error;
      }

      for (const variant of activeVariants) {
        if (variant.productId !== data.productId) {
          const error = new Error(`Variant '${variant.name}' (${variant.id}) does not belong to product '${product.name}'.`);
          error.statusCode = 400;
          throw error;
        }

        if (!variant.isActive) {
          const error = new Error(`Variant '${variant.name}' (${variant.id}) is inactive. Inactive variants cannot be added to a plan.`);
          error.statusCode = 400;
          throw error;
        }
      }
    }

    // 4. Calculate Authoritative Plan Price
    const basePrice = new Prisma.Decimal(product.basePrice);
    const variantsTotal = activeVariants.reduce(
      (acc, v) => acc.plus(new Prisma.Decimal(v.additionalPrice)),
      new Prisma.Decimal(0)
    );
    const computedPrice = basePrice.plus(variantsTotal);

    // Validate client-submitted price if provided
    if (data.price !== undefined && data.price !== null) {
      const clientPrice = new Prisma.Decimal(data.price);
      if (!clientPrice.equals(computedPrice)) {
        const error = new Error(`Plan price mismatch: backend computed ₹${computedPrice.toFixed(2)}, received ₹${clientPrice.toFixed(2)}. Calculated price must equal product base price plus selected variants.`);
        error.statusCode = 400;
        throw error;
      }
    }

    const setupFee = new Prisma.Decimal(data.setupFee || '0.00');

    // 5. Transactional Creation
    return await this.prisma.$transaction(async (tx) => {
      const createdPlan = await tx.plan.create({
        data: {
          productId: data.productId,
          name: data.name,
          description: data.description || null,
          billingCycle: data.billingCycle,
          customDuration: data.customDuration || null,
          customDurationUnit: data.customDurationUnit || null,
          price: computedPrice,
          setupFee,
          currency: data.currency || 'INR',
          isActive: data.isActive !== undefined ? data.isActive : true,
          planVariants: {
            create: uniqueIds.map(vId => ({ variantId: vId }))
          }
        },
        include: {
          product: true,
          planVariants: {
            include: {
              variant: true
            }
          }
        }
      });

      return this.formatPlanResponse(createdPlan);
    });
  }

  /**
   * List plans supporting Dual Pagination (offset & cursor), search, and filtering.
   */
  async listPlans(query = {}) {
    const paginationParams = parsePaginationParams(query);

    const where = {};

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.billingCycle) {
      where.billingCycle = query.billingCycle;
    }

    if (query.isActive !== undefined && query.isActive !== '') {
      where.isActive = String(query.isActive).toLowerCase() === 'true';
    }

    if (query.search) {
      where.name = {
        contains: String(query.search).trim(),
        mode: 'insensitive'
      };
    }

    const supportedSortFields = ['createdAt', 'name', 'price', 'updatedAt'];
    const sortBy = supportedSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const result = await paginate({
      modelDelegate: this.prisma.plan,
      where,
      include: {
        product: true,
        planVariants: {
          include: {
            variant: true
          }
        }
      },
      paginationParams,
      sortBy,
      sortOrder
    });

    return {
      items: result.items.map(item => this.formatPlanResponse(item)),
      pagination: result.pagination
    };
  }

  /**
   * Get plan details by ID.
   */
  async getPlanById(id) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: {
        product: true,
        planVariants: {
          include: {
            variant: true
          }
        }
      }
    });

    if (!plan) {
      const error = new Error(`Plan with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    return this.formatPlanResponse(plan);
  }

  /**
   * Update plan details and variant associations.
   */
  async updatePlan(id, data) {
    const existing = await this.prisma.plan.findUnique({
      where: { id },
      include: {
        product: true,
        planVariants: {
          include: {
            variant: true
          }
        }
      }
    });

    if (!existing) {
      const error = new Error(`Plan with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // Check duplicate name + billingCycle under the same product
    const targetName = data.name || existing.name;
    const targetCycle = data.billingCycle || existing.billingCycle;

    if (data.name || data.billingCycle) {
      const duplicate = await this.prisma.plan.findFirst({
        where: {
          productId: existing.productId,
          name: targetName,
          billingCycle: targetCycle,
          NOT: { id }
        }
      });

      if (duplicate) {
        const error = new Error(`A plan named '${targetName}' with billing cycle '${targetCycle}' already exists for this product.`);
        error.statusCode = 409;
        throw error;
      }
    }

    let updatedPrice = existing.price;
    let newVariantIds = null;

    if (data.variantIds !== undefined) {
      const uniqueIds = [...new Set(data.variantIds)];
      if (uniqueIds.length !== data.variantIds.length) {
        const error = new Error('Duplicate variant IDs supplied in plan variant update.');
        error.statusCode = 400;
        throw error;
      }

      let activeVariants = [];
      if (uniqueIds.length > 0) {
        activeVariants = await this.prisma.productVariant.findMany({
          where: { id: { in: uniqueIds } }
        });

        if (activeVariants.length !== uniqueIds.length) {
          const error = new Error('One or more selected variants do not exist.');
          error.statusCode = 404;
          throw error;
        }

        for (const variant of activeVariants) {
          if (variant.productId !== existing.productId) {
            const error = new Error(`Variant '${variant.name}' (${variant.id}) does not belong to product '${existing.product.name}'.`);
            error.statusCode = 400;
            throw error;
          }

          if (!variant.isActive) {
            const error = new Error(`Variant '${variant.name}' (${variant.id}) is inactive.`);
            error.statusCode = 400;
            throw error;
          }
        }
      }

      const basePrice = new Prisma.Decimal(existing.product.basePrice);
      const variantsTotal = activeVariants.reduce(
        (acc, v) => acc.plus(new Prisma.Decimal(v.additionalPrice)),
        new Prisma.Decimal(0)
      );
      updatedPrice = basePrice.plus(variantsTotal);

      if (data.price !== undefined && data.price !== null) {
        const clientPrice = new Prisma.Decimal(data.price);
        if (!clientPrice.equals(updatedPrice)) {
          const error = new Error(`Plan price mismatch: backend computed ₹${updatedPrice.toFixed(2)}, received ₹${clientPrice.toFixed(2)}.`);
          error.statusCode = 400;
          throw error;
        }
      }

      newVariantIds = uniqueIds;
    }

    return await this.prisma.$transaction(async (tx) => {
      if (newVariantIds !== null) {
        await tx.planVariant.deleteMany({
          where: { planId: id }
        });

        if (newVariantIds.length > 0) {
          await tx.planVariant.createMany({
            data: newVariantIds.map(vId => ({
              planId: id,
              variantId: vId
            }))
          });
        }
      }

      const updatePayload = {};
      if (data.name !== undefined) updatePayload.name = data.name;
      if (data.description !== undefined) updatePayload.description = data.description;
      if (data.billingCycle !== undefined) updatePayload.billingCycle = data.billingCycle;
      if (data.customDuration !== undefined) updatePayload.customDuration = data.customDuration;
      if (data.customDurationUnit !== undefined) updatePayload.customDurationUnit = data.customDurationUnit;
      if (data.setupFee !== undefined) updatePayload.setupFee = new Prisma.Decimal(data.setupFee);
      if (data.currency !== undefined) updatePayload.currency = data.currency;
      if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
      if (newVariantIds !== null) updatePayload.price = updatedPrice;

      const updated = await tx.plan.update({
        where: { id },
        data: updatePayload,
        include: {
          product: true,
          planVariants: {
            include: {
              variant: true
            }
          }
        }
      });

      return this.formatPlanResponse(updated);
    });
  }

  /**
   * Toggle plan active/inactive status.
   */
  async updatePlanStatus(id, isActive) {
    const plan = await this.prisma.plan.findUnique({
      where: { id }
    });

    if (!plan) {
      const error = new Error(`Plan with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const updated = await this.prisma.plan.update({
      where: { id },
      data: { isActive },
      include: {
        product: true,
        planVariants: {
          include: {
            variant: true
          }
        }
      }
    });

    return this.formatPlanResponse(updated);
  }
}

export const plansService = new PlansService();

