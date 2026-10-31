import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../utils/prisma.js';
import { parsePaginationParams, paginate } from '../../utils/pagination.js';
import { calculateNextBillingDate, BILLING_CYCLES } from '../../utils/billingCycle.js';
import { prorationService } from './proration.service.js';
import { creditsService } from '../credits/credits.service.js';
import { invoicesService } from '../invoices/invoices.service.js';

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
      scheduledPlanId: subscription.scheduledPlanId || null,
      scheduledPlan: subscription.scheduledPlan ? {
        id: subscription.scheduledPlan.id,
        name: subscription.scheduledPlan.name,
        billingCycle: subscription.scheduledPlan.billingCycle,
        price: new Prisma.Decimal(subscription.scheduledPlan.price || 0).toFixed(2)
      } : null,
      scheduledChangeAt: subscription.scheduledChangeAt || null,
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
        scheduledPlan: true,
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
        scheduledPlan: true,
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
        scheduledPlan: true,
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
        scheduledPlan: true,
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
        scheduledPlan: true,
        items: true
      }
    });

    return this.formatSubscriptionResponse(updated);
  }

  /**
   * Format subscription migration entity
   */
  formatMigrationResponse(m) {
    if (!m) return null;
    return {
      id: m.id,
      subscriptionId: m.subscriptionId,
      customerId: m.customerId,
      fromPlanId: m.fromPlanId,
      fromPlanName: m.fromPlan?.name || null,
      toPlanId: m.toPlanId,
      toPlanName: m.toPlan?.name || null,
      migrationType: m.migrationType,
      timing: m.timing,
      status: m.status,
      effectiveDate: m.effectiveDate,
      scheduledExecutionDate: m.scheduledExecutionDate,
      fromBillingCycle: m.fromBillingCycle,
      toBillingCycle: m.toBillingCycle,
      fromPrice: new Prisma.Decimal(m.fromPrice || 0).toFixed(2),
      toPrice: new Prisma.Decimal(m.toPrice || 0).toFixed(2),
      unusedAmount: new Prisma.Decimal(m.unusedAmount || 0).toFixed(2),
      newPlanAmount: new Prisma.Decimal(m.newPlanAmount || 0).toFixed(2),
      netAdjustment: new Prisma.Decimal(m.netAdjustment || 0).toFixed(2),
      creditApplied: new Prisma.Decimal(m.creditApplied || 0).toFixed(2),
      invoiceIssuedId: m.invoiceIssuedId || null,
      invoiceNumber: m.invoiceIssued?.invoiceNumber || null,
      idempotencyKey: m.idempotencyKey || null,
      metadata: m.metadata || null,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt
    };
  }

  /**
   * Preview plan migration calculation (read-only, zero DB mutations).
   */
  async previewMigration(subscriptionId, { targetPlanId, effectiveDate, timing = 'IMMEDIATE' } = {}) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        customer: true,
        plan: true
      }
    });

    if (!subscription) {
      const error = new Error(`Subscription with ID '${subscriptionId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (['CANCELED', 'EXPIRED'].includes(subscription.status)) {
      const error = new Error(`Cannot migrate subscription with status '${subscription.status}'.`);
      error.statusCode = 400;
      throw error;
    }

    const targetPlan = await this.prisma.plan.findUnique({
      where: { id: targetPlanId }
    });

    if (!targetPlan) {
      const error = new Error(`Target plan with ID '${targetPlanId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (!targetPlan.isActive) {
      const error = new Error(`Target plan '${targetPlan.name}' is inactive.`);
      error.statusCode = 400;
      throw error;
    }

    return prorationService.calculateProration({
      subscription,
      targetPlan,
      effectiveDate: effectiveDate || new Date(),
      timing,
      customerCreditBalance: subscription.customer?.creditBalance || 0
    });
  }

  /**
   * Execute plan migration atomically.
   */
  async migratePlan(subscriptionId, { targetPlanId, effectiveDate, timing = 'IMMEDIATE', idempotencyKey = null } = {}, user = null) {
    // 1. Idempotency Check
    if (idempotencyKey) {
      const existingMigration = await this.prisma.subscriptionMigration.findUnique({
        where: { idempotencyKey },
        include: {
          fromPlan: true,
          toPlan: true,
          invoiceIssued: true,
          subscription: {
            include: {
              customer: true,
              plan: { include: { product: true } },
              scheduledPlan: true,
              items: true
            }
          }
        }
      });

      if (existingMigration) {
        return {
          migration: this.formatMigrationResponse(existingMigration),
          subscription: this.formatSubscriptionResponse(existingMigration.subscription),
          isDuplicate: true,
          message: 'Plan migration was previously processed with this idempotency key.'
        };
      }
    }

    // 2. Atomic execution
    try {
      return await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          customer: true,
          plan: true,
          scheduledPlan: true,
          items: true
        }
      });

      if (!subscription) {
        const error = new Error(`Subscription with ID '${subscriptionId}' not found.`);
        error.statusCode = 404;
        throw error;
      }

      if (['CANCELED', 'EXPIRED'].includes(subscription.status)) {
        const error = new Error(`Cannot migrate subscription with status '${subscription.status}'.`);
        error.statusCode = 400;
        throw error;
      }

      const targetPlan = await tx.plan.findUnique({
        where: { id: targetPlanId }
      });

      if (!targetPlan) {
        const error = new Error(`Target plan with ID '${targetPlanId}' not found.`);
        error.statusCode = 404;
        throw error;
      }

      if (!targetPlan.isActive) {
        const error = new Error(`Target plan '${targetPlan.name}' is inactive.`);
        error.statusCode = 400;
        throw error;
      }

      if (subscription.planId === targetPlan.id && !subscription.scheduledPlanId) {
        const error = new Error(`Subscription is already active on plan '${targetPlan.name}'.`);
        error.statusCode = 400;
        throw error;
      }

      // Fetch customer current balance inside transaction
      const customer = await tx.customer.findUnique({
        where: { id: subscription.customerId }
      });
      const customerCreditBalance = customer?.creditBalance || 0;

      // Calculate proration
      const proration = prorationService.calculateProration({
        subscription,
        targetPlan,
        effectiveDate: effectiveDate || new Date(),
        timing,
        customerCreditBalance
      });

      // Branch on timing
      if (timing === 'NEXT_CYCLE') {
        // Schedule migration for periodEnd
        const updatedSub = await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            scheduledPlanId: targetPlan.id,
            scheduledChangeAt: subscription.currentPeriodEnd
          },
          include: {
            customer: true,
            plan: { include: { product: true } },
            scheduledPlan: true,
            items: true
          }
        });

        const migration = await tx.subscriptionMigration.create({
          data: {
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            fromPlanId: subscription.planId,
            toPlanId: targetPlan.id,
            migrationType: proration.migrationType,
            timing: 'NEXT_CYCLE',
            status: 'SCHEDULED',
            effectiveDate: subscription.currentPeriodEnd,
            scheduledExecutionDate: subscription.currentPeriodEnd,
            fromBillingCycle: subscription.billingCycle,
            toBillingCycle: targetPlan.billingCycle,
            fromPrice: new Prisma.Decimal(subscription.recurringPrice || 0),
            toPrice: new Prisma.Decimal(targetPlan.price || 0),
            unusedAmount: new Prisma.Decimal(0),
            newPlanAmount: new Prisma.Decimal(0),
            netAdjustment: new Prisma.Decimal(0),
            creditApplied: new Prisma.Decimal(0),
            idempotencyKey,
            metadata: {
              requestedByUserId: user?.id || null,
              prorationPreview: proration
            }
          },
          include: {
            fromPlan: true,
            toPlan: true
          }
        });

        return {
          migration: this.formatMigrationResponse(migration),
          subscription: this.formatSubscriptionResponse(updatedSub),
          isDuplicate: false,
          message: `Plan change to '${targetPlan.name}' successfully scheduled for renewal on ${subscription.currentPeriodEnd.toISOString().slice(0, 10)}.`
        };
      }

      // IMMEDIATE MIGRATION
      let createdInvoice = null;
      let creditTransaction = null;
      const creditApplied = new Prisma.Decimal(proration.proration.creditApplied);
      const creditOwed = new Prisma.Decimal(proration.proration.creditOwed);
      const amountDue = new Prisma.Decimal(proration.proration.amountDue);

      // Handle Upgrade Invoice Generation
      if (proration.migrationType === 'UPGRADE' && amountDue.gt(0)) {
        const invoiceNumber = await invoicesService.generateInvoiceNumber(tx);
        const invDate = new Date();
        const dueDate = invoicesService.calculateDueDate(invDate, 'IMMEDIATE');

        createdInvoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            customerId: subscription.customerId,
            subscriptionId: subscription.id,
            status: 'ISSUED',
            invoiceDate: invDate,
            dueDate,
            periodStart: proration.effectiveDate,
            periodEnd: subscription.currentPeriodEnd,
            currency: subscription.currency,
            subtotal: amountDue,
            discountAmount: new Prisma.Decimal(0),
            taxAmount: new Prisma.Decimal(0),
            totalAmount: amountDue,
            amountPaid: new Prisma.Decimal(0),
            amountDue,
            subtotalInCents: Math.round(amountDue.toNumber() * 100),
            discountInCents: 0,
            taxInCents: 0,
            totalInCents: Math.round(amountDue.toNumber() * 100),
            amountPaidInCents: 0,
            amountDueInCents: Math.round(amountDue.toNumber() * 100),
            notes: `Prorated adjustment invoice for plan upgrade from ${subscription.plan?.name} to ${targetPlan.name}.`,
            items: {
              create: [
                {
                  productId: targetPlan.productId,
                  planId: targetPlan.id,
                  description: `Proration Upgrade: ${targetPlan.name} [${proration.effectiveDate.toISOString().slice(0, 10)} to ${subscription.currentPeriodEnd.toISOString().slice(0, 10)}]`,
                  quantity: 1,
                  unitPrice: amountDue,
                  discountAmount: new Prisma.Decimal(0),
                  taxAmount: new Prisma.Decimal(0),
                  taxRate: new Prisma.Decimal(0),
                  lineSubtotal: amountDue,
                  lineTotal: amountDue,
                  unitPriceInCents: Math.round(amountDue.toNumber() * 100),
                  totalInCents: Math.round(amountDue.toNumber() * 100)
                }
              ]
            }
          },
          include: {
            customer: true,
            subscription: true,
            items: true
          }
        });
      }

      // Update Subscription atomically (preserves billingCycleAnchor)
      const updatedSub = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: targetPlan.id,
          recurringPrice: targetPlan.price,
          billingCycle: targetPlan.billingCycle,
          scheduledPlanId: null,
          scheduledChangeAt: null
        },
        include: {
          customer: true,
          plan: { include: { product: true } },
          scheduledPlan: true,
          items: true
        }
      });

      // Record immutable migration history before credit transaction so migrationId is known
      const migration = await tx.subscriptionMigration.create({
        data: {
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          fromPlanId: subscription.planId,
          toPlanId: targetPlan.id,
          migrationType: proration.migrationType,
          timing: 'IMMEDIATE',
          status: 'COMPLETED',
          effectiveDate: proration.effectiveDate,
          scheduledExecutionDate: null,
          fromBillingCycle: subscription.billingCycle,
          toBillingCycle: targetPlan.billingCycle,
          fromPrice: new Prisma.Decimal(subscription.recurringPrice || 0),
          toPrice: new Prisma.Decimal(targetPlan.price || 0),
          unusedAmount: new Prisma.Decimal(proration.proration.unusedAmount),
          newPlanAmount: new Prisma.Decimal(proration.proration.newPlanAmount),
          netAdjustment: new Prisma.Decimal(proration.proration.netAdjustment),
          creditApplied,
          invoiceIssuedId: createdInvoice?.id || null,
          idempotencyKey,
          metadata: {
            requestedByUserId: user?.id || null,
            prorationDetails: proration.proration
          }
        },
        include: {
          fromPlan: true,
          toPlan: true,
          invoiceIssued: true
        }
      });

      // Record immutable credit transaction with relations directly (write-once ledger)
      if (proration.migrationType === 'UPGRADE' && creditApplied.gt(0)) {
        creditTransaction = await creditsService.applyCredit({
          customerId: subscription.customerId,
          amount: creditApplied,
          subscriptionId: subscription.id,
          invoiceId: createdInvoice?.id || null,
          migrationId: migration.id,
          currency: subscription.currency,
          reason: `Credit applied to ${targetPlan.name} upgrade adjustment`,
          idempotencyKey: idempotencyKey ? `${idempotencyKey}-cred-app` : null,
          tx
        });
      } else if (proration.migrationType === 'DOWNGRADE' && creditOwed.gt(0)) {
        creditTransaction = await creditsService.issueCredit({
          customerId: subscription.customerId,
          amount: creditOwed,
          type: 'PRORATION_CREDIT',
          subscriptionId: subscription.id,
          migrationId: migration.id,
          currency: subscription.currency,
          reason: `Proration credit for immediate downgrade from ${subscription.plan?.name} to ${targetPlan.name}`,
          idempotencyKey: idempotencyKey ? `${idempotencyKey}-cred-iss` : null,
          tx
        });
      }

        return {
          migration: this.formatMigrationResponse(migration),
          subscription: this.formatSubscriptionResponse(updatedSub),
          invoice: createdInvoice ? invoicesService.formatInvoiceResponse(createdInvoice) : null,
          isDuplicate: false,
          message: `Plan successfully migrated to '${targetPlan.name}'.`
        };
      });
    } catch (err) {
      if (err.code === 'P2002' && idempotencyKey && (err.meta?.target?.includes('idempotencyKey') || String(err.message).includes('idempotencyKey'))) {
        const existingMigration = await this.prisma.subscriptionMigration.findUnique({
          where: { idempotencyKey },
          include: {
            fromPlan: true,
            toPlan: true,
            invoiceIssued: true,
            subscription: {
              include: {
                customer: true,
                plan: { include: { product: true } },
                scheduledPlan: true,
                items: true
              }
            }
          }
        });

        if (existingMigration) {
          return {
            migration: this.formatMigrationResponse(existingMigration),
            subscription: this.formatSubscriptionResponse(existingMigration.subscription),
            isDuplicate: true,
            message: 'Plan migration was previously processed with this idempotency key.'
          };
        }
      }
      throw err;
    }
  }

  /**
   * Cancel a pending scheduled plan migration.
   */
  async cancelScheduledMigration(subscriptionId, user = null) {
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: { scheduledPlan: true }
      });

      if (!subscription) {
        const error = new Error(`Subscription with ID '${subscriptionId}' not found.`);
        error.statusCode = 404;
        throw error;
      }

      if (!subscription.scheduledPlanId) {
        const error = new Error('No scheduled plan migration found for this subscription.');
        error.statusCode = 400;
        throw error;
      }

      // Clear scheduled fields on subscription
      const updatedSub = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          scheduledPlanId: null,
          scheduledChangeAt: null
        },
        include: {
          customer: true,
          plan: { include: { product: true } },
          scheduledPlan: true,
          items: true
        }
      });

      // Update scheduled migration record to CANCELLED
      await tx.subscriptionMigration.updateMany({
        where: {
          subscriptionId,
          status: 'SCHEDULED'
        },
        data: {
          status: 'CANCELLED'
        }
      });

      return {
        subscription: this.formatSubscriptionResponse(updatedSub),
        message: 'Scheduled plan migration successfully cancelled.'
      };
    });
  }

  /**
   * List migration history for a subscription.
   */
  async listMigrations(subscriptionId) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      const error = new Error(`Subscription with ID '${subscriptionId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const migrations = await this.prisma.subscriptionMigration.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
      include: {
        fromPlan: true,
        toPlan: true,
        invoiceIssued: true
      }
    });

    return migrations.map(m => this.formatMigrationResponse(m));
  }
}

export const subscriptionsService = new SubscriptionsService();

