import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createMockPrisma, seedTestUser } from './testHelper.js';
import { setPrismaClient } from '../src/utils/prisma.js';
import { normalizeToMrr, toDecimalString } from '../src/modules/analytics/analytics.service.js';
import { Prisma } from '@prisma/client';

describe('Analytics & Dashboard Module Suite', () => {
  let mockPrisma;
  let adminToken, staffToken, customerToken;
  let customerId, productId, planMonthlyId, planYearlyId;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    setPrismaClient(mockPrisma);

    // 1. Seed Roles: Admin, Staff, Customer
    const adminUser = await seedTestUser(mockPrisma, {
      name: 'Admin Executive',
      email: 'admin.analytics@subpilot.com',
      role: 'ADMIN'
    });
    adminToken = adminUser.token;

    const staffUser = await seedTestUser(mockPrisma, {
      name: 'Staff Analyst',
      email: 'staff.analyst@subpilot.com',
      role: 'STAFF'
    });
    staffToken = staffUser.token;

    const custUser = await seedTestUser(mockPrisma, {
      name: 'Acme Corp',
      email: 'customer@acme.com',
      role: 'CUSTOMER'
    });
    customerToken = custUser.token;
    customerId = custUser.customerId;

    // 2. Seed Product & Plans
    const product = await mockPrisma.product.create({
      data: {
        name: 'Cloud Infrastructure',
        code: 'PROD_CLOUD',
        type: 'SERVICE',
        status: 'ACTIVE',
        isActive: true
      }
    });
    productId = product.id;

    const planMonthly = await mockPrisma.plan.create({
      data: {
        name: 'Cloud Pro Monthly',
        code: 'PLAN_PRO_M',
        productId,
        billingCycle: 'MONTHLY',
        price: '100.00',
        currency: 'USD',
        status: 'ACTIVE',
        isActive: true
      }
    });
    planMonthlyId = planMonthly.id;

    const planYearly = await mockPrisma.plan.create({
      data: {
        name: 'Cloud Enterprise Annual',
        code: 'PLAN_ENT_Y',
        productId,
        billingCycle: 'YEARLY',
        price: '1200.00',
        currency: 'USD',
        status: 'ACTIVE',
        isActive: true
      }
    });
    planYearlyId = planYearly.id;
  });

  // =========================================================================
  // 1. UNIT NORMALIZATION & CALCULATION TESTS
  // =========================================================================
  describe('1. MRR Normalization Logic', () => {
    it('accurately normalizes prices across monthly, annual, quarterly, and weekly cycles', () => {
      // Monthly 100 -> 100
      expect(normalizeToMrr('100.00', 'MONTHLY').toFixed(2)).toBe('100.00');

      // Yearly 1200 -> 100
      expect(normalizeToMrr('1200.00', 'YEARLY').toFixed(2)).toBe('100.00');
      expect(normalizeToMrr('1200.00', 'ANNUAL').toFixed(2)).toBe('100.00');

      // Quarterly 300 -> 100
      expect(normalizeToMrr('300.00', 'QUARTERLY').toFixed(2)).toBe('100.00');

      // Semi-annual 600 -> 100
      expect(normalizeToMrr('600.00', 'SEMI_ANNUAL').toFixed(2)).toBe('100.00');
      expect(normalizeToMrr('600.00', 'HALF_YEARLY').toFixed(2)).toBe('100.00');

      // Weekly 25 -> 25 * 52 / 12 = 108.33
      expect(normalizeToMrr('25.00', 'WEEKLY').toFixed(2)).toBe('108.33');
    });

    it('toDecimalString formats decimals with 2 decimal places safely', () => {
      expect(toDecimalString(null)).toBe('0.00');
      expect(toDecimalString(undefined)).toBe('0.00');
      expect(toDecimalString('123.456')).toBe('123.46');
      expect(toDecimalString(50)).toBe('50.00');
      expect(toDecimalString(new Prisma.Decimal('99.90'))).toBe('99.90');
    });
  });

  // =========================================================================
  // 2. DASHBOARD SUMMARY ENDPOINT
  // =========================================================================
  describe('2. GET /api/v1/analytics/summary', () => {
    it('returns empty/zero metrics safely when no business records exist', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.totalCustomers).toBe(1); // from seed
      expect(data.activeSubscriptions).toBe(0);
      expect(data.totalInvoices).toBe(0);
      expect(data.totalInvoicedAmount).toBe('0.00');
      expect(data.totalCollectedAmount).toBe('0.00');
      expect(data.totalOutstandingAmount).toBe('0.00');
      expect(data.collectionRate).toBe('0.00');
      expect(data.generatedAt).toBeDefined();
    });

    it('calculates full summary metrics including collection rate and invoice aggregates', async () => {
      // Seed Subscriptions: 1 active, 1 trialing (pending), 1 canceled
      await mockPrisma.subscription.create({
        data: {
          customerId,
          planId: planMonthlyId,
          status: 'ACTIVE',
          recurringPrice: '100.00',
          billingCycle: 'MONTHLY'
        }
      });
      await mockPrisma.subscription.create({
        data: {
          customerId,
          planId: planMonthlyId,
          status: 'TRIALING',
          recurringPrice: '100.00',
          billingCycle: 'MONTHLY'
        }
      });
      await mockPrisma.subscription.create({
        data: {
          customerId,
          planId: planMonthlyId,
          status: 'CANCELED',
          recurringPrice: '100.00',
          billingCycle: 'MONTHLY'
        }
      });

      // Seed Quotations: 1 Accepted, 1 Draft
      await mockPrisma.quotation.create({
        data: {
          customerId,
          quotationNumber: 'QT-001',
          status: 'ACCEPTED',
          grandTotal: '1200.00'
        }
      });
      await mockPrisma.quotation.create({
        data: {
          customerId,
          quotationNumber: 'QT-002',
          status: 'DRAFT',
          grandTotal: '500.00'
        }
      });

      // Seed Invoices:
      // Invoice 1: Paid ($1000 invoiced, $1000 paid, $0 due)
      const inv1 = await mockPrisma.invoice.create({
        data: {
          customerId,
          status: 'PAID',
          totalAmount: '1000.00',
          amountPaid: '1000.00',
          amountDue: '0.00'
        }
      });
      // Invoice 2: Partially paid ($500 invoiced, $200 paid, $300 due)
      await mockPrisma.invoice.create({
        data: {
          customerId,
          status: 'PARTIALLY_PAID',
          totalAmount: '500.00',
          amountPaid: '200.00',
          amountDue: '300.00'
        }
      });
      // Invoice 3: Overdue ($200 invoiced, $0 paid, $200 due)
      await mockPrisma.invoice.create({
        data: {
          customerId,
          status: 'OVERDUE',
          totalAmount: '200.00',
          amountPaid: '0.00',
          amountDue: '200.00'
        }
      });

      // Seed Succeeded Payments totaling $1200
      await mockPrisma.payment.create({
        data: {
          invoiceId: inv1.id,
          customerId,
          amount: '1000.00',
          refundedAmount: '0.00',
          status: 'SUCCEEDED'
        }
      });
      await mockPrisma.payment.create({
        data: {
          customerId,
          amount: '200.00',
          refundedAmount: '50.00',
          status: 'SUCCEEDED'
        }
      });

      const res = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const d = res.body.data;
      expect(d.activeSubscriptions).toBe(1);
      expect(d.pendingSubscriptions).toBe(1);
      expect(d.cancelledSubscriptions).toBe(1);
      expect(d.totalQuotations).toBe(2);
      expect(d.acceptedQuotations).toBe(1);
      expect(d.totalInvoices).toBe(3);
      expect(d.paidInvoices).toBe(1);
      expect(d.unpaidInvoices).toBe(2);
      expect(d.overdueInvoices).toBe(1);
      expect(d.totalInvoicedAmount).toBe('1700.00'); // 1000 + 500 + 200
      expect(d.totalOutstandingAmount).toBe('500.00'); // 300 + 200
      // Collected: 1000 + (200 - 50) = 1150.00
      expect(d.totalCollectedAmount).toBe('1150.00');
      expect(d.totalRefundedAmount).toBe('50.00');
      // Collection rate: (1150 / 1700) * 100 = 67.65%
      expect(d.collectionRate).toBe('67.65');
    });
  });

  // =========================================================================
  // 3. REVENUE ANALYTICS ENDPOINT
  // =========================================================================
  describe('3. GET /api/v1/analytics/revenue', () => {
    it('returns grouped revenue, distinguishes collected vs invoiced, and computes growth rate', async () => {
      // Seed payment and invoice
      await mockPrisma.payment.create({
        data: {
          customerId,
          amount: '500.00',
          refundedAmount: '0.00',
          status: 'SUCCEEDED',
          createdAt: new Date()
        }
      });

      await mockPrisma.invoice.create({
        data: {
          customerId,
          status: 'ISSUED',
          totalAmount: '600.00',
          amountPaid: '0.00',
          amountDue: '600.00',
          createdAt: new Date()
        }
      });

      const res = await request(app)
        .get('/api/v1/analytics/revenue?interval=monthly')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.interval).toBe('monthly');
      expect(data.totalCollected).toBe('500.00');
      expect(data.totalInvoiced).toBe('600.00');
      expect(data.netRevenue).toBe('500.00');
      expect(data.periods).toBeInstanceOf(Array);
      expect(data.periods.length).toBeGreaterThanOrEqual(1);
      expect(data.previousPeriod).toBeDefined();
    });
  });

  // =========================================================================
  // 4. MRR AND ARR ENDPOINTS
  // =========================================================================
  describe('4. GET /api/v1/analytics/mrr & GET /api/v1/analytics/arr', () => {
    it('computes current MRR, ARR, new MRR, and historical trends accurately', async () => {
      // 1 Monthly sub @ $150
      await mockPrisma.subscription.create({
        data: {
          customerId,
          planId: planMonthlyId,
          status: 'ACTIVE',
          recurringPrice: '150.00',
          billingCycle: 'MONTHLY',
          createdAt: new Date()
        }
      });

      // 1 Annual sub @ $1200 ($100 MRR)
      await mockPrisma.subscription.create({
        data: {
          customerId,
          planId: planYearlyId,
          status: 'ACTIVE',
          recurringPrice: '1200.00',
          billingCycle: 'YEARLY',
          createdAt: new Date()
        }
      });

      // 1 Canceled sub @ $50
      await mockPrisma.subscription.create({
        data: {
          customerId,
          planId: planMonthlyId,
          status: 'CANCELED',
          recurringPrice: '50.00',
          billingCycle: 'MONTHLY',
          canceledAt: new Date(),
          createdAt: new Date()
        }
      });

      // Test MRR
      const mrrRes = await request(app)
        .get('/api/v1/analytics/mrr')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(mrrRes.status).toBe(200);
      const mrrData = mrrRes.body.data;
      // Current MRR = 150 + (1200 / 12) = 250.00
      expect(mrrData.currentMrr).toBe('250.00');
      // Current ARR = 250 * 12 = 3000.00
      expect(mrrData.currentArr).toBe('3000.00');
      expect(mrrData.newMrr).toBe('250.00');
      expect(mrrData.churnedMrr).toBe('50.00');
      // Net MRR Growth = 250 - 50 = 200.00
      expect(mrrData.netMrrGrowth).toBe('200.00');
      expect(mrrData.historicalTrends).toBeInstanceOf(Array);
      expect(mrrData.historicalTrends.length).toBe(6);

      // Test ARR
      const arrRes = await request(app)
        .get('/api/v1/analytics/arr')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(arrRes.status).toBe(200);
      const arrData = arrRes.body.data;
      expect(arrData.currentArr).toBe('3000.00');
      expect(arrData.currentMrr).toBe('250.00');
      expect(arrData.arrGrowth).toBe('2400.00'); // 200 * 12
    });
  });

  // =========================================================================
  // 5. CUSTOMER ANALYTICS ENDPOINT
  // =========================================================================
  describe('5. GET /api/v1/analytics/customers', () => {
    it('returns customer totals, top customers by revenue, and retention rates', async () => {
      // Seed payment for customer
      await mockPrisma.payment.create({
        data: {
          customerId,
          amount: '850.00',
          status: 'SUCCEEDED'
        }
      });

      const res = await request(app)
        .get('/api/v1/analytics/customers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.totalCustomers).toBe(1);
      expect(data.activeCustomers).toBe(1);
      expect(data.inactiveCustomers).toBe(0);
      expect(data.topCustomersByRevenue).toBeInstanceOf(Array);
      expect(data.topCustomersByRevenue[0].totalRevenue).toBe('850.00');
      expect(data.retentionIndicators.retentionRate).toBe('100.00');
    });
  });

  // =========================================================================
  // 6. SUBSCRIPTION ANALYTICS ENDPOINT
  // =========================================================================
  describe('6. GET /api/v1/analytics/subscriptions', () => {
    it('returns status breakdown, plan distribution, and upcoming renewals', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-RENEW-1',
          customerId,
          planId: planMonthlyId,
          status: 'ACTIVE',
          recurringPrice: '100.00',
          nextBillingDate: tomorrow
        }
      });

      const res = await request(app)
        .get('/api/v1/analytics/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.statusBreakdown.active).toBe(1);
      expect(data.upcomingRenewals).toHaveLength(1);
      expect(data.upcomingRenewals[0].subscriptionNumber).toBe('SUB-RENEW-1');
      expect(data.distributionByPlan).toHaveLength(1);
      expect(data.distributionByPlan[0].percentage).toBe('100.00');
    });
  });

  // =========================================================================
  // 7. INVOICE AND PAYMENT ANALYTICS ENDPOINTS
  // =========================================================================
  describe('7. GET /api/v1/analytics/invoices & GET /api/v1/analytics/payments', () => {
    it('invoices analytics calculates aging buckets and average invoice value', async () => {
      const pastDue = new Date();
      pastDue.setDate(pastDue.getDate() - 15); // 15 days overdue -> days1To30 bucket

      await mockPrisma.invoice.create({
        data: {
          customerId,
          status: 'OVERDUE',
          totalAmount: '400.00',
          amountDue: '400.00',
          dueDate: pastDue
        }
      });

      const res = await request(app)
        .get('/api/v1/analytics/invoices')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.statusBreakdown.overdue).toBe(1);
      expect(data.totalOutstanding).toBe('400.00');
      expect(data.agingBuckets.days1To30).toBe('400.00');
      expect(data.averageInvoiceValue).toBe('400.00');
    });

    it('payments analytics calculates success rates and tracks collection trends', async () => {
      await mockPrisma.payment.create({
        data: {
          customerId,
          amount: '300.00',
          refundedAmount: '0.00',
          status: 'SUCCEEDED'
        }
      });
      await mockPrisma.payment.create({
        data: {
          customerId,
          amount: '100.00',
          status: 'FAILED'
        }
      });

      const res = await request(app)
        .get('/api/v1/analytics/payments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.totalPayments).toBe(2);
      expect(data.successfulPayments).toBe(1);
      expect(data.failedPayments).toBe(1);
      expect(data.successRate).toBe('50.00');
      expect(data.failureRate).toBe('50.00');
      expect(data.totalCollected).toBe('300.00');
    });
  });

  // =========================================================================
  // 8. EXECUTIVE DASHBOARD ENDPOINT
  // =========================================================================
  describe('8. GET /api/v1/analytics/dashboard', () => {
    it('returns high-level executive dashboard metrics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.mrr).toBeDefined();
      expect(data.arr).toBeDefined();
      expect(data.activeSubscriptions).toBeDefined();
      expect(data.collectionRate).toBeDefined();
    });
  });

  // =========================================================================
  // 9. RBAC & AUTHORIZATION CHECKS
  // =========================================================================
  describe('9. RBAC & Access Control Enforcement', () => {
    it('STAFF has full operational access to summary and revenue analytics', async () => {
      const summaryRes = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(summaryRes.status).toBe(200);

      const mrrRes = await request(app)
        .get('/api/v1/analytics/mrr')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(mrrRes.status).toBe(200);
    });

    it('CUSTOMER is strictly forbidden from accessing analytics endpoints (403)', async () => {
      const endpoints = [
        '/api/v1/analytics/summary',
        '/api/v1/analytics/revenue',
        '/api/v1/analytics/mrr',
        '/api/v1/analytics/arr',
        '/api/v1/analytics/customers',
        '/api/v1/analytics/subscriptions',
        '/api/v1/analytics/invoices',
        '/api/v1/analytics/payments',
        '/api/v1/analytics/dashboard'
      ];

      for (const endpoint of endpoints) {
        const res = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
      }
    });

    it('Unauthenticated requests are rejected with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/analytics/summary');
      expect(res.status).toBe(401);
    });
  });
});

