import { Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../utils/prisma.js';
import { parsePaginationParams, paginate } from '../../utils/pagination.js';

export class DiscountsService {
  constructor(prismaClient = defaultPrisma) {
    this.prisma = prismaClient;
  }

  formatDiscountResponse(discount) {
    if (!discount) return null;
    const valDecimal = new Prisma.Decimal(discount.value || 0);

    return {
      id: discount.id,
      code: discount.code,
      name: discount.name || null,
      description: discount.description || null,
      type: discount.type,
      value: valDecimal.toFixed(2),
      currency: discount.currency || 'INR',
      minPurchaseAmount: discount.minPurchaseAmount ? new Prisma.Decimal(discount.minPurchaseAmount).toFixed(2) : null,
      maxDiscountAmount: discount.maxDiscountAmount ? new Prisma.Decimal(discount.maxDiscountAmount).toFixed(2) : null,
      validFrom: discount.validFrom ? new Date(discount.validFrom).toISOString() : null,
      validTo: discount.validTo ? new Date(discount.validTo).toISOString() : null,
      maxRedemptions: discount.maxRedemptions || null,
      maxRedemptionsPerCustomer: discount.maxRedemptionsPerCustomer !== undefined ? discount.maxRedemptionsPerCustomer : 1,
      timesRedeemed: discount.timesRedeemed || 0,
      isActive: Boolean(discount.isActive),
      createdAt: discount.createdAt,
      updatedAt: discount.updatedAt
    };
  }

  /**
   * Create a new Discount / Coupon (ADMIN)
   */
  async createDiscount(data) {
    const code = String(data.code).trim().toUpperCase();

    // Check code uniqueness
    const existing = await this.prisma.discount.findUnique({
      where: { code }
    });
    if (existing) {
      const error = new Error(`Discount with code '${code}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    const valueDecimal = new Prisma.Decimal(data.value);
    if (valueDecimal.isNegative()) {
      const error = new Error('Discount value must be a positive number.');
      error.statusCode = 400;
      throw error;
    }

    if (data.type === 'PERCENTAGE' && valueDecimal.greaterThan(100) && valueDecimal.greaterThan(10000)) {
      const error = new Error('Percentage discount cannot exceed 100%.');
      error.statusCode = 400;
      throw error;
    }

    // Date validations
    if (data.validFrom && data.validTo) {
      if (new Date(data.validTo) < new Date(data.validFrom)) {
        const error = new Error('Discount validTo date cannot be earlier than validFrom date.');
        error.statusCode = 400;
        throw error;
      }
    }

    const minPurchase = data.minPurchaseAmount !== undefined && data.minPurchaseAmount !== null
      ? new Prisma.Decimal(data.minPurchaseAmount)
      : null;

    const maxDiscount = data.maxDiscountAmount !== undefined && data.maxDiscountAmount !== null
      ? new Prisma.Decimal(data.maxDiscountAmount)
      : null;

    const newDiscount = await this.prisma.discount.create({
      data: {
        code,
        name: data.name || null,
        description: data.description || null,
        type: data.type || 'PERCENTAGE',
        value: valueDecimal,
        currency: data.currency ? String(data.currency).toUpperCase() : 'INR',
        minPurchaseAmount: minPurchase,
        maxDiscountAmount: maxDiscount,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validTo: data.validTo ? new Date(data.validTo) : null,
        maxRedemptions: data.maxRedemptions ? Number(data.maxRedemptions) : null,
        maxRedemptionsPerCustomer: data.maxRedemptionsPerCustomer !== undefined ? Number(data.maxRedemptionsPerCustomer) : 1,
        timesRedeemed: 0,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true
      }
    });

    return this.formatDiscountResponse(newDiscount);
  }

  /**
   * Get discount by ID
   */
  async getDiscountById(id) {
    const discount = await this.prisma.discount.findUnique({
      where: { id }
    });
    if (!discount) {
      const error = new Error(`Discount not found with ID '${id}'.`);
      error.statusCode = 404;
      throw error;
    }
    return this.formatDiscountResponse(discount);
  }

  /**
   * List discounts with dual pagination and filtering
   */
  async listDiscounts(queryParams = {}) {
    const {
      isActive,
      type,
      search,
      page,
      limit,
      cursor,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryParams;

    const where = {};

    if (isActive !== undefined && isActive !== '') {
      where.isActive = String(isActive) === 'true';
    }

    if (type) {
      where.type = String(type).toUpperCase();
    }

    if (search) {
      where.OR = [
        { code: { contains: String(search), mode: 'insensitive' } },
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    const paginationParams = parsePaginationParams(queryParams);
    const result = await paginate({
      modelDelegate: this.prisma.discount,
      paginationParams,
      where,
      sortBy,
      sortOrder
    });

    return {
      items: result.items.map(d => this.formatDiscountResponse(d)),
      pagination: result.pagination
    };
  }

  /**
   * Update discount details (ADMIN)
   */
  async updateDiscount(id, data) {
    const existing = await this.prisma.discount.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Discount not found with ID '${id}'.`);
      error.statusCode = 404;
      throw error;
    }

    const updateData = {};

    if (data.code !== undefined) {
      const code = String(data.code).trim().toUpperCase();
      const codeCheck = await this.prisma.discount.findFirst({
        where: { code, NOT: { id } }
      });
      if (codeCheck) {
        const error = new Error(`Discount with code '${code}' already exists.`);
        error.statusCode = 409;
        throw error;
      }
      updateData.code = code;
    }

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;

    if (data.value !== undefined) {
      const valDecimal = new Prisma.Decimal(data.value);
      if (valDecimal.isNegative()) {
        const error = new Error('Discount value must be a positive number.');
        error.statusCode = 400;
        throw error;
      }
      const targetType = data.type || existing.type;
      if (targetType === 'PERCENTAGE' && valDecimal.greaterThan(100) && valDecimal.greaterThan(10000)) {
        const error = new Error('Percentage discount cannot exceed 100%.');
        error.statusCode = 400;
        throw error;
      }
      updateData.value = valDecimal;
    }

    if (data.currency !== undefined) updateData.currency = String(data.currency).toUpperCase();

    if (data.minPurchaseAmount !== undefined) {
      updateData.minPurchaseAmount = data.minPurchaseAmount !== null ? new Prisma.Decimal(data.minPurchaseAmount) : null;
    }

    if (data.maxDiscountAmount !== undefined) {
      updateData.maxDiscountAmount = data.maxDiscountAmount !== null ? new Prisma.Decimal(data.maxDiscountAmount) : null;
    }

    const validFrom = data.validFrom !== undefined ? (data.validFrom ? new Date(data.validFrom) : null) : existing.validFrom;
    const validTo = data.validTo !== undefined ? (data.validTo ? new Date(data.validTo) : null) : existing.validTo;

    if (validFrom && validTo && validTo < validFrom) {
      const error = new Error('Discount validTo date cannot be earlier than validFrom date.');
      error.statusCode = 400;
      throw error;
    }

    if (data.validFrom !== undefined) updateData.validFrom = validFrom;
    if (data.validTo !== undefined) updateData.validTo = validTo;

    if (data.maxRedemptions !== undefined) {
      updateData.maxRedemptions = data.maxRedemptions !== null ? Number(data.maxRedemptions) : null;
    }

    if (data.maxRedemptionsPerCustomer !== undefined) {
      updateData.maxRedemptionsPerCustomer = Number(data.maxRedemptionsPerCustomer);
    }

    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    const updated = await this.prisma.discount.update({
      where: { id },
      data: updateData
    });

    return this.formatDiscountResponse(updated);
  }

  /**
   * Update discount active status (ADMIN)
   */
  async updateDiscountStatus(id, isActive) {
    const existing = await this.prisma.discount.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Discount not found with ID '${id}'.`);
      error.statusCode = 404;
      throw error;
    }

    const updated = await this.prisma.discount.update({
      where: { id },
      data: { isActive: Boolean(isActive) }
    });

    return this.formatDiscountResponse(updated);
  }

  /**
   * Validate coupon code eligibility and compute discount amount
   */
  async validateCoupon({ code, customerId = null, purchaseAmount = 0, currency = null }) {
    if (!code) {
      const error = new Error('Coupon code is required.');
      error.statusCode = 400;
      throw error;
    }

    const normCode = String(code).trim().toUpperCase();
    const discount = await this.prisma.discount.findUnique({
      where: { code: normCode }
    });

    if (!discount) {
      const error = new Error(`Coupon '${normCode}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (!discount.isActive) {
      const error = new Error(`Coupon '${normCode}' is inactive.`);
      error.statusCode = 400;
      throw error;
    }

    const now = new Date();

    // Check validity window
    if (discount.validFrom && new Date(discount.validFrom) > now) {
      const error = new Error(`Coupon '${normCode}' is not active yet (starts on ${new Date(discount.validFrom).toISOString().slice(0, 10)}).`);
      error.statusCode = 400;
      throw error;
    }

    if (discount.validTo && new Date(discount.validTo) < now) {
      const error = new Error(`Coupon '${normCode}' has expired.`);
      error.statusCode = 400;
      throw error;
    }

    // Check global usage limit
    if (discount.maxRedemptions !== null && discount.maxRedemptions !== undefined) {
      if (discount.timesRedeemed >= discount.maxRedemptions) {
        const error = new Error(`Coupon '${normCode}' redemption limit of ${discount.maxRedemptions} has been reached.`);
        error.statusCode = 400;
        throw error;
      }
    }

    // Check per-customer usage limit
    if (customerId && discount.maxRedemptionsPerCustomer) {
      const customerRedemptions = await this.prisma.discountRedemption?.count({
        where: {
          discountId: discount.id,
          customerId
        }
      }).catch(() => 0) || 0;

      if (customerRedemptions >= discount.maxRedemptionsPerCustomer) {
        const error = new Error(`You have reached the maximum allowed redemptions (${discount.maxRedemptionsPerCustomer}) for coupon '${normCode}'.`);
        error.statusCode = 400;
        throw error;
      }
    }

    const purchaseDecimal = new Prisma.Decimal(purchaseAmount || 0);

    // Check minimum purchase amount
    if (discount.minPurchaseAmount) {
      const minPurchase = new Prisma.Decimal(discount.minPurchaseAmount);
      if (purchaseDecimal.lt(minPurchase)) {
        const error = new Error(`Minimum purchase amount of ${minPurchase.toFixed(2)} required to apply coupon '${normCode}'. Current: ${purchaseDecimal.toFixed(2)}.`);
        error.statusCode = 400;
        throw error;
      }
    }

    // Currency check
    if (currency && discount.currency && currency.toUpperCase() !== discount.currency.toUpperCase()) {
      const error = new Error(`Coupon '${normCode}' is only valid for currency '${discount.currency}', but requested with '${currency}'.`);
      error.statusCode = 400;
      throw error;
    }

    // Calculate discount amount
    let discountAmount = new Prisma.Decimal(0);
    const valDecimal = new Prisma.Decimal(discount.value);

    if (discount.type === 'PERCENTAGE') {
      const rate = valDecimal.gt(100) ? valDecimal.div(10000) : valDecimal.div(100);
      discountAmount = purchaseDecimal.mul(rate);
    } else {
      discountAmount = valDecimal;
    }

    // Cap at purchase amount
    discountAmount = Prisma.Decimal.min(discountAmount, purchaseDecimal);

    // Cap at max discount amount
    if (discount.maxDiscountAmount) {
      const maxDiscount = new Prisma.Decimal(discount.maxDiscountAmount);
      discountAmount = Prisma.Decimal.min(discountAmount, maxDiscount);
    }

    return {
      isValid: true,
      discount: this.formatDiscountResponse(discount),
      discountAmount: discountAmount.toFixed(2),
      eligiblePurchaseAmount: purchaseDecimal.toFixed(2),
      message: `Coupon '${normCode}' is valid and applied.`
    };
  }

  /**
   * Atomically redeem a discount and record audit redemption
   */
  async redeemDiscount(tx, { discountId, customerId, amountApplied, invoiceId = null, quotationId = null, subscriptionId = null }) {
    const db = tx || this.prisma;

    const discount = await db.discount.findUnique({
      where: { id: discountId }
    });

    if (!discount || !discount.isActive) {
      throw new Error('Discount is not available for redemption.');
    }

    // Concurrency guard: check maxRedemptions
    if (discount.maxRedemptions && discount.timesRedeemed >= discount.maxRedemptions) {
      throw new Error(`Discount code '${discount.code}' has already reached its maximum redemptions.`);
    }

    // Increment timesRedeemed
    await db.discount.update({
      where: { id: discountId },
      data: {
        timesRedeemed: { increment: 1 }
      }
    });

    // Record audit redemption if DiscountRedemption table exists
    if (db.discountRedemption?.create) {
      await db.discountRedemption.create({
        data: {
          discountId,
          customerId,
          invoiceId,
          quotationId,
          subscriptionId,
          amountApplied: new Prisma.Decimal(amountApplied || 0)
        }
      }).catch(err => {
        console.warn('[Discounts] Warning recording discount redemption record:', err.message);
      });
    }

    return discount;
  }
}

export const discountsService = new DiscountsService();

