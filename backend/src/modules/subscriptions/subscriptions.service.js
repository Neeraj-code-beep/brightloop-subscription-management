import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../utils/prisma.js';
import { parsePaginationParams, paginate } from '../../utils/pagination.js';
import { calculateNextBillingDate, BILLING_CYCLES } from '../../utils/billingCycle.js';

export const VALID_SUBSCRIPTION_TRANSITIONS = {
  PENDING: ['ACTIVE', 'CANCELED'],
  ACTIVE: ['PAUSED', 'CANCELED', 'EXPIRED'],
  PAUSED: ['ACTIVE', 'CANCELED'],
  CANCELED: [],
  EXPIRED: []
};

export class SubscriptionsService {
  get prisma() {
    return getPrismaClient();
  }

  /**
   * Format subscription entity with financial snapshot values and relations.
   */
  formatSubscriptionResponse(subscription) {
    return {
      id: subscription.id,
      subscriptionNumber: subscription.subscriptionNumber || `SUB-${subscription.id}`,
      customerId: subscription.customerId,
      customer: subscription.customer ? {
        id: subscription.customer.id,
        customerCode: subscription.customer.customerCode,
        companyName: subscription.customer.companyName,
        firstName: subscription.customer.firstName,
        lastName: subscription.customer.lastName,
        email: subscription.customer.email,
        phone: subscription.customer.phone
      } : null,
      planId: subscription.planId || null,
      plan: subscription.plan ? {
        id: subscription.plan.id,
        name: subscription.plan.name,
        billingCycle: subscription.plan.billingCycle,
        product: subscription.plan.product ? {
          id: subscription.plan.product.id,
          name: subscription.plan.product.name,
          slug: subscription.plan.product.slug
        } : null
      } : null,
      quotationId: subscription.quotationId || null,
      status: subscription.status || 'ACTIVE',
      startDate: subscription.startDate || subscription.createdAt || new Date(),
      currentPeriodStart: subscription.currentPeriodStart || new Date(),
      currentPeriodEnd: subscription.currentPeriodEnd || new Date(),
      nextBillingDate: subscription.nextBillingDate || null,
      endDate: subscription.endDate || null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
      canceledAt: subscription.canceledAt || null,
      cancellationReason: subscription.cancellationReason || null,
      pausedAt: subscription.pausedAt || null,
      resumedAt: subscription.resumedAt || null,
      billingCycle: subscription.billingCycle || 'MONTHLY',
      recurringPrice: new Prisma.Decimal(subscription.recurringPrice || 0).toFixed(2),
      setupFee: new Prisma.Decimal(subscription.setupFee || 0).toFixed(2),
      currency: subscription.currency || 'INR',
      items: (subscription.items || []).map(item => ({
        id: item.id,
        planId: item.planId,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice || 0).toFixed(2),
        lineTotal: new Prisma.Decimal(item.lineTotal || 0).toFixed(2),
        selectedVariants: item.selectedVariants || []
      })),
      metadata: subscription.metadata || {},
      createdAt: subscription.createdAt || new Date(),
      updatedAt: subscription.updatedAt || new Date()
    };
  }

  /**
   * Create a new subscription directly.
   */
  async createSubscription(data) {
    // 1. Verify Customer
    const customer = await this.prisma.customer.findUnique({
      where: { id: data.customerId }
    });

    if (!customer) {
      const error = new Error(`Customer with ID '${data.customerId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (!customer.isActive) {
      const error = new Error(`Cannot create subscription for inactive customer '${customer.customerCode}'.`);
      error.statusCode = 400;
      throw error;
    }

    // 2. Verify Plan
    const plan = await this.prisma.plan.findUnique({
      where: { id: data.planId },
      include: {
        product: true,
        planVariants: {
          include: { variant: true }
        }
      }
    });

    if (!plan) {
      const error = new Error(`Plan with ID '${data.planId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (!plan.isActive) {
      const error = new Error(`Cannot subscribe to inactive plan '${plan.name}'.`);
      error.statusCode = 400;
      throw error;
    }

    const billingCycle = data.billingCycle || plan.billingCycle;
    const customDuration = data.customDuration || plan.customDuration;
    const customDurationUnit = data.customDurationUnit || plan.customDurationUnit;

    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const currentPeriodStart = startDate;
    const currentPeriodEnd = calculateNextBillingDate(startDate, billingCycle, customDuration, customDurationUnit);
    const nextBillingDate = currentPeriodEnd;

    // 3. Generate Subscription Number
    const count = await this.prisma.subscription.count();
    const subscriptionNumber = `SUB-${String(count + 1).padStart(6, '0')}`;

    const qty = parseInt(data.quantity, 10) || 1;
    const unitPrice = new Prisma.Decimal(plan.price);
    const setupFee = new Prisma.Decimal(plan.setupFee || 0);
    const lineTotal = unitPrice.mul(qty);

    return await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          subscriptionNumber,
          customerId: data.customerId,
          planId: data.planId,
          quotationId: data.quotationId || null,
          status: 'ACTIVE',
          startDate,
          currentPeriodStart,
          currentPeriodEnd,
          nextBillingDate,
          billingCycleAnchor: startDate,
          billingCycle,
          recurringPrice: unitPrice,
          setupFee,
          currency: data.currency || plan.currency || 'INR',
          metadata: data.metadata || {},
          items: {
            create: [
              {
                planId: data.planId,
                quantity: qty,
                unitPrice,
                lineTotal,
                selectedVariants: (plan.planVariants || []).map(pv => ({
                  id: pv.variant.id,
                  name: pv.variant.name,
                  additionalPrice: new Prisma.Decimal(pv.variant.additionalPrice).toFixed(2)
                }))
              }
            ]
          }
        },
        include: {
          customer: true,
          plan: {
            include: { product: true }
          },
          items: true
        }
      });

      return this.formatSubscriptionResponse(subscription);
    });
  }

  /**
   * List subscriptions with Dual Pagination, role isolation, and filters.
   */
  async listSubscriptions(query = {}, user) {
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

    if (query.planId) {
      where.planId = query.planId;
    }

    if (query.search) {
      where.subscriptionNumber = {
        contains: String(query.search).trim(),
        mode: 'insensitive'
      };
    }

    const supportedSortFields = ['createdAt', 'currentPeriodEnd', 'recurringPrice', 'status'];
    const sortBy = supportedSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const result = await paginate({
      modelDelegate: this.prisma.subscription,
      where,
      include: {
        customer: true,
        plan: {
          include: { product: true }
        },
        items: true
      },
      paginationParams,
      sortBy,
      sortOrder
    });

    return {
      items: result.items.map(item => this.formatSubscriptionResponse(item)),
      pagination: result.pagination
    };
  }

  /**
   * Get subscription details by ID.
   */
  async getSubscriptionById(id, user) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        customer: true,
        plan: {
          include: { product: true }
        },
        items: true
      }
    });

    if (!subscription) {
      const error = new Error(`Subscription with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (user.role === 'CUSTOMER' && subscription.customerId !== user.customerId) {
      const error = new Error('Access denied: you do not own this subscription.');
      error.statusCode = 403;
      throw error;
    }

    return this.formatSubscriptionResponse(subscription);
  }

  /**
   * Update permitted subscription fields.
   */
  async updateSubscription(id, data) {
    const existing = await this.prisma.subscription.findUnique({
      where: { id }
    });

    if (!existing) {
      const error = new Error(`Subscription with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const updatePayload = {};
    if (data.metadata !== undefined) updatePayload.metadata = data.metadata;
    if (data.cancelAtPeriodEnd !== undefined) updatePayload.cancelAtPeriodEnd = data.cancelAtPeriodEnd;

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: updatePayload,
      include: {
        customer: true,
        plan: {
          include: { product: true }
        },
        items: true
      }
    });

    return this.formatSubscriptionResponse(updated);
  }

  /**
   * Change subscription status with lifecycle state machine.
   */
  async updateSubscriptionStatus(id, newStatus) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id }
    });

    if (!subscription) {
      const error = new Error(`Subscription with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const currentStatus = subscription.status;
    const allowed = VALID_SUBSCRIPTION_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      const error = new Error(`Invalid subscription transition from '${currentStatus}' to '${newStatus}'. Allowed transitions: ${allowed.join(', ') || 'none'}.`);
      error.statusCode = 400;
      throw error;
    }

    const updateData = { status: newStatus };
    if (newStatus === 'PAUSED') updateData.pausedAt = new Date();
    if (newStatus === 'ACTIVE' && currentStatus === 'PAUSED') updateData.resumedAt = new Date();
    if (newStatus === 'CANCELED') updateData.canceledAt = new Date();

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        plan: {
          include: { product: true }
        },
        items: true
      }
    });

    return this.formatSubscriptionResponse(updated);
  }

  /**
   * Pause an active subscription.
   */
  async pauseSubscription(id) {
    return this.updateSubscriptionStatus(id, 'PAUSED');
  }

  /**
   * Resume a paused subscription.
   */
  async resumeSubscription(id) {
    return this.updateSubscriptionStatus(id, 'ACTIVE');
  }

  /**
   * Cancel a subscription (immediate or at period end).
   */
  async cancelSubscription(id, { immediate = false, cancellationReason = null } = {}) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id }
    });

    if (!subscription) {
      const error = new Error(`Subscription with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (['CANCELED', 'EXPIRED'].includes(subscription.status)) {
      const error = new Error(`Cannot cancel a subscription that is already '${subscription.status}'.`);
      error.statusCode = 400;
      throw error;
    }

    if (immediate) {
      return this.updateSubscriptionStatus(id, 'CANCELED');
    }

    // End-of-period cancellation
    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        cancelAtPeriodEnd: true,
        cancellationReason: cancellationReason || null
      },
      include: {
        customer: true,
        plan: {
          include: { product: true }
        },
        items: true
      }
    });

    return this.formatSubscriptionResponse(updated);
  }
}

export const subscriptionsService = new SubscriptionsService();

