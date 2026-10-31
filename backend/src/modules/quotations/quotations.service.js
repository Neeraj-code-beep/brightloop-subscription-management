import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../utils/prisma.js';
import { parsePaginationParams, paginate } from '../../utils/pagination.js';
import { calculateNextBillingDate, BILLING_CYCLES } from '../../utils/billingCycle.js';

export const VALID_QUOTATION_TRANSITIONS = {
  DRAFT: ['SENT'],
  SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
  ACCEPTED: ['CONVERTED'],
  REJECTED: [],
  EXPIRED: [],
  CONVERTED: []
};

export class QuotationsService {
  get prisma() {
    return getPrismaClient();
  }

  /**
   * Format quotation record with financial Decimal strings and nested relationships.
   */
  formatQuotationResponse(quotation) {
    return {
      id: quotation.id,
      quotationNumber: quotation.quotationNumber || `QUO-${quotation.id}`,
      customerId: quotation.customerId,
      customer: quotation.customer ? {
        id: quotation.customer.id,
        customerCode: quotation.customer.customerCode,
        companyName: quotation.customer.companyName,
        firstName: quotation.customer.firstName,
        lastName: quotation.customer.lastName,
        email: quotation.customer.email,
        phone: quotation.customer.phone
      } : null,
      status: quotation.status || 'DRAFT',
      currency: quotation.currency || 'INR',
      subtotal: new Prisma.Decimal(quotation.subtotal || 0).toFixed(2),
      discountAmount: new Prisma.Decimal(quotation.discountAmount || 0).toFixed(2),
      taxAmount: new Prisma.Decimal(quotation.taxAmount || 0).toFixed(2),
      grandTotal: new Prisma.Decimal(quotation.grandTotal || 0).toFixed(2),
      validUntil: quotation.validUntil,
      isExpired: quotation.validUntil ? new Date(quotation.validUntil).getTime() < Date.now() : false,
      notes: quotation.notes || null,
      termsAndConditions: quotation.termsAndConditions || null,
      subscriptionId: quotation.subscription?.id || null,
      subscription: quotation.subscription ? {
        id: quotation.subscription.id,
        subscriptionNumber: quotation.subscription.subscriptionNumber,
        status: quotation.subscription.status
      } : null,
      items: (quotation.items || []).map(item => ({
        id: item.id,
        productId: item.productId,
        product: item.product ? {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          type: item.product.type
        } : null,
        planId: item.planId || null,
        plan: item.plan ? {
          id: item.plan.id,
          name: item.plan.name,
          billingCycle: item.plan.billingCycle
        } : null,
        description: item.description || null,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice || 0).toFixed(2),
        setupFee: new Prisma.Decimal(item.setupFee || 0).toFixed(2),
        discountAmount: new Prisma.Decimal(item.discountAmount || 0).toFixed(2),
        taxRate: new Prisma.Decimal(item.taxRate || 0).toFixed(2),
        taxAmount: new Prisma.Decimal(item.taxAmount || 0).toFixed(2),
        lineTotal: new Prisma.Decimal(item.lineTotal || 0).toFixed(2),
        selectedVariants: item.selectedVariants || []
      })),
      createdAt: quotation.createdAt || new Date(),
      updatedAt: quotation.updatedAt || new Date()
    };
  }

  /**
   * Calculate line item pricing, taxes, discounts, and validate entity existence.
   */
  async processQuotationItems(items) {
    let subtotal = new Prisma.Decimal(0);
    let totalDiscount = new Prisma.Decimal(0);
    let totalTax = new Prisma.Decimal(0);
    let grandTotal = new Prisma.Decimal(0);

    const processedItems = [];

    for (const item of items) {
      // 1. Validate Product
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        const error = new Error(`Product with ID '${item.productId}' not found.`);
        error.statusCode = 404;
        throw error;
      }

      if (!product.isActive) {
        const error = new Error(`Cannot add inactive product '${product.name}' to a quotation.`);
        error.statusCode = 400;
        throw error;
      }

      let plan = null;
      let unitPrice = new Prisma.Decimal(product.basePrice);
      let setupFee = new Prisma.Decimal(0);

      // 2. Validate Plan if provided
      if (item.planId) {
        plan = await this.prisma.plan.findUnique({
          where: { id: item.planId }
        });

        if (!plan) {
          const error = new Error(`Plan with ID '${item.planId}' not found.`);
          error.statusCode = 404;
          throw error;
        }

        if (plan.productId !== item.productId) {
          const error = new Error(`Plan '${plan.name}' does not belong to product '${product.name}'.`);
          error.statusCode = 400;
          throw error;
        }

        if (!plan.isActive) {
          const error = new Error(`Cannot add inactive plan '${plan.name}' to a quotation.`);
          error.statusCode = 400;
          throw error;
        }

        unitPrice = new Prisma.Decimal(plan.price);
        setupFee = new Prisma.Decimal(plan.setupFee || 0);
      }

      // 3. Validate Variants
      const variantIds = item.variantIds || [];
      const selectedVariants = [];

      if (variantIds.length > 0) {
        const uniqueVIds = [...new Set(variantIds)];
        if (uniqueVIds.length !== variantIds.length) {
          const error = new Error('Duplicate variant IDs supplied in quotation item.');
          error.statusCode = 400;
          throw error;
        }

        const variants = await this.prisma.productVariant.findMany({
          where: { id: { in: uniqueVIds } }
        });

        if (variants.length !== uniqueVIds.length) {
          const error = new Error('One or more selected variants do not exist.');
          error.statusCode = 404;
          throw error;
        }

        for (const variant of variants) {
          if (variant.productId !== item.productId) {
            const error = new Error(`Variant '${variant.name}' does not belong to product '${product.name}'.`);
            error.statusCode = 400;
            throw error;
          }

          if (!variant.isActive) {
            const error = new Error(`Variant '${variant.name}' is inactive.`);
            error.statusCode = 400;
            throw error;
          }

          selectedVariants.push({
            id: variant.id,
            name: variant.name,
            sku: variant.sku,
            additionalPrice: new Prisma.Decimal(variant.additionalPrice).toFixed(2)
          });

          // If no plan, add variant price to base product price
          if (!item.planId) {
            unitPrice = unitPrice.plus(new Prisma.Decimal(variant.additionalPrice));
          }
        }
      }

      const qty = parseInt(item.quantity, 10) || 1;
      const itemSubtotal = unitPrice.mul(qty);

      // 4. Calculate Discount
      let itemDiscount = new Prisma.Decimal(0);
      if (item.discountId) {
        const discount = await this.prisma.discount.findUnique({
          where: { id: item.discountId }
        });

        if (!discount || !discount.isActive) {
          const error = new Error(`Discount with ID '${item.discountId}' not found or inactive.`);
          error.statusCode = 400;
          throw error;
        }

        if (discount.type === 'PERCENTAGE') {
          // basis points: value = 1000 means 10%
          const rate = new Prisma.Decimal(discount.value).div(10000);
          itemDiscount = itemSubtotal.mul(rate);
        } else {
          // Fixed amount
          itemDiscount = new Prisma.Decimal(discount.value);
        }

        // Cap discount at subtotal
        if (itemDiscount.greaterThan(itemSubtotal)) {
          itemDiscount = itemSubtotal;
        }
      }

      // 5. Calculate Tax
      let itemTax = new Prisma.Decimal(0);
      let taxRate = new Prisma.Decimal(0);
      if (item.taxId) {
        const tax = await this.prisma.tax.findUnique({
          where: { id: item.taxId }
        });

        if (!tax || !tax.isActive) {
          const error = new Error(`Tax with ID '${item.taxId}' not found or inactive.`);
          error.statusCode = 400;
          throw error;
        }

        taxRate = new Prisma.Decimal(tax.percentage);
        const taxableAmount = itemSubtotal.minus(itemDiscount);
        itemTax = taxableAmount.mul(taxRate).div(100);
      }

      const lineTotal = itemSubtotal.minus(itemDiscount).plus(itemTax).plus(setupFee.mul(qty));

      subtotal = subtotal.plus(itemSubtotal);
      totalDiscount = totalDiscount.plus(itemDiscount);
      totalTax = totalTax.plus(itemTax);
      grandTotal = grandTotal.plus(lineTotal);

      processedItems.push({
        productId: item.productId,
        planId: item.planId || null,
        description: item.description || null,
        quantity: qty,
        unitPrice,
        setupFee,
        discountAmount: itemDiscount,
        taxAmount: itemTax,
        taxRate,
        lineTotal,
        selectedVariants
      });
    }

    return {
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
      processedItems
    };
  }

  /**
   * Create a new quotation in DRAFT status.
   */
  async createQuotation(data) {
    // 1. Verify Customer exists and is active
    const customer = await this.prisma.customer.findUnique({
      where: { id: data.customerId }
    });

    if (!customer) {
      const error = new Error(`Customer with ID '${data.customerId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (!customer.isActive) {
      const error = new Error(`Cannot create quotation for inactive customer '${customer.customerCode}'.`);
      error.statusCode = 400;
      throw error;
    }

    // 2. Process Line Items and Authoritative Calculations
    const { subtotal, totalDiscount, totalTax, grandTotal, processedItems } =
      await this.processQuotationItems(data.items);

    // 3. Generate Sequential/Unique Quotation Number
    const count = await this.prisma.quotation.count();
    const quotationNumber = `QUO-${String(count + 1).padStart(6, '0')}`;

    // 4. Save Transactionally
    return await this.prisma.$transaction(async (tx) => {
      const created = await tx.quotation.create({
        data: {
          quotationNumber,
          customerId: data.customerId,
          status: 'DRAFT',
          currency: data.currency || 'INR',
          subtotal,
          discountAmount: totalDiscount,
          taxAmount: totalTax,
          grandTotal,
          validUntil: new Date(data.validUntil),
          notes: data.notes || null,
          termsAndConditions: data.termsAndConditions || null,
          items: {
            create: processedItems
          }
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              plan: true
            }
          }
        }
      });

      return this.formatQuotationResponse(created);
    });
  }

  /**
   * List quotations with Dual Pagination, role-based filtering, and search.
   */
  async listQuotations(query = {}, user) {
    const paginationParams = parsePaginationParams(query);

    const where = {};

    // Customer role is strictly isolated to own records
    if (user.role === 'CUSTOMER') {
      where.customerId = user.customerId;
    } else if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { quotationNumber: { contains: String(query.search).trim(), mode: 'insensitive' } },
        { notes: { contains: String(query.search).trim(), mode: 'insensitive' } }
      ];
    }

    const supportedSortFields = ['createdAt', 'validUntil', 'grandTotal', 'status'];
    const sortBy = supportedSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const result = await paginate({
      modelDelegate: this.prisma.quotation,
      where,
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            plan: true
          }
        },
        subscription: true
      },
      paginationParams,
      sortBy,
      sortOrder
    });

    return {
      items: result.items.map(item => this.formatQuotationResponse(item)),
      pagination: result.pagination
    };
  }

  /**
   * Get quotation details by ID.
   */
  async getQuotationById(id, user) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            plan: true
          }
        },
        subscription: true
      }
    });

    if (!quotation) {
      const error = new Error(`Quotation with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // Role-based customer isolation check
    if (user.role === 'CUSTOMER' && quotation.customerId !== user.customerId) {
      const error = new Error('Access denied: you do not own this quotation.');
      error.statusCode = 403;
      throw error;
    }

    return this.formatQuotationResponse(quotation);
  }

  /**
   * Update quotation details (only permitted when status is DRAFT).
   */
  async updateQuotation(id, data) {
    const existing = await this.prisma.quotation.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!existing) {
      const error = new Error(`Quotation with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (existing.status !== 'DRAFT') {
      const error = new Error(`Cannot update quotation with status '${existing.status}'. Only DRAFT quotations can be modified.`);
      error.statusCode = 400;
      throw error;
    }

    let calculationResult = null;
    if (data.items && data.items.length > 0) {
      calculationResult = await this.processQuotationItems(data.items);
    }

    return await this.prisma.$transaction(async (tx) => {
      if (calculationResult) {
        await tx.quotationItem.deleteMany({
          where: { quotationId: id }
        });

        await tx.quotationItem.createMany({
          data: calculationResult.processedItems.map(item => ({
            ...item,
            quotationId: id
          }))
        });
      }

      const updatePayload = {};
      if (data.validUntil) updatePayload.validUntil = new Date(data.validUntil);
      if (data.currency) updatePayload.currency = data.currency;
      if (data.notes !== undefined) updatePayload.notes = data.notes;
      if (data.termsAndConditions !== undefined) updatePayload.termsAndConditions = data.termsAndConditions;

      if (calculationResult) {
        updatePayload.subtotal = calculationResult.subtotal;
        updatePayload.discountAmount = calculationResult.totalDiscount;
        updatePayload.taxAmount = calculationResult.totalTax;
        updatePayload.grandTotal = calculationResult.grandTotal;
      }

      const updated = await tx.quotation.update({
        where: { id },
        data: updatePayload,
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              plan: true
            }
          },
          subscription: true
        }
      });

      return this.formatQuotationResponse(updated);
    });
  }

  /**
   * Change quotation status with strict state machine validation.
   */
  async updateQuotationStatus(id, newStatus) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            plan: true
          }
        },
        subscription: true
      }
    });

    if (!quotation) {
      const error = new Error(`Quotation with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const currentStatus = quotation.status;
    const allowedTransitions = VALID_QUOTATION_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(newStatus)) {
      const error = new Error(`Invalid status transition from '${currentStatus}' to '${newStatus}'. Allowed transitions: ${allowedTransitions.join(', ') || 'none'}.`);
      error.statusCode = 400;
      throw error;
    }

    // Check expiration before transitioning to SENT or ACCEPTED
    if (['SENT', 'ACCEPTED'].includes(newStatus)) {
      if (new Date(quotation.validUntil).getTime() < Date.now()) {
        const error = new Error(`Cannot transition expired quotation to '${newStatus}'. Quotation expired on ${quotation.validUntil.toISOString()}.`);
        error.statusCode = 400;
        throw error;
      }
    }

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status: newStatus },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            plan: true
          }
        },
        subscription: true
      }
    });

    return this.formatQuotationResponse(updated);
  }

  /**
   * Mark quotation as sent to customer (DRAFT -> SENT).
   */
  async sendQuotation(id) {
    return this.updateQuotationStatus(id, 'SENT');
  }

  /**
   * Convert an ACCEPTED quotation into an active subscription.
   * Transactional and idempotent.
   */
  async convertQuotation(id, options = {}) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            plan: true
          }
        },
        subscription: true
      }
    });

    if (!quotation) {
      const error = new Error(`Quotation with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // Idempotent check: if already converted and subscription exists, return it
    if (quotation.status === 'CONVERTED' || quotation.subscription) {
      const existingSub = await this.prisma.subscription.findUnique({
        where: { quotationId: id },
        include: {
          customer: true,
          plan: true,
          items: true
        }
      });

      if (existingSub) {
        return {
          subscription: existingSub,
          quotation: this.formatQuotationResponse(quotation),
          message: 'Quotation was already converted (idempotent result)'
        };
      }
    }

    if (quotation.status !== 'ACCEPTED') {
      const error = new Error(`Cannot convert quotation with status '${quotation.status}'. Only ACCEPTED quotations can be converted to subscriptions.`);
      error.statusCode = 400;
      throw error;
    }

    if (new Date(quotation.validUntil).getTime() < Date.now()) {
      const error = new Error(`Cannot convert expired quotation. Valid until date was ${quotation.validUntil.toISOString()}.`);
      error.statusCode = 400;
      throw error;
    }

    // 1. Identify primary plan or default plan configuration
    const primaryItem = quotation.items.find(i => i.planId) || quotation.items[0];
    const primaryPlan = primaryItem?.plan || null;
    const billingCycle = primaryPlan?.billingCycle || BILLING_CYCLES.MONTHLY;

    // 2. Calculate initial billing period dates
    const startDate = options.startDate ? new Date(options.startDate) : new Date();
    const currentPeriodStart = startDate;
    const currentPeriodEnd = calculateNextBillingDate(
      startDate,
      billingCycle,
      primaryPlan?.customDuration,
      primaryPlan?.customDurationUnit
    );
    const nextBillingDate = currentPeriodEnd;

    // 3. Generate Subscription Number
    const subCount = await this.prisma.subscription.count();
    const subscriptionNumber = `SUB-${String(subCount + 1).padStart(6, '0')}`;

    // 4. Calculate total recurring price snapshot and setup fee snapshot
    const recurringPrice = new Prisma.Decimal(quotation.subtotal);
    const setupFee = quotation.items.reduce(
      (acc, i) => acc.plus(new Prisma.Decimal(i.setupFee || 0).mul(i.quantity)),
      new Prisma.Decimal(0)
    );

    // 5. Transactional Execution
    return await this.prisma.$transaction(async (tx) => {
      // Create Subscription
      const subscription = await tx.subscription.create({
        data: {
          subscriptionNumber,
          customerId: quotation.customerId,
          planId: primaryPlan?.id || null,
          quotationId: quotation.id,
          status: 'ACTIVE',
          startDate,
          currentPeriodStart,
          currentPeriodEnd,
          nextBillingDate,
          billingCycleAnchor: startDate,
          billingCycle,
          recurringPrice,
          setupFee,
          currency: quotation.currency,
          metadata: options.metadata || {},
          items: {
            create: quotation.items.map(item => ({
              planId: item.planId || primaryPlan?.id || item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
              selectedVariants: item.selectedVariants || []
            }))
          }
        },
        include: {
          customer: true,
          plan: true,
          items: true
        }
      });

      // Update Quotation status to CONVERTED
      const updatedQuotation = await tx.quotation.update({
        where: { id: quotation.id },
        data: { status: 'CONVERTED' },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              plan: true
            }
          },
          subscription: true
        }
      });

      return {
        subscription,
        quotation: this.formatQuotationResponse(updatedQuotation)
      };
    });
  }
}

export const quotationsService = new QuotationsService();

