import { Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../utils/prisma.js';
import { calculateNextBillingDate } from '../../utils/billingCycle.js';
import { invoicesService } from './invoices.service.js';

export class BillingService {
  constructor(prismaClient = defaultPrisma) {
    this.prisma = prismaClient;
  }

  /**
   * Generate an invoice for an active subscription for its due billing period.
   * Atomically creates the invoice and advances the subscription's nextBillingDate.
   * Idempotent: safe against duplicate runs for the same subscription and period.
   */
  async generateSubscriptionInvoice(subscriptionId, asOfDate = new Date()) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        customer: true,
        plan: true,
        items: true,
        invoices: true
      }
    });

    if (!sub) {
      const error = new Error(`Subscription with ID '${subscriptionId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (sub.status !== 'ACTIVE') {
      const error = new Error(`Cannot generate invoice for subscription with status '${sub.status}'. Subscription must be ACTIVE.`);
      error.statusCode = 400;
      throw error;
    }

    // 1. Determine billing period
    const periodStart = new Date(sub.currentPeriodStart || sub.startDate);
    const periodEnd = new Date(sub.currentPeriodEnd || calculateNextBillingDate(
      periodStart,
      sub.billingCycle,
      sub.plan?.customDuration,
      sub.plan?.customDurationUnit
    ));

    // 2. Idempotency Check: check if invoice already exists for this exact subscription and billing period
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        subscriptionId,
        periodStart,
        periodEnd
      },
      include: {
        customer: true,
        subscription: true,
        items: true
      }
    });

    if (existingInvoice) {
      return {
        invoice: invoicesService.formatInvoiceResponse(existingInvoice),
        subscription: sub,
        isDuplicate: true,
        message: 'Invoice already exists for this subscription and billing period (idempotent result).'
      };
    }

    // 3. Check if setup fee applies (only on the very first invoice if setupFee > 0)
    const hasPriorInvoices = (sub.invoices || []).length > 0;
    const setupFee = new Prisma.Decimal(sub.setupFee || 0);
    const applySetupFee = !hasPriorInvoices && setupFee.gt(0);

    // 4. Construct authoritative line items from subscription snapshots
    const items = [];

    // Main plan line item (uses scheduledPlan price if a scheduled migration is taking effect)
    let recurringPrice = new Prisma.Decimal(sub.recurringPrice || 0);
    let planName = sub.plan?.name || 'Subscription Plan';
    let productId = sub.plan?.productId || null;
    let planId = sub.planId || null;
    let billingCycle = sub.billingCycle;

    if (sub.scheduledPlanId) {
      const scheduledPlan = await this.prisma.plan.findUnique({
        where: { id: sub.scheduledPlanId }
      });
      if (scheduledPlan) {
        recurringPrice = new Prisma.Decimal(scheduledPlan.price || 0);
        planName = scheduledPlan.name;
        productId = scheduledPlan.productId;
        planId = scheduledPlan.id;
        billingCycle = scheduledPlan.billingCycle;
      }
    }

    items.push({
      productId,
      planId,
      description: `${planName} (${billingCycle}) [${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}]`,
      quantity: 1,
      unitPrice: recurringPrice,
      discountAmount: new Prisma.Decimal(0),
      taxRate: new Prisma.Decimal(0),
      taxAmount: new Prisma.Decimal(0),
      lineSubtotal: recurringPrice,
      lineTotal: recurringPrice,
      unitPriceInCents: Math.round(recurringPrice.toNumber() * 100),
      totalInCents: Math.round(recurringPrice.toNumber() * 100)
    });

    // Optional setup fee line item
    if (applySetupFee) {
      items.push({
        productId: sub.plan?.productId || null,
        planId: sub.planId || null,
        description: `${planName} - One-time Setup Fee`,
        quantity: 1,
        unitPrice: setupFee,
        discountAmount: new Prisma.Decimal(0),
        taxRate: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        lineSubtotal: setupFee,
        lineTotal: setupFee,
        unitPriceInCents: Math.round(setupFee.toNumber() * 100),
        totalInCents: Math.round(setupFee.toNumber() * 100)
      });
    }

    // Additional subscription items (add-ons / variants)
    if (sub.items && sub.items.length > 0) {
      for (const item of sub.items) {
        // Skip primary plan item if already captured in recurringPrice
        if (item.planId === sub.planId || item.planId === sub.scheduledPlanId || sub.items.length === 1) {
          continue;
        }
        const itemPrice = new Prisma.Decimal(item.unitPrice || 0);
        const itemQty = item.quantity || 1;
        const itemLineTotal = itemPrice.mul(itemQty);

        items.push({
          planId: item.planId,
          subscriptionItemId: item.id,
          description: `Subscription Add-on / Item (Qty: ${itemQty})`,
          quantity: itemQty,
          unitPrice: itemPrice,
          discountAmount: new Prisma.Decimal(0),
          taxRate: new Prisma.Decimal(0),
          taxAmount: new Prisma.Decimal(0),
          lineSubtotal: itemLineTotal,
          lineTotal: itemLineTotal,
          unitPriceInCents: Math.round(itemPrice.toNumber() * 100),
          totalInCents: Math.round(itemLineTotal.toNumber() * 100)
        });
      }
    }

    // 5. Calculate invoice totals
    let subtotal = new Prisma.Decimal(0);
    for (const item of items) {
      subtotal = subtotal.plus(item.lineSubtotal);
    }
    const totalAmount = subtotal;

    // Due date: NET_15 by default
    const invoiceDate = new Date(asOfDate);
    const dueDate = invoicesService.calculateDueDate(invoiceDate, 'NET_15');

    // 6. Calculate next billing period for the subscription
    const nextPeriodStart = new Date(periodEnd);
    const nextPeriodEnd = calculateNextBillingDate(
      nextPeriodStart,
      sub.billingCycle,
      sub.plan?.customDuration,
      sub.plan?.customDurationUnit
    );

    // 7. Atomic transaction: create invoice & advance subscription
    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const invoiceNumber = await invoicesService.generateInvoiceNumber(tx);

          const invoice = await tx.invoice.create({
            data: {
              invoiceNumber,
              customerId: sub.customerId,
              subscriptionId: sub.id,
              status: 'ISSUED',
              invoiceDate,
              dueDate,
              periodStart,
              periodEnd,
              currency: sub.currency,
              subtotal,
              discountAmount: new Prisma.Decimal(0),
              taxAmount: new Prisma.Decimal(0),
              totalAmount,
              amountPaid: new Prisma.Decimal(0),
              amountDue: totalAmount,
              subtotalInCents: Math.round(subtotal.toNumber() * 100),
              discountInCents: 0,
              taxInCents: 0,
              totalInCents: Math.round(totalAmount.toNumber() * 100),
              amountPaidInCents: 0,
              amountDueInCents: Math.round(totalAmount.toNumber() * 100),
              issuedAt: invoiceDate,
              notes: `Automated recurring invoice for period ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`,
              items: {
                create: items
              }
            },
            include: {
              customer: true,
              subscription: true,
              items: true
            }
          });

          // Advance subscription dates and apply scheduled migration if present
          const subUpdateData = {
            currentPeriodStart: nextPeriodStart,
            currentPeriodEnd: nextPeriodEnd,
            nextBillingDate: nextPeriodEnd
          };

          if (sub.scheduledPlanId) {
            const scheduledPlan = await tx.plan.findUnique({
              where: { id: sub.scheduledPlanId }
            });
            if (scheduledPlan) {
              subUpdateData.planId = scheduledPlan.id;
              subUpdateData.billingCycle = scheduledPlan.billingCycle;
              subUpdateData.recurringPrice = scheduledPlan.price;
              subUpdateData.scheduledPlanId = null;
              subUpdateData.scheduledChangeAt = null;

              subUpdateData.currentPeriodEnd = calculateNextBillingDate(
                nextPeriodStart,
                scheduledPlan.billingCycle,
                scheduledPlan.customDuration,
                scheduledPlan.customDurationUnit
              );
              subUpdateData.nextBillingDate = subUpdateData.currentPeriodEnd;

              await tx.subscriptionMigration.updateMany({
                where: {
                  subscriptionId: sub.id,
                  status: 'SCHEDULED'
                },
                data: {
                  status: 'COMPLETED',
                  effectiveDate: nextPeriodStart
                }
              });
            }
          }

          const updatedSub = await tx.subscription.update({
            where: { id: sub.id },
            data: subUpdateData
          });

          return { invoice, subscription: updatedSub };
        }, { maxWait: 15000, timeout: 30000 });

        return {
          invoice: invoicesService.formatInvoiceResponse(result.invoice),
          subscription: result.subscription,
          isDuplicate: false
        };
      } catch (err) {
        // Unique constraint on subscriptionId + periodStart + periodEnd (duplicate concurrent run)
        if (
          err.code === 'P2002' &&
          (err.message?.includes('subscriptionId') || err.message?.includes('periodStart') || err.message?.includes('periodEnd'))
        ) {
          const fallbackInvoice = await this.prisma.invoice.findFirst({
            where: { subscriptionId, periodStart, periodEnd },
            include: { customer: true, subscription: true, items: true }
          });
          if (fallbackInvoice) {
            return {
              invoice: invoicesService.formatInvoiceResponse(fallbackInvoice),
              subscription: sub,
              isDuplicate: true,
              message: 'Invoice was concurrently generated for this period.'
            };
          }
        }

        // Unique constraint on invoiceNumber collision - retry with next sequence number
        if (
          attempts < 5 &&
          (err.code === 'P2002' || err.message?.includes('invoiceNumber'))
        ) {
          continue;
        }

        throw err;
      }
    }
  }

  /**
   * Run automated recurring billing cycle across all due active subscriptions.
   */
  async generateRecurringInvoices(asOfDate = new Date()) {
    console.log(`[Billing Engine] Scanning active subscriptions due for billing as of ${asOfDate.toISOString()}...`);

    const dueSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        nextBillingDate: {
          lte: asOfDate
        }
      },
      include: {
        customer: true,
        plan: true
      }
    });

    console.log(`[Billing Engine] Found ${dueSubscriptions.length} due active subscriptions.`);

    const results = {
      processed: dueSubscriptions.length,
      succeeded: 0,
      failed: 0,
      details: []
    };

    for (const sub of dueSubscriptions) {
      try {
        const generated = await this.generateSubscriptionInvoice(sub.id, asOfDate);
        results.succeeded++;
        results.details.push({
          subscriptionId: sub.id,
          subscriptionNumber: sub.subscriptionNumber,
          invoiceNumber: generated.invoice?.invoiceNumber,
          isDuplicate: generated.isDuplicate,
          status: 'SUCCESS'
        });
      } catch (err) {
        results.failed++;
        console.error(`[Billing Engine] Failed generating invoice for subscription ${sub.id}:`, err.message);
        results.details.push({
          subscriptionId: sub.id,
          subscriptionNumber: sub.subscriptionNumber,
          error: err.message,
          status: 'FAILED'
        });
      }
    }

    return results;
  }

  /**
   * Reusable overdue-status service:
   * Finds unpaid issued invoices whose dueDate is past, and marks them as OVERDUE.
   * Does NOT modify invoice totals.
   */
  async checkAndUpdateOverdueInvoices(asOfDate = new Date()) {
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OPEN'] },
        dueDate: { lt: asOfDate },
        amountDue: { gt: 0 }
      }
    });

    let updatedCount = 0;
    for (const invoice of overdueInvoices) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'OVERDUE' }
      });
      updatedCount++;
    }

    return {
      processedCount: overdueInvoices.length,
      updatedCount
    };
  }
}

export const billingService = new BillingService();
