import { Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../utils/prisma.js';

export function normalizeToMrr(recurringPrice, billingCycle) {
  const price = new Prisma.Decimal(recurringPrice || 0);
  const cycle = String(billingCycle || 'MONTHLY').toUpperCase();

  switch (cycle) {
    case 'DAILY':
      return price.mul(365).div(12);
    case 'WEEKLY':
      return price.mul(52).div(12);
    case 'MONTHLY':
      return price;
    case 'QUARTERLY':
      return price.div(3);
    case 'HALF_YEARLY':
    case 'SEMI_ANNUAL':
      return price.div(6);
    case 'YEARLY':
    case 'ANNUAL':
      return price.div(12);
    default:
      return price;
  }
}

export function toDecimalString(val, decimals = 2) {
  if (val === null || val === undefined) return '0.00';
  if (val instanceof Prisma.Decimal) return val.toFixed(decimals);
  try {
    return new Prisma.Decimal(val).toFixed(decimals);
  } catch {
    return '0.00';
  }
}

export function getPeriodKey(date, interval = 'monthly') {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');

  switch (String(interval).toLowerCase()) {
    case 'daily':
      return `${year}-${month}-${day}`;
    case 'weekly': {
      const tempDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const dayNum = tempDate.getUTCDay() || 7;
      tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
      return `${tempDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    }
    case 'yearly':
      return `${year}`;
    case 'monthly':
    default:
      return `${year}-${month}`;
  }
}

export class AnalyticsService {
  constructor(prismaClient = defaultPrisma) {
    this.prisma = prismaClient;
  }

  /**
   * Helper to execute aggregate with fallback to findMany for mock environments
   * Real database errors will propagate and will NOT be silently swallowed.
   */
  async safeAggregate(model, options) {
    if (typeof model?.aggregate === 'function') {
      try {
        return await model.aggregate(options);
      } catch (err) {
        if (err.message?.includes('refundedAmount') || err.message?.includes('Unknown field')) {
          const cleanOptions = { ...options };
          if (cleanOptions._sum) {
            cleanOptions._sum = { ...cleanOptions._sum };
            delete cleanOptions._sum.refundedAmount;
          }
          return await model.aggregate(cleanOptions);
        }
        throw err;
      }
    }
    // Only fall back to in-memory summation if model.aggregate is not implemented (e.g. partial test mocks)
    if (typeof model?.findMany === 'function') {
      const items = await model.findMany({ where: options.where || {} });
      const _sum = {};
      if (options._sum) {
        for (const field of Object.keys(options._sum)) {
          let total = new Prisma.Decimal(0);
          for (const item of items) {
            if (item[field] !== undefined && item[field] !== null) {
              total = total.plus(new Prisma.Decimal(item[field]));
            }
          }
          _sum[field] = total;
        }
      }
      return { _sum, _count: { _all: items.length } };
    }
    return { _sum: {}, _count: { _all: 0 } };
  }

  /**
   * 1. Dashboard Summary
   * GET /api/v1/analytics/summary
   */
  async getSummary() {
    const [
      totalCustomers,
      activeCustomers,
      totalProducts,
      activeSubscriptions,
      pendingSubscriptions,
      cancelledSubscriptions,
      totalQuotations,
      acceptedQuotations,
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      overdueInvoices,
      invoiceAgg,
      paymentAgg,
      refundAgg
    ] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.count({ where: { isActive: true } }),
      this.prisma.product.count(),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subscription.count({ where: { status: 'TRIALING' } }),
      this.prisma.subscription.count({ where: { status: 'CANCELED' } }),
      this.prisma.quotation.count(),
      this.prisma.quotation.count({ where: { status: 'ACCEPTED' } }),
      this.prisma.invoice.count({ where: { status: { notIn: ['DRAFT', 'VOID'] } } }),
      this.prisma.invoice.count({ where: { status: 'PAID' } }),
      this.prisma.invoice.count({ where: { status: { in: ['ISSUED', 'OPEN', 'PARTIALLY_PAID', 'OVERDUE'] } } }),
      this.prisma.invoice.count({ where: { status: 'OVERDUE' } }),
      this.safeAggregate(this.prisma.invoice, {
        where: { status: { notIn: ['DRAFT', 'VOID'] } },
        _sum: { totalAmount: true, amountPaid: true, amountDue: true }
      }),
      this.safeAggregate(this.prisma.payment, {
        where: { status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
        _sum: { amount: true, refundedAmount: true }
      }),
      this.safeAggregate(this.prisma.refund, {
        where: { status: 'SUCCEEDED' },
        _sum: { amount: true }
      })
    ]);

    const totalInvoicedAmount = new Prisma.Decimal(invoiceAgg._sum?.totalAmount || 0);
    const refundedFromRefunds = new Prisma.Decimal(refundAgg._sum?.amount || 0);
    const refundedFromPayments = new Prisma.Decimal(paymentAgg._sum?.refundedAmount || 0);
    const totalRefundedAmount = refundedFromRefunds.greaterThan(0)
      ? refundedFromRefunds
      : refundedFromPayments;

    const grossCollectedFromPayments = new Prisma.Decimal(paymentAgg._sum?.amount || 0);
    const netCollectedFromPayments = Prisma.Decimal.max(0, grossCollectedFromPayments.minus(totalRefundedAmount));
    const collectedFromInvoices = new Prisma.Decimal(invoiceAgg._sum?.amountPaid || 0);
    const totalCollectedAmount = grossCollectedFromPayments.greaterThan(0)
      ? netCollectedFromPayments
      : collectedFromInvoices;

    const totalOutstandingAmount = new Prisma.Decimal(invoiceAgg._sum?.amountDue || 0);

    let collectionRate = '0.00';
    if (totalInvoicedAmount.greaterThan(0)) {
      collectionRate = totalCollectedAmount
        .mul(100)
        .div(totalInvoicedAmount)
        .toFixed(2);
    }

    return {
      totalCustomers,
      activeCustomers,
      totalProducts,
      activeSubscriptions,
      pendingSubscriptions,
      cancelledSubscriptions,
      totalQuotations,
      acceptedQuotations,
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      overdueInvoices,
      totalInvoicedAmount: toDecimalString(totalInvoicedAmount),
      totalCollectedAmount: toDecimalString(totalCollectedAmount),
      totalOutstandingAmount: toDecimalString(totalOutstandingAmount),
      totalRefundedAmount: toDecimalString(totalRefundedAmount),
      collectionRate,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * 2. Revenue Analytics
   * GET /api/v1/analytics/revenue
   */
  async getRevenue(queryParams = {}) {
    const { interval = 'monthly', startDate, endDate } = queryParams;

    const now = new Date();
    const end = endDate ? new Date(endDate) : now;
    let start;
    if (startDate) {
      start = new Date(startDate);
    } else {
      start = new Date(end);
      start.setMonth(start.getMonth() - 12);
    }

    // Previous period boundaries for comparison
    const durationMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - durationMs);
    const prevEnd = new Date(start.getTime());

    // Fetch payments and refunds in current and previous windows
    const [payments, invoices, refunds, prevPayments, prevRefunds] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
          createdAt: { gte: start, lte: end }
        },
        select: { id: true, amount: true, createdAt: true }
      }),
      this.prisma.invoice.findMany({
        where: {
          status: { notIn: ['DRAFT', 'VOID'] },
          createdAt: { gte: start, lte: end }
        },
        select: { id: true, totalAmount: true, amountPaid: true, createdAt: true }
      }),
      this.prisma.refund.findMany({
        where: {
          status: 'SUCCEEDED',
          createdAt: { gte: start, lte: end }
        },
        select: { id: true, amount: true, createdAt: true }
      }),
      this.prisma.payment.findMany({
        where: {
          status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
          createdAt: { gte: prevStart, lte: prevEnd }
        },
        select: { amount: true }
      }),
      this.prisma.refund.findMany({
        where: {
          status: 'SUCCEEDED',
          createdAt: { gte: prevStart, lte: prevEnd }
        },
        select: { amount: true }
      })
    ]);

    // Grouping into periods
    const periodsMap = new Map();
    const hasRefundRecords = refunds.length > 0;

    for (const p of payments) {
      const key = getPeriodKey(p.createdAt, interval);
      if (!periodsMap.has(key)) {
        periodsMap.set(key, {
          period: key,
          collected: new Prisma.Decimal(0),
          invoiced: new Prisma.Decimal(0),
          refunded: new Prisma.Decimal(0),
          paymentCount: 0,
          refundCount: 0
        });
      }
      const entry = periodsMap.get(key);
      entry.collected = entry.collected.plus(new Prisma.Decimal(p.amount || 0));
      // Only fall back to payment.refundedAmount if no actual Refund records exist in query window
      if (!hasRefundRecords && p.refundedAmount) {
        entry.refunded = entry.refunded.plus(new Prisma.Decimal(p.refundedAmount || 0));
      }
      entry.paymentCount++;
    }

    for (const r of refunds) {
      const key = getPeriodKey(r.createdAt, interval);
      if (!periodsMap.has(key)) {
        periodsMap.set(key, {
          period: key,
          collected: new Prisma.Decimal(0),
          invoiced: new Prisma.Decimal(0),
          refunded: new Prisma.Decimal(0),
          paymentCount: 0,
          refundCount: 0
        });
      }
      const entry = periodsMap.get(key);
      entry.refunded = entry.refunded.plus(new Prisma.Decimal(r.amount || 0));
      entry.refundCount++;
    }

    for (const inv of invoices) {
      const key = getPeriodKey(inv.createdAt, interval);
      if (!periodsMap.has(key)) {
        periodsMap.set(key, {
          period: key,
          collected: new Prisma.Decimal(0),
          invoiced: new Prisma.Decimal(0),
          refunded: new Prisma.Decimal(0),
          paymentCount: 0,
          refundCount: 0
        });
      }
      const entry = periodsMap.get(key);
      entry.invoiced = entry.invoiced.plus(new Prisma.Decimal(inv.totalAmount || 0));
    }

    // Sort periods ascending
    const sortedKeys = Array.from(periodsMap.keys()).sort();
    let totalCollected = new Prisma.Decimal(0);
    let totalInvoiced = new Prisma.Decimal(0);
    let totalRefunded = new Prisma.Decimal(0);

    const periods = sortedKeys.map(key => {
      const entry = periodsMap.get(key);
      const net = entry.collected.minus(entry.refunded);
      totalCollected = totalCollected.plus(entry.collected);
      totalInvoiced = totalInvoiced.plus(entry.invoiced);
      totalRefunded = totalRefunded.plus(entry.refunded);

      return {
        period: entry.period,
        collectedRevenue: toDecimalString(entry.collected),
        invoicedRevenue: toDecimalString(entry.invoiced),
        refundAmount: toDecimalString(entry.refunded),
        netRevenue: toDecimalString(net),
        paymentCount: entry.paymentCount,
        refundCount: entry.refundCount
      };
    });

    // Previous period aggregate
    let prevCollected = new Prisma.Decimal(0);
    let prevRefunded = new Prisma.Decimal(0);
    const hasPrevRefundRecords = prevRefunds.length > 0;

    for (const p of prevPayments) {
      prevCollected = prevCollected.plus(new Prisma.Decimal(p.amount || 0));
      if (!hasPrevRefundRecords && p.refundedAmount) {
        prevRefunded = prevRefunded.plus(new Prisma.Decimal(p.refundedAmount || 0));
      }
    }
    for (const r of prevRefunds) {
      prevRefunded = prevRefunded.plus(new Prisma.Decimal(r.amount || 0));
    }
    const prevNet = prevCollected.minus(prevRefunded);
    const currentNet = totalCollected.minus(totalRefunded);

    let growthPercentage = '0.00';
    if (prevNet.greaterThan(0)) {
      growthPercentage = currentNet
        .minus(prevNet)
        .mul(100)
        .div(prevNet)
        .toFixed(2);
    } else if (prevNet.isZero() && currentNet.greaterThan(0)) {
      growthPercentage = '100.00';
    }

    return {
      interval,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      periods,
      totalCollected: toDecimalString(totalCollected),
      totalInvoiced: toDecimalString(totalInvoiced),
      totalRefunded: toDecimalString(totalRefunded),
      netRevenue: toDecimalString(currentNet),
      previousPeriod: {
        collectedRevenue: toDecimalString(prevCollected),
        refundAmount: toDecimalString(prevRefunded),
        netRevenue: toDecimalString(prevNet)
      },
      growthPercentage
    };
  }

  /**
   * 3. MRR & ARR
   * GET /api/v1/analytics/mrr
   * GET /api/v1/analytics/arr
   */
  async getMrr() {
    const activeSubs = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        recurringPrice: true,
        billingCycle: true,
        createdAt: true
      }
    });

    let currentMrr = new Prisma.Decimal(0);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let newMrr = new Prisma.Decimal(0);

    for (const sub of activeSubs) {
      const normalized = normalizeToMrr(sub.recurringPrice, sub.billingCycle);
      currentMrr = currentMrr.plus(normalized);

      if (new Date(sub.createdAt) >= thirtyDaysAgo) {
        newMrr = newMrr.plus(normalized);
      }
    }

    // Churned MRR: subscriptions cancelled in the last 30 days
    const cancelledSubs = await this.prisma.subscription.findMany({
      where: {
        status: 'CANCELED',
        canceledAt: { gte: thirtyDaysAgo }
      },
      select: { recurringPrice: true, billingCycle: true }
    });

    let churnedMrr = new Prisma.Decimal(0);
    for (const sub of cancelledSubs) {
      churnedMrr = churnedMrr.plus(normalizeToMrr(sub.recurringPrice, sub.billingCycle));
    }

    const expansionMrr = new Prisma.Decimal(0);
    const contractionMrr = new Prisma.Decimal(0);
    const netMrrGrowth = newMrr.plus(expansionMrr).minus(contractionMrr).minus(churnedMrr);
    const currentArr = currentMrr.mul(12);

    // Historical trends over the last 6 months
    const historicalTrends = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const periodKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      
      // Calculate active subscriptions for that historical month boundary
      const endOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59));
      let periodMrr = new Prisma.Decimal(0);
      let count = 0;

      for (const sub of activeSubs) {
        if (new Date(sub.createdAt) <= endOfMonth) {
          periodMrr = periodMrr.plus(normalizeToMrr(sub.recurringPrice, sub.billingCycle));
          count++;
        }
      }

      historicalTrends.push({
        period: periodKey,
        mrr: toDecimalString(periodMrr),
        activeSubscriptions: count
      });
    }

    return {
      currentMrr: toDecimalString(currentMrr),
      currentArr: toDecimalString(currentArr),
      newMrr: toDecimalString(newMrr),
      expansionMrr: toDecimalString(expansionMrr),
      contractionMrr: toDecimalString(contractionMrr),
      churnedMrr: toDecimalString(churnedMrr),
      netMrrGrowth: toDecimalString(netMrrGrowth),
      historicalTrends,
      limitations: 'Historical monthly MRR trend is based on currently active subscriptions created on or before each period end. Retrospective point-in-time MRR (factoring past subscription cancellations, past upgrades, or mid-cycle plan changes) is unsupported without an immutable event ledger. Expansion and contraction MRR require historical plan change snapshots. One-time setup fees and proration adjustments are excluded from MRR calculations.'
    };
  }

  async getArr() {
    const mrrData = await this.getMrr();
    const historicalTrends = mrrData.historicalTrends.map(t => ({
      period: t.period,
      arr: toDecimalString(new Prisma.Decimal(t.mrr).mul(12)),
      activeSubscriptions: t.activeSubscriptions
    }));

    return {
      currentArr: mrrData.currentArr,
      currentMrr: mrrData.currentMrr,
      arrGrowth: toDecimalString(new Prisma.Decimal(mrrData.netMrrGrowth).mul(12)),
      historicalTrends,
      limitations: mrrData.limitations
    };
  }

  /**
   * 4. Customer Analytics
   * GET /api/v1/analytics/customers
   */
  async getCustomers(queryParams = {}) {
    const { interval = 'monthly' } = queryParams;

    const [totalCustomers, activeCustomers, allCustomers, topPayingPayments] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.count({ where: { isActive: true } }),
      this.prisma.customer.findMany({
        select: {
          id: true,
          customerCode: true,
          firstName: true,
          lastName: true,
          companyName: true,
          email: true,
          isActive: true,
          status: true,
          createdAt: true
        }
      }),
      this.prisma.payment.findMany({
        where: { status: 'SUCCEEDED', customerId: { not: null } },
        select: { customerId: true, amount: true }
      })
    ]);

    const inactiveCustomers = Math.max(0, totalCustomers - activeCustomers);

    // Group new customers over time
    const periodsMap = new Map();
    for (const c of allCustomers) {
      const key = getPeriodKey(c.createdAt, interval);
      periodsMap.set(key, (periodsMap.get(key) || 0) + 1);
    }

    const newCustomersOverTime = Array.from(periodsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, count]) => ({ period, count }));

    // Customer growth rate comparing last two periods
    let customerGrowthRate = '0.00';
    if (newCustomersOverTime.length >= 2) {
      const current = newCustomersOverTime[newCustomersOverTime.length - 1].count;
      const prev = newCustomersOverTime[newCustomersOverTime.length - 2].count;
      if (prev > 0) {
        customerGrowthRate = (((current - prev) / prev) * 100).toFixed(2);
      }
    }

    // Top customers by revenue
    const revenueByCustomer = new Map();
    for (const p of topPayingPayments) {
      if (!p.customerId) continue;
      const prev = revenueByCustomer.get(p.customerId) || new Prisma.Decimal(0);
      revenueByCustomer.set(p.customerId, prev.plus(new Prisma.Decimal(p.amount || 0)));
    }

    const customerSubs = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      select: { customerId: true }
    });
    const subCountByCust = new Map();
    for (const s of customerSubs) {
      subCountByCust.set(s.customerId, (subCountByCust.get(s.customerId) || 0) + 1);
    }

    const topCustomersByRevenue = allCustomers
      .map(c => {
        const totalRevenue = revenueByCustomer.get(c.id) || new Prisma.Decimal(0);
        const name = c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email;
        return {
          id: c.id,
          customerCode: c.customerCode,
          name,
          email: c.email,
          totalRevenue: toDecimalString(totalRevenue),
          activeSubscriptions: subCountByCust.get(c.id) || 0
        };
      })
      .sort((a, b) => Number(b.totalRevenue) - Number(a.totalRevenue))
      .slice(0, 10);

    const churnedCount = allCustomers.filter(c => c.status === 'ARCHIVED' || c.status === 'SUSPENDED').length;
    const activePercentage = totalCustomers > 0
      ? ((activeCustomers / totalCustomers) * 100).toFixed(2)
      : '0.00';
    const retentionRate = totalCustomers > 0
      ? (((totalCustomers - churnedCount) / totalCustomers) * 100).toFixed(2)
      : '100.00';

    return {
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      newCustomersOverTime,
      customerGrowthRate,
      topCustomersByRevenue,
      retentionIndicators: {
        activePercentage,
        churnedCount,
        retentionRate
      }
    };
  }

  /**
   * 5. Subscription Analytics
   * GET /api/v1/analytics/subscriptions
   */
  async getSubscriptions(queryParams = {}) {
    const { interval = 'monthly' } = queryParams;

    const [allSubs, plans] = await Promise.all([
      this.prisma.subscription.findMany({
        select: {
          id: true,
          subscriptionNumber: true,
          status: true,
          planId: true,
          customerId: true,
          nextBillingDate: true,
          recurringPrice: true,
          cancellationReason: true,
          createdAt: true
        }
      }),
      this.prisma.plan.findMany({
        select: { id: true, name: true }
      })
    ]);

    const planMap = new Map(plans.map(p => [p.id, p.name]));

    const statusBreakdown = {
      active: 0,
      pending: 0,
      paused: 0,
      cancelled: 0,
      expired: 0,
      total: allSubs.length
    };

    const cancellationReasonsMap = new Map();
    const periodsMap = new Map();
    const planCountMap = new Map();

    const now = new Date();
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

    const upcomingRenewals = [];

    for (const sub of allSubs) {
      const s = String(sub.status).toUpperCase();
      if (s === 'ACTIVE') statusBreakdown.active++;
      else if (s === 'TRIALING' || s === 'PENDING') statusBreakdown.pending++;
      else if (s === 'PAUSED') statusBreakdown.paused++;
      else if (s === 'CANCELED') {
        statusBreakdown.cancelled++;
        if (sub.cancellationReason) {
          const r = sub.cancellationReason;
          cancellationReasonsMap.set(r, (cancellationReasonsMap.get(r) || 0) + 1);
        }
      } else if (s === 'EXPIRED') statusBreakdown.expired++;

      // New over time
      const key = getPeriodKey(sub.createdAt, interval);
      periodsMap.set(key, (periodsMap.get(key) || 0) + 1);

      // Plan distribution
      if (sub.planId && s === 'ACTIVE') {
        planCountMap.set(sub.planId, (planCountMap.get(sub.planId) || 0) + 1);
      }

      // Upcoming renewals
      if (s === 'ACTIVE' && sub.nextBillingDate) {
        const nextDate = new Date(sub.nextBillingDate);
        if (nextDate >= now && nextDate <= thirtyDaysAhead) {
          upcomingRenewals.push({
            id: sub.id,
            subscriptionNumber: sub.subscriptionNumber,
            planName: planMap.get(sub.planId) || 'Unknown Plan',
            nextBillingDate: nextDate.toISOString(),
            amount: toDecimalString(sub.recurringPrice)
          });
        }
      }
    }

    const newSubscriptionsOverTime = Array.from(periodsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, count]) => ({ period, count }));

    const distributionByPlan = Array.from(planCountMap.entries()).map(([planId, count]) => {
      const planName = planMap.get(planId) || 'Unknown Plan';
      const percentage = statusBreakdown.active > 0
        ? ((count / statusBreakdown.active) * 100).toFixed(2)
        : '0.00';
      return { planId, planName, count, percentage };
    });

    const cancellationReasons = Array.from(cancellationReasonsMap.entries()).map(([reason, count]) => ({
      reason,
      count
    }));

    return {
      statusBreakdown,
      newSubscriptionsOverTime,
      upcomingRenewals,
      cancellationTrends: {
        totalCancelled: statusBreakdown.cancelled,
        cancellationReasons
      },
      distributionByPlan
    };
  }

  /**
   * 6. Invoice Analytics
   * GET /api/v1/analytics/invoices
   */
  async getInvoices() {
    const invoices = await this.prisma.invoice.findMany({
      select: {
        id: true,
        status: true,
        totalAmount: true,
        amountDue: true,
        dueDate: true
      }
    });

    const statusBreakdown = {
      draft: 0,
      issued: 0,
      partiallyPaid: 0,
      paid: 0,
      overdue: 0,
      void: 0,
      total: invoices.length
    };

    let totalInvoiced = new Prisma.Decimal(0);
    let totalOutstanding = new Prisma.Decimal(0);

    const agingBuckets = {
      current: new Prisma.Decimal(0),
      days1To30: new Prisma.Decimal(0),
      days31To60: new Prisma.Decimal(0),
      days61To90: new Prisma.Decimal(0),
      days90Plus: new Prisma.Decimal(0)
    };

    const now = new Date();

    for (const inv of invoices) {
      const s = String(inv.status).toUpperCase();
      if (s === 'DRAFT') statusBreakdown.draft++;
      else if (s === 'ISSUED' || s === 'OPEN') statusBreakdown.issued++;
      else if (s === 'PARTIALLY_PAID') statusBreakdown.partiallyPaid++;
      else if (s === 'PAID') statusBreakdown.paid++;
      else if (s === 'OVERDUE') statusBreakdown.overdue++;
      else if (s === 'VOID') statusBreakdown.void++;

      if (s !== 'DRAFT' && s !== 'VOID') {
        totalInvoiced = totalInvoiced.plus(new Prisma.Decimal(inv.totalAmount || 0));
        const due = new Prisma.Decimal(inv.amountDue || 0);
        if (due.greaterThan(0)) {
          totalOutstanding = totalOutstanding.plus(due);

          // Calculate aging bucket
          if (inv.dueDate) {
            const dueDate = new Date(inv.dueDate);
            const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 0) {
              agingBuckets.current = agingBuckets.current.plus(due);
            } else if (diffDays <= 30) {
              agingBuckets.days1To30 = agingBuckets.days1To30.plus(due);
            } else if (diffDays <= 60) {
              agingBuckets.days31To60 = agingBuckets.days31To60.plus(due);
            } else if (diffDays <= 90) {
              agingBuckets.days61To90 = agingBuckets.days61To90.plus(due);
            } else {
              agingBuckets.days90Plus = agingBuckets.days90Plus.plus(due);
            }
          } else {
            agingBuckets.current = agingBuckets.current.plus(due);
          }
        }
      }
    }

    const nonDraftCount = invoices.filter(i => i.status !== 'DRAFT' && i.status !== 'VOID').length;
    const averageInvoiceValue = nonDraftCount > 0
      ? totalInvoiced.div(nonDraftCount).toFixed(2)
      : '0.00';

    const collectionEfficiency = nonDraftCount > 0
      ? ((statusBreakdown.paid / nonDraftCount) * 100).toFixed(2)
      : '0.00';

    return {
      statusBreakdown,
      totalOutstanding: toDecimalString(totalOutstanding),
      totalInvoiced: toDecimalString(totalInvoiced),
      averageInvoiceValue,
      collectionEfficiency,
      agingBuckets: {
        current: toDecimalString(agingBuckets.current),
        days1To30: toDecimalString(agingBuckets.days1To30),
        days31To60: toDecimalString(agingBuckets.days31To60),
        days61To90: toDecimalString(agingBuckets.days61To90),
        days90Plus: toDecimalString(agingBuckets.days90Plus)
      }
    };
  }

  /**
   * 7. Overdue Invoices & AR Aging Report
   * GET /api/v1/analytics/overdue
   */
  async getOverdueInvoices(queryParams = {}) {
    const { customerId, page = 1, limit = 50, sortBy = 'dueDate', sortOrder = 'asc' } = queryParams;
    const now = new Date();

    const where = {
      dueDate: { lt: now },
      status: { notIn: ['DRAFT', 'VOID', 'PAID'] }
    };

    if (customerId) {
      where.customerId = customerId;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            customerCode: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      take: 10000,
      orderBy: { [sortBy]: sortOrder.toLowerCase() === 'desc' ? 'desc' : 'asc' }
    });

    // Exclude zero-balance invoices (amountDue <= 0)
    const overdueInvoices = invoices.filter(inv => {
      const due = new Prisma.Decimal(inv.amountDue || 0);
      return due.greaterThan(0);
    });

    let totalOverdueAmount = new Prisma.Decimal(0);
    const agingBuckets = {
      days1To30: new Prisma.Decimal(0),
      days31To60: new Prisma.Decimal(0),
      days61To90: new Prisma.Decimal(0),
      days90Plus: new Prisma.Decimal(0)
    };
    const bucketCounts = {
      days1To30: 0,
      days31To60: 0,
      days61To90: 0,
      days90Plus: 0
    };

    const formattedInvoices = [];

    for (const inv of overdueInvoices) {
      const due = new Prisma.Decimal(inv.amountDue || 0);
      totalOverdueAmount = totalOverdueAmount.plus(due);

      const dueDate = new Date(inv.dueDate);
      const diffMs = now.getTime() - dueDate.getTime();
      const overdueDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      let bucket = 'days1To30';
      if (overdueDays > 90) {
        bucket = 'days90Plus';
      } else if (overdueDays > 60) {
        bucket = 'days61To90';
      } else if (overdueDays > 30) {
        bucket = 'days31To60';
      }

      agingBuckets[bucket] = agingBuckets[bucket].plus(due);
      bucketCounts[bucket]++;

      formattedInvoices.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        customer: inv.customer ? {
          id: inv.customer.id,
          customerCode: inv.customer.customerCode,
          name: inv.customer.companyName || `${inv.customer.firstName || ''} ${inv.customer.lastName || ''}`.trim() || 'Unnamed Customer',
          email: inv.customer.email
        } : null,
        status: inv.status,
        dueDate: inv.dueDate,
        overdueDays,
        agingBucket: bucket,
        currency: inv.currency || 'INR',
        totalAmount: toDecimalString(inv.totalAmount),
        amountPaid: toDecimalString(inv.amountPaid),
        amountDue: toDecimalString(due)
      });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 50);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedItems = formattedInvoices.slice(startIndex, startIndex + limitNum);

    return {
      totalOverdueInvoices: overdueInvoices.length,
      totalOverdueAmount: toDecimalString(totalOverdueAmount),
      agingBuckets: {
        days1To30: toDecimalString(agingBuckets.days1To30),
        days31To60: toDecimalString(agingBuckets.days31To60),
        days61To90: toDecimalString(agingBuckets.days61To90),
        days90Plus: toDecimalString(agingBuckets.days90Plus)
      },
      bucketCounts,
      invoices: paginatedItems,
      pagination: {
        totalItems: overdueInvoices.length,
        totalPages: Math.ceil(overdueInvoices.length / limitNum) || 1,
        currentPage: pageNum,
        limit: limitNum
      },
      generatedAt: now.toISOString()
    };
  }

  /**
   * 7. Payment Analytics
   * GET /api/v1/analytics/payments
   */
  async getPayments(queryParams = {}) {
    const { interval = 'monthly' } = queryParams;

    const payments = await this.prisma.payment.findMany({
      include: {
        refunds: true
      }
    });

    let successfulPayments = 0;
    let failedPayments = 0;
    let totalCollected = new Prisma.Decimal(0);
    let totalRefunded = new Prisma.Decimal(0);
    let unmatchedPaymentsCount = 0;

    const periodsMap = new Map();

    for (const p of payments) {
      const s = String(p.status).toUpperCase();
      if (s === 'SUCCEEDED' || s === 'PARTIALLY_REFUNDED' || s === 'REFUNDED') {
        successfulPayments++;
        const amt = new Prisma.Decimal(p.amount || 0);
        let ref = new Prisma.Decimal(0);
        if (p.refunds && Array.isArray(p.refunds) && p.refunds.length > 0) {
          for (const r of p.refunds) {
            if (r.status === 'SUCCEEDED') {
              ref = ref.plus(new Prisma.Decimal(r.amount || 0));
            }
          }
        }
        totalCollected = totalCollected.plus(amt);
        totalRefunded = totalRefunded.plus(ref);

        const key = getPeriodKey(p.createdAt, interval);
        const prev = periodsMap.get(key) || { collected: new Prisma.Decimal(0), count: 0 };
        prev.collected = prev.collected.plus(amt.minus(ref));
        prev.count++;
        periodsMap.set(key, prev);
      } else if (s === 'FAILED') {
        failedPayments++;
      }

      if (!p.invoiceId || !p.customerId) {
        unmatchedPaymentsCount++;
      }
    }

    const total = payments.length;
    const successRate = total > 0 ? ((successfulPayments / total) * 100).toFixed(2) : '0.00';
    const failureRate = total > 0 ? ((failedPayments / total) * 100).toFixed(2) : '0.00';
    const netCollected = totalCollected.minus(totalRefunded);

    const collectionTrends = Array.from(periodsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, val]) => ({
        period,
        collected: toDecimalString(val.collected),
        count: val.count
      }));

    return {
      totalPayments: total,
      successfulPayments,
      failedPayments,
      successRate,
      failureRate,
      totalCollected: toDecimalString(totalCollected),
      totalRefunded: toDecimalString(totalRefunded),
      netCollected: toDecimalString(netCollected),
      collectionTrends,
      unmatchedPaymentsCount
    };
  }

  /**
   * 8. Executive Dashboard
   * GET /api/v1/analytics/dashboard
   */
  async getDashboard() {
    const [summary, mrr] = await Promise.all([
      this.getSummary(),
      this.getMrr()
    ]);

    return {
      mrr: mrr.currentMrr,
      arr: mrr.currentArr,
      activeSubscriptions: summary.activeSubscriptions,
      totalCustomers: summary.totalCustomers,
      totalInvoiced: summary.totalInvoicedAmount,
      totalCollected: summary.totalCollectedAmount,
      totalOutstanding: summary.totalOutstandingAmount,
      collectionRate: summary.collectionRate,
      generatedAt: summary.generatedAt
    };
  }
}

export const analyticsService = new AnalyticsService();

