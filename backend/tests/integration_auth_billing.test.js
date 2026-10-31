import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createMockPrisma, seedTestUser } from './testHelper.js';
import { setPrismaClient } from '../src/utils/prisma.js';

describe('Integration Readiness Suite: Auth + Customer Billing', () => {
  let mockPrisma;
  let adminToken, staffToken, customerAToken, customerBToken;
  let customerAId, customerBId;
  let planId;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    setPrismaClient(mockPrisma);

    // 1. Seed Roles
    const adminUser = await seedTestUser(mockPrisma, {
      name: 'System Admin',
      email: 'admin.ready@subpilot.com',
      role: 'ADMIN'
    });
    adminToken = adminUser.token;

    const staffUser = await seedTestUser(mockPrisma, {
      name: 'Support Staff',
      email: 'staff.ready@subpilot.com',
      role: 'STAFF'
    });
    staffToken = staffUser.token;

    const custA = await seedTestUser(mockPrisma, {
      name: 'Alpha Customer',
      email: 'alpha@billing.com',
      role: 'CUSTOMER'
    });
    customerAToken = custA.token;
    customerAId = custA.customerId;

    const custB = await seedTestUser(mockPrisma, {
      name: 'Beta Customer',
      email: 'beta@billing.com',
      role: 'CUSTOMER'
    });
    customerBToken = custB.token;
    customerBId = custB.customerId;

    // 2. Seed a Plan
    const plan = await mockPrisma.plan.create({
      data: {
        name: 'Startup Plan',
        code: 'PLAN_STARTUP',
        price: '250.00',
        billingCycle: 'MONTHLY',
        currency: 'USD',
        status: 'ACTIVE',
        isActive: true
      }
    });
    planId = plan.id;
  });

  // =========================================================================
  // 1. AUTHENTICATION CONTRACT (/api/v1/auth/me)
  // =========================================================================
  describe('1. Authentication Contract (GET /api/v1/auth/me)', () => {
    it('returns authenticated ADMIN profile with customerId as null', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.id).toBeDefined();
      expect(data.role).toBe('ADMIN');
      expect(data.customerId).toBeNull();
      expect(data.email).toBe('admin.ready@subpilot.com');
      expect(data.isActive).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.role).toBe('ADMIN');
    });

    it('returns authenticated STAFF profile with customerId as null', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.role).toBe('STAFF');
      expect(data.customerId).toBeNull();
      expect(data.email).toBe('staff.ready@subpilot.com');
    });

    it('returns authenticated CUSTOMER profile with linked customerId and customer object', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.role).toBe('CUSTOMER');
      expect(data.customerId).toBe(customerAId);
      expect(data.customer).toBeDefined();
      expect(data.customer.id).toBe(customerAId);
      expect(data.customer.customerCode).toBeDefined();
      expect(data.email).toBe('alpha@billing.com');
    });

    it('rejects unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects malformed or invalid token with 401 Unauthorized', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-12345');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // 2. CUSTOMER-SCOPED BILLING APIS & REUSABLE SUMMARY
  // =========================================================================
  describe('2. Customer Billing Summary & Billing Sub-Resources', () => {
    it('returns safe empty billing summary when customer has no billing records', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerAId}/billing-summary`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.customerId).toBe(customerAId);
      expect(data.subscriptions.activeCount).toBe(0);
      expect(data.subscriptions.currentMrr).toBe('0.00');
      expect(data.invoices.totalCount).toBe(0);
      expect(data.invoices.totalInvoicedAmount).toBe('0.00');
      expect(data.invoices.totalOutstandingBalance).toBe('0.00');
      expect(data.payments.totalCount).toBe(0);
      expect(data.payments.totalRefundedAmount).toBe('0.00');
    });

    it('customer can access billing summary via /me alias (/api/v1/customers/me/billing-summary)', async () => {
      const res = await request(app)
        .get('/api/v1/customers/me/billing-summary')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.customerId).toBe(customerAId);
    });

    it('calculates comprehensive billing summary metrics with Prisma Decimal financial accuracy', async () => {
      // 1. Seed Subscriptions for Customer A: 1 active ($250/mo), 1 canceled ($100/mo)
      await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-A-001',
          customerId: customerAId,
          planId,
          status: 'ACTIVE',
          recurringPrice: '250.00',
          billingCycle: 'MONTHLY',
          nextBillingDate: new Date(Date.now() + 86400000 * 10) // 10 days ahead
        }
      });
      await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-A-002',
          customerId: customerAId,
          planId,
          status: 'CANCELED',
          recurringPrice: '100.00',
          billingCycle: 'MONTHLY'
        }
      });

      // 2. Seed Invoices for Customer A:
      // Inv 1: PAID ($500 total, $500 paid, $0 due)
      const inv1 = await mockPrisma.invoice.create({
        data: {
          invoiceNumber: 'INV-A-001',
          customerId: customerAId,
          status: 'PAID',
          totalAmount: '500.00',
          amountPaid: '500.00',
          amountDue: '0.00'
        }
      });
      // Inv 2: PARTIALLY_PAID ($300 total, $100 paid, $200 due)
      await mockPrisma.invoice.create({
        data: {
          invoiceNumber: 'INV-A-002',
          customerId: customerAId,
          status: 'PARTIALLY_PAID',
          totalAmount: '300.00',
          amountPaid: '100.00',
          amountDue: '200.00'
        }
      });
      // Inv 3: OVERDUE ($150 total, $0 paid, $150 due)
      await mockPrisma.invoice.create({
        data: {
          invoiceNumber: 'INV-A-003',
          customerId: customerAId,
          status: 'OVERDUE',
          totalAmount: '150.00',
          amountPaid: '0.00',
          amountDue: '150.00'
        }
      });

      // 3. Seed Payments for Customer A:
      await mockPrisma.payment.create({
        data: {
          paymentReference: 'PAY-A-001',
          invoiceId: inv1.id,
          customerId: customerAId,
          amount: '500.00',
          refundedAmount: '50.00',
          status: 'SUCCEEDED'
        }
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerAId}/billing-summary`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      const d = res.body.data;
      expect(d.customerId).toBe(customerAId);

      // Subscriptions
      expect(d.subscriptions.activeCount).toBe(1);
      expect(d.subscriptions.cancelledCount).toBe(1);
      expect(d.subscriptions.totalCount).toBe(2);
      expect(d.subscriptions.currentMrr).toBe('250.00');
      expect(d.subscriptions.nextBillingDate).toBeDefined();

      // Invoices
      expect(d.invoices.totalCount).toBe(3);
      expect(d.invoices.paidCount).toBe(1);
      expect(d.invoices.openCount).toBe(1);
      expect(d.invoices.overdueCount).toBe(1);
      expect(d.invoices.totalInvoicedAmount).toBe('950.00'); // 500 + 300 + 150
      expect(d.invoices.totalPaidAmount).toBe('600.00'); // 500 + 100
      expect(d.invoices.totalOutstandingBalance).toBe('350.00'); // 200 + 150

      // Payments
      expect(d.payments.totalCount).toBe(1);
      expect(d.payments.successfulCount).toBe(1);
      expect(d.payments.totalRefundedAmount).toBe('50.00');
    });

    it('returns enriched subscriptions with status, recurring price, and plan info', async () => {
      await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-A-ENRICHED',
          customerId: customerAId,
          planId,
          status: 'ACTIVE',
          recurringPrice: '250.00',
          billingCycle: 'MONTHLY'
        }
      });

      const res = await request(app)
        .get('/api/v1/customers/me/subscriptions')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      const item = res.body.data.items[0];
      expect(item.subscriptionNumber).toBe('SUB-A-ENRICHED');
      expect(item.recurringPrice).toBe('250.00');
      expect(item.status).toBe('ACTIVE');
      expect(item.billingCycle).toBe('MONTHLY');
      expect(res.body.data.pagination).toBeDefined();
    });

    it('returns enriched invoices with status, decimal amounts, and pagination', async () => {
      await mockPrisma.invoice.create({
        data: {
          invoiceNumber: 'INV-A-ENRICHED',
          customerId: customerAId,
          status: 'ISSUED',
          totalAmount: '450.00',
          amountPaid: '0.00',
          amountDue: '450.00'
        }
      });

      const res = await request(app)
        .get('/api/v1/customers/me/invoices')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      const item = res.body.data.items[0];
      expect(item.invoiceNumber).toBe('INV-A-ENRICHED');
      expect(item.totalAmount).toBe('450.00');
      expect(item.amountDue).toBe('450.00');
      expect(item.status).toBe('ISSUED');
    });

    it('returns enriched payments with payment reference, decimal amounts, and invoice details', async () => {
      const inv = await mockPrisma.invoice.create({
        data: {
          invoiceNumber: 'INV-A-PAY',
          customerId: customerAId,
          status: 'PAID',
          totalAmount: '100.00'
        }
      });

      await mockPrisma.payment.create({
        data: {
          paymentReference: 'PAY-A-REF',
          invoiceId: inv.id,
          customerId: customerAId,
          amount: '100.00',
          refundedAmount: '0.00',
          status: 'SUCCEEDED'
        }
      });

      const res = await request(app)
        .get('/api/v1/customers/me/payments')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      const item = res.body.data.items[0];
      expect(item.paymentReference).toBe('PAY-A-REF');
      expect(item.amount).toBe('100.00');
      expect(item.status).toBe('SUCCEEDED');
    });
  });

  // =========================================================================
  // 3. ANTI-IDOR & CROSS-CUSTOMER ACCESS DENIAL (SECURITY)
  // =========================================================================
  describe('3. Anti-IDOR & Cross-Customer Isolation', () => {
    it('Customer A is strictly denied access to Customer B billing summary (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerBId}/billing-summary`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/permission to access another customer profile/i);
    });

    it('Customer A is strictly denied access to Customer B subscriptions (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerBId}/subscriptions`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(403);
    });

    it('Customer A is strictly denied access to Customer B invoices (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerBId}/invoices`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(403);
    });

    it('Customer A is strictly denied access to Customer B payments (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerBId}/payments`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(403);
    });

    it('ADMIN has full operational access to any customer billing summary and sub-resources', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerAId}/billing-summary`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.customerId).toBe(customerAId);
    });

    it('STAFF has operational access to any customer billing summary and sub-resources', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerAId}/billing-summary`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.customerId).toBe(customerAId);
    });
  });
});

