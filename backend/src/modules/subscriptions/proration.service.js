import { Prisma } from '@prisma/client';

export class ProrationService {
  /**
   * Deterministic Proration Engine using Prisma.Decimal.
   * Rounding policy: ROUND_HALF_UP to 2 decimal places.
   *
   * @param {object} params
   * @param {object} params.subscription - Current subscription with dates, recurringPrice, currency
   * @param {object} params.targetPlan - Target plan with price, billingCycle, currency
   * @param {Date|string} [params.effectiveDate] - Date of plan change (defaults to now)
   * @param {'IMMEDIATE'|'NEXT_CYCLE'} [params.timing='IMMEDIATE']
   * @param {number|string|Prisma.Decimal} [params.customerCreditBalance=0]
   * @returns {object} Proration calculation breakdown
   */
  calculateProration({
    subscription,
    targetPlan,
    effectiveDate = new Date(),
    timing = 'IMMEDIATE',
    customerCreditBalance = 0,
    taxRate = 0,
    discountPercentage = 0
  }) {
    if (!subscription) {
      throw new Error('Subscription is required for proration calculation');
    }
    if (!targetPlan) {
      throw new Error('Target plan is required for proration calculation');
    }

    // 1. Currency Validation
    const subCurrency = subscription.currency || 'INR';
    const planCurrency = targetPlan.currency || 'INR';
    if (subCurrency.toUpperCase() !== planCurrency.toUpperCase()) {
      const error = new Error(`Cannot migrate between plans with different currencies: from ${subCurrency} to ${planCurrency}`);
      error.statusCode = 400;
      throw error;
    }

    const effDate = new Date(effectiveDate);
    const periodStart = new Date(subscription.currentPeriodStart);
    const periodEnd = new Date(subscription.currentPeriodEnd);

    if (isNaN(effDate.getTime()) || isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      const error = new Error('Invalid billing period dates provided for proration');
      error.statusCode = 400;
      throw error;
    }

    const oldPrice = new Prisma.Decimal(subscription.recurringPrice || 0);
    const newPrice = new Prisma.Decimal(targetPlan.price || 0);
    const availableCredit = new Prisma.Decimal(customerCreditBalance || 0);

    // Determine migration type
    let migrationType = 'SAME_PLAN_CYCLE_CHANGE';
    if (newPrice.gt(oldPrice)) {
      migrationType = 'UPGRADE';
    } else if (newPrice.lt(oldPrice)) {
      migrationType = 'DOWNGRADE';
    } else if (subscription.planId !== targetPlan.id) {
      migrationType = 'SAME_PLAN_CYCLE_CHANGE';
    }

    // 2. Next Cycle Migration: zero immediate proration, executes at periodEnd
    if (timing === 'NEXT_CYCLE') {
      return {
        migrationType,
        timing: 'NEXT_CYCLE',
        effectiveDate: periodEnd,
        scheduledExecutionDate: periodEnd,
        billingPeriod: {
          start: periodStart,
          end: periodEnd,
          totalSeconds: Math.max(0, Math.floor((periodEnd.getTime() - periodStart.getTime()) / 1000)),
          remainingSeconds: 0,
          remainingFraction: '0.000000'
        },
        pricing: {
          fromPlanId: subscription.planId,
          fromPlanName: subscription.plan?.name || 'Current Plan',
          fromBillingCycle: subscription.billingCycle,
          fromPrice: oldPrice.toFixed(2),
          toPlanId: targetPlan.id,
          toPlanName: targetPlan.name,
          toBillingCycle: targetPlan.billingCycle,
          toPrice: newPrice.toFixed(2),
          currency: subCurrency
        },
        proration: {
          unusedAmount: '0.00',
          newPlanAmount: '0.00',
          netAdjustment: '0.00',
          creditOwed: '0.00',
          creditApplied: '0.00',
          amountDue: '0.00',
          customerCreditBalanceBefore: availableCredit.toFixed(2),
          customerCreditBalanceAfter: availableCredit.toFixed(2)
        },
        actions: {
          requiresInvoice: false,
          requiresCreditIssuance: false,
          isScheduled: true
        }
      };
    }

    // 3. Immediate Migration: Calculate exact fraction of remaining period
    const totalDurationMs = periodEnd.getTime() - periodStart.getTime();
    if (totalDurationMs <= 0) {
      const error = new Error('Subscription periodEnd must be strictly after periodStart');
      error.statusCode = 400;
      throw error;
    }

    // Clamp effectiveDate within [periodStart, periodEnd]
    const clampedEffMs = Math.min(Math.max(effDate.getTime(), periodStart.getTime()), periodEnd.getTime());
    const remainingMs = periodEnd.getTime() - clampedEffMs;

    const totalSeconds = Math.floor(totalDurationMs / 1000);
    const remainingSeconds = Math.floor(remainingMs / 1000);

    const remainingFraction = totalSeconds > 0
      ? new Prisma.Decimal(remainingSeconds).dividedBy(new Prisma.Decimal(totalSeconds))
      : new Prisma.Decimal(0);

    // Unused old plan value = Old recurring price * Remaining fraction (ROUND_HALF_UP)
    const unusedAmount = oldPrice.mul(remainingFraction).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    // New plan value for remaining period = New recurring price * Remaining fraction (ROUND_HALF_UP)
    // Note: Setup fee is strictly 0.00 during migration per business rules
    const newPlanAmount = newPrice.mul(remainingFraction).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    // Net adjustment = New plan value - Unused old plan value
    const netAdjustment = newPlanAmount.minus(unusedAmount);

    let creditOwed = new Prisma.Decimal(0);
    let creditApplied = new Prisma.Decimal(0);
    let amountDue = new Prisma.Decimal(0);
    let newCreditBalance = availableCredit;

    const decDiscountPct = new Prisma.Decimal(discountPercentage || 0);
    const decTaxRate = new Prisma.Decimal(taxRate || 0);

    let discountAmount = new Prisma.Decimal(0);
    if (decDiscountPct.gt(0)) {
      const discFactor = decDiscountPct.gt(100) ? decDiscountPct.div(10000) : decDiscountPct.div(100);
      discountAmount = netAdjustment.mul(discFactor).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    }
    const taxableAmount = Prisma.Decimal.max(0, netAdjustment.minus(discountAmount));
    const taxAmount = decTaxRate.gt(0)
      ? taxableAmount.mul(decTaxRate).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      : new Prisma.Decimal(0);

    const grossCharge = taxableAmount.plus(taxAmount);

    if (netAdjustment.gt(0)) {
      // UPGRADE: Customer owes money (grossCharge)
      // Apply available credit up to grossCharge
      if (availableCredit.gt(0)) {
        creditApplied = Prisma.Decimal.min(availableCredit, grossCharge);
        newCreditBalance = availableCredit.minus(creditApplied);
      }
      amountDue = grossCharge.minus(creditApplied);
    } else if (netAdjustment.lt(0)) {
      // DOWNGRADE: Customer is owed money (credit)
      creditOwed = netAdjustment.abs();
      newCreditBalance = availableCredit.plus(creditOwed);
    }

    return {
      migrationType,
      timing: 'IMMEDIATE',
      effectiveDate: new Date(clampedEffMs),
      scheduledExecutionDate: null,
      billingPeriod: {
        start: periodStart,
        end: periodEnd,
        totalSeconds,
        remainingSeconds,
        remainingFraction: remainingFraction.toFixed(6)
      },
      pricing: {
        fromPlanId: subscription.planId,
        fromPlanName: subscription.plan?.name || 'Current Plan',
        fromBillingCycle: subscription.billingCycle,
        fromPrice: oldPrice.toFixed(2),
        toPlanId: targetPlan.id,
        toPlanName: targetPlan.name,
        toBillingCycle: targetPlan.billingCycle,
        toPrice: newPrice.toFixed(2),
        currency: subCurrency
      },
      proration: {
        unusedAmount: unusedAmount.toFixed(2),
        newPlanAmount: newPlanAmount.toFixed(2),
        netAdjustment: netAdjustment.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        taxableAmount: taxableAmount.toFixed(2),
        taxRate: decTaxRate.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        grossCharge: grossCharge.toFixed(2),
        creditOwed: creditOwed.toFixed(2),
        creditApplied: creditApplied.toFixed(2),
        amountDue: amountDue.toFixed(2),
        customerCreditBalanceBefore: availableCredit.toFixed(2),
        customerCreditBalanceAfter: newCreditBalance.toFixed(2)
      },
      actions: {
        requiresInvoice: amountDue.gt(0),
        requiresCreditIssuance: creditOwed.gt(0),
        isScheduled: false
      }
    };
  }
}

export const prorationService = new ProrationService();

