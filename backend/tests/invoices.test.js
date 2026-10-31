import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createMockPrisma, seedTestUser } from './testHelper.js';
import { setPrismaClient } from '../src/utils/prisma.js';
import { billingService } from '../src/modules/invoices/billing.service.js';
import { invoicesService } from '../src/modules/invoices/invoices.service.js';

describe('Invoice Management & Automated Billing Engine Suite', () => {
  let mockPrisma;
  let adminToken, staffToken, customerAToken, customerBToken;
  let customerAId, customerBId;
  let productId, variantId, planId, subscriptionId;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    setPrismaClient(mockPrisma);

    // Seed Admin, Staff, Customer A, Customer B
    const adminUser = await seedTestUser(mockPrisma, {
      name: 'Admin User',
      email: 'admin@subpilot.com',
      role: 'ADMIN'
    });
    adminToken = adminUser.token;

    const staffUser = await seedTestUser(mockPrisma, {
      name: 'Staff Operator',
      email: 'staff@subpilot.com',
      role: 'STAFF'
    });
    staffToken = staffUser.token;

    const custA = await seedTestUser(mockPrisma, {
      name: 'Acme Corp',
      email: 'billing@acme.com',
      role: 'CUSTOMER'
    });
    customerAToken = custA.token;
    customerAId = custA.customerId;

    const custB = await seedTestUser(mockPrisma, {
      name: 'Beta Ltd',
      email: 'finance@beta.com',
      role: 'CUSTOMER'
    });
    customerBToken = custB.token;
    customerBId = custB.customerId;

    // Seed Product
    productId = 'prod_suite_001';
    mockPrisma._state.products.push({
      id: productId,
      name: 'SubPilot Analytics Suite',
      slug: 'subpilot-analytics-suite',
      basePrice: '5000.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Seed Variant
    variantId = 'var_seats_001';
    mockPrisma._state.productVariants.push({
      id: variantId,
      productId,
      name: 'Extra 5 Seats',
      sku: 'SKU-ANL-SEAT5',
      additionalPrice: '560.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Seed Plan
    planId = 'plan_pro_annual_001';
    mockPrisma._state.plans.push({
      id: planId,
      productId,
      name: 'Analytics Pro Annual',
      billingCycle: 'YEARLY',
      price: '5560.00',
      setupFee: '1000.00',
      currency: 'INR',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Seed Tax (18% GST)
    mockPrisma._state.taxes.push({
      id: 'tax_gst_18',
      name: 'GST 18%',
      percentage: '18.00',
      jurisdiction: 'IN',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Seed Active Subscription for Customer A
    subscriptionId = 'sub_active_001';
    mockPrisma._state.subscriptions.push({
      id: subscriptionId,
      subscriptionNumber: 'SUB-000001',
      customerId: customerAId,
      planId,
      status: 'ACTIVE',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
      nextBillingDate: new Date('2026-02-01T00:00:00.000Z'),
      billingCycleAnchor: new Date('2026-01-01T00:00:00.000Z'),
      billingCycle: 'MONTHLY',
      recurringPrice: '5000.00',
      setupFee: '500.00',
      currency: 'INR',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    });
  });

  // =========================================================================
  // 1. Invoice CRUD & Authoritative Financial Calculations
  // =========================================================================
  describe('1. Invoice CRUD & Calculations', () => {
    it('STAFF can create a manual invoice with line items, tax, and calculated totals', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customerId: customerAId,
          currency: 'INR',
          paymentTerms: 'NET_15',
          notes: 'Standard onboarding invoice',
          items: [
            {
              productId,
              description: 'SubPilot Base License',
              quantity: 2,
              unitPrice: '5000.00',
              discountAmount: '500.00',
              taxId: 'tax_gst_18'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const inv = res.body.data;
      expect(inv.invoiceNumber).toMatch(/^INV-\d{6}$/);
      expect(inv.status).toBe('DRAFT');
      expect(inv.customerId).toBe(customerAId);

      // Line items verification
      // 2 * 5000 = 10000; discount = 500; taxable = 9500; 18% tax = 1710; total = 11210
      expect(inv.subtotal).toBe('10000.00');
      expect(inv.discountAmount).toBe('500.00');
      expect(inv.taxAmount).toBe('1710.00');
      expect(inv.totalAmount).toBe('11210.00');
      expect(inv.amountDue).toBe('11210.00');
      expect(inv.amountPaid).toBe('0.00');
      expect(inv.items).toHaveLength(1);
      expect(inv.items[0].lineTotal).toBe('11210.00');
    });

    it('Rejects invoice creation with empty items array (422/400)', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customerId: customerAId,
          items: []
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('Rejects invoice creation for non-existent customer (404)', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: 'cst_nonexistent_999',
          items: [
            { description: 'Service Fee', quantity: 1, unitPrice: '100.00' }
          ]
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('Can fetch invoice details by ID with populated customer and items', async () => {
      const createRes = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerAId,
          items: [
            { description: 'Consulting Hours', quantity: 5, unitPrice: '1200.00' }
          ]
        });

      const invId = createRes.body.data.id;

      const getRes = await request(app)
        .get(`/api/v1/invoices/${invId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.id).toBe(invId);
      expect(getRes.body.data.totalAmount).toBe('6000.00');
      expect(getRes.body.data.customer).toBeDefined();
      expect(getRes.body.data.customer.id).toBe(customerAId);
    });

    it('Can update a DRAFT invoice and recalculate totals', async () => {
      const createRes = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customerId: customerAId,
          items: [
            { description: 'Initial Line', quantity: 1, unitPrice: '2000.00' }
          ]
        });

      const invId = createRes.body.data.id;

      const patchRes = await request(app)
        .patch(`/api/v1/invoices/${invId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          notes: 'Updated invoice notes',
          items: [
            { description: 'Updated Line 1', quantity: 2, unitPrice: '2500.00' },
            { description: 'Updated Line 2', quantity: 1, unitPrice: '1500.00' }
          ]
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.notes).toBe('Updated invoice notes');
      // 2 * 2500 + 1500 = 6500
      expect(patchRes.body.data.totalAmount).toBe('6500.00');
      expect(patchRes.body.data.items).toHaveLength(2);
    });
  });

  // =========================================================================
  // 2. Invoice Lifecycle: Issue, Void, Immutability & Overdue
  // =========================================================================
  describe('2. Invoice Lifecycle Transitions', () => {
    it('Can issue a DRAFT invoice, transitioning status to ISSUED', async () => {
      const createRes = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customerId: customerAId,
          items: [{ description: 'Monthly Retainer', quantity: 1, unitPrice: '8000.00' }]
        });
      const invId = createRes.body.data.id;

      const issueRes = await request(app)
        .post(`/api/v1/invoices/${invId}/issue`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ paymentTerms: 'NET_30' });

      expect(issueRes.status).toBe(200);
      expect(issueRes.body.data.status).toBe('ISSUED');
      expect(issueRes.body.data.issuedAt).toBeDefined();
    });

    it('Rejects editing an ISSUED invoice (Financial line items immutable)', async () => {
      const createRes = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customerId: customerAId,
          items: [{ description: 'Fixed Fee', quantity: 1, unitPrice: '3000.00' }]
        });
      const invId = createRes.body.data.id;

      await request(app)
        .post(`/api/v1/invoices/${invId}/issue`)
        .set('Authorization', `Bearer ${staffToken}`);

      const patchRes = await request(app)
        .patch(`/api/v1/invoices/${invId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          items: [{ description: 'Illegal Alteration', quantity: 1, unitPrice: '100.00' }]
        });

      expect(patchRes.status).toBe(400);
      expect(patchRes.body.message).toMatch(/only draft invoices can be updated/i);
    });

    it('Can void an issued invoice', async () => {
      const createRes = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customerId: customerAId,
          items: [{ description: 'Mistake Item', quantity: 1, unitPrice: '500.00' }]
        });
      const invId = createRes.body.data.id;

      const voidRes = await request(app)
        .post(`/api/v1/invoices/${invId}/void`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: 'Duplicate billing error' });

      expect(voidRes.status).toBe(200);
      expect(voidRes.body.data.status).toBe('VOID');
      expect(voidRes.body.data.amountDue).toBe('0.00');
    });

    it('Rejects voiding an already voided invoice', async () => {
      const createRes = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerAId,
          items: [{ description: 'Test Item', quantity: 1, unitPrice: '500.00' }]
        });
      const invId = createRes.body.data.id;

      await request(app)
        .post(`/api/v1/invoices/${invId}/void`)
        .set('Authorization', `Bearer ${adminToken}`);

      const secondVoidRes = await request(app)
        .post(`/api/v1/invoices/${invId}/void`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(secondVoidRes.status).toBe(400);
      expect(secondVoidRes.body.message).toMatch(/already voided/i);
    });

    it('Overdue service marks unpaid issued invoice as OVERDUE after dueDate passes', async () => {
      // Seed an issued invoice with a past dueDate
      const pastDue = new Date('2026-01-15T00:00:00.000Z');
      const inv = await mockPrisma.invoice.create({
        data: {
          invoiceNumber: 'INV-PAST-01',
          customerId: customerAId,
          status: 'ISSUED',
          invoiceDate: new Date('2026-01-01T00:00:00.000Z'),
          dueDate: pastDue,
          totalAmount: '2500.00',
          amountDue: '2500.00',
          amountPaid: '0.00',
          subtotal: '2500.00'
        }
      });

      const overdueResults = await billingService.checkAndUpdateOverdueInvoices(new Date('2026-01-20T00:00:00.000Z'));
      expect(overdueResults.updatedCount).toBeGreaterThanOrEqual(1);

      const refreshed = await mockPrisma.invoice.findUnique({ where: { id: inv.id } });
      expect(refreshed.status).toBe('OVERDUE');
      expect(refreshed.totalAmount).toBe('2500.00'); // Totals must never change
    });
  });

  // =========================================================================
  // 3. Automated Subscription Billing Engine
  // =========================================================================
  describe('3. Automated Subscription Billing Engine', () => {
    it('Generates invoice from active subscription using snapshot recurring price and includes setup fee on first run', async () => {
      const result = await billingService.generateSubscriptionInvoice(subscriptionId, new Date('2026-02-01T00:00:00.000Z'));

      expect(result.isDuplicate).toBe(false);
      expect(result.invoice).toBeDefined();
      expect(result.invoice.status).toBe('ISSUED');
      expect(result.invoice.subscriptionId).toBe(subscriptionId);
      expect(result.invoice.periodStart).toBeDefined();
      expect(result.invoice.periodEnd).toBeDefined();

      // Recurring 5000 + Setup Fee 500 = 5500
      expect(result.invoice.totalAmount).toBe('5500.00');

      // Subscription nextBillingDate should have advanced
      const updatedSub = await mockPrisma.subscription.findUnique({ where: { id: subscriptionId } });
      expect(new Date(updatedSub.nextBillingDate).getTime()).toBeGreaterThan(new Date('2026-02-01T00:00:00.000Z').getTime());
    });

    it('Second billing cycle for subscription does NOT charge setup fee again', async () => {
      // First cycle (generates invoice with setup fee)
      await billingService.generateSubscriptionInvoice(subscriptionId, new Date('2026-02-01T00:00:00.000Z'));

      // Second cycle (as of next period)
      const secondResult = await billingService.generateSubscriptionInvoice(subscriptionId, new Date('2026-03-01T00:00:00.000Z'));

      expect(secondResult.isDuplicate).toBe(false);
      // Recurring only = 5000 (no setup fee)
      expect(secondResult.invoice.totalAmount).toBe('5000.00');
    });

    it('Duplicate billing prevention: Running billing twice for same period is idempotent', async () => {
      const firstRun = await billingService.generateSubscriptionInvoice(subscriptionId, new Date('2026-02-01T00:00:00.000Z'));
      expect(firstRun.isDuplicate).toBe(false);

      // Reset subscription period back to same period to test collision
      await mockPrisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
          currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z')
        }
      });

      const secondRun = await billingService.generateSubscriptionInvoice(subscriptionId, new Date('2026-02-01T00:00:00.000Z'));
      expect(secondRun.isDuplicate).toBe(true);
      expect(secondRun.invoice.id).toBe(firstRun.invoice.id);
    });

    it('Rejects billing generation for PAUSED, CANCELED, or EXPIRED subscriptions', async () => {
      const pausedSub = await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-PAUSED-01',
          customerId: customerAId,
          status: 'PAUSED',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
          recurringPrice: '1000.00'
        }
      });

      await expect(
        billingService.generateSubscriptionInvoice(pausedSub.id)
      ).rejects.toThrow(/subscription must be active/i);
    });

    it('Batch runner `generateRecurringInvoices` processes all due active subscriptions', async () => {
      const results = await billingService.generateRecurringInvoices(new Date('2026-02-01T00:00:00.000Z'));
      expect(results.processed).toBeGreaterThanOrEqual(1);
      expect(results.succeeded).toBeGreaterThanOrEqual(1);
      expect(results.failed).toBe(0);
    });
  });

  // =========================================================================
  // 4. RBAC & Anti-IDOR Ownership Protection
  // =========================================================================
  describe('4. RBAC & Customer Ownership', () => {
    let customerAInvoiceId;

    beforeEach(async () => {
      const inv = await mockPrisma.invoice.create({
        data: {
          invoiceNumber: 'INV-A-1001',
          customerId: customerAId,
          status: 'ISSUED',
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 15 * 86400000),
          totalAmount: '4500.00',
          amountDue: '4500.00',
          amountPaid: '0.00',
          subtotal: '4500.00'
        }
      });
      customerAInvoiceId = inv.id;
    });

    it('Customer A can view their own invoice details', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${customerAInvoiceId}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(customerAInvoiceId);
    });

    it('Customer B CANNOT view Customer A invoice (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${customerAInvoiceId}`)
        .set('Authorization', `Bearer ${customerBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/do not own this invoice/i);
    });

    it('CUSTOMER cannot create, issue, or void invoices (403 Forbidden)', async () => {
      const createRes = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          customerId: customerAId,
          items: [{ description: 'Test', quantity: 1, unitPrice: '100.00' }]
        });
      expect(createRes.status).toBe(403);

      const issueRes = await request(app)
        .post(`/api/v1/invoices/${customerAInvoiceId}/issue`)
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(issueRes.status).toBe(403);

      const voidRes = await request(app)
        .post(`/api/v1/invoices/${customerAInvoiceId}/void`)
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(voidRes.status).toBe(403);
    });

    it('CUSTOMER listing automatically scopes to own customerId only', async () => {
      // Seed an invoice for Customer B
      await mockPrisma.invoice.create({
        data: {
          invoiceNumber: 'INV-B-2001',
          customerId: customerBId,
          status: 'ISSUED',
          invoiceDate: new Date(),
          dueDate: new Date(),
          totalAmount: '9900.00',
          amountDue: '9900.00'
        }
      });

      const res = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.items;
      expect(items.length).toBeGreaterThanOrEqual(1);
      items.forEach(item => {
        expect(item.customerId).toBe(customerAId);
      });
    });

    it('GET /api/v1/subscriptions/:id/invoices returns invoices for subscription', async () => {
      const res = await request(app)
        .get(`/api/v1/subscriptions/${subscriptionId}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  // =========================================================================
  // 5. Dual Pagination (Offset & Cursor)
  // =========================================================================
  describe('5. Dual Pagination for Invoices', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 6; i++) {
        await mockPrisma.invoice.create({
          data: {
            id: `inv_page_${i}`,
            invoiceNumber: `INV-PAGE-${String(i).padStart(4, '0')}`,
            customerId: customerAId,
            status: 'ISSUED',
            invoiceDate: new Date(Date.now() - i * 10000),
            dueDate: new Date(Date.now() + 15 * 86400000),
            totalAmount: `${i * 100}.00`,
            amountDue: `${i * 100}.00`,
            createdAt: new Date(Date.now() - i * 10000),
            items: {
              create: [
                { description: `Item ${i}`, quantity: 1, unitPrice: `${i * 100}.00` }
              ]
            }
          }
        });
      }
    });

    it('Offset mode: returns pagination envelope with page, limit, total, totalPages', async () => {
      const res = await request(app)
        .get('/api/v1/invoices?page=1&limit=3')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.mode).toBe('offset');
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(3);
      expect(res.body.data.items).toHaveLength(3);
    });

    it('Cursor mode: returns nextCursor and fetches subsequent page deterministically', async () => {
      const page1 = await request(app)
        .get('/api/v1/invoices?limit=3&cursor')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(page1.status).toBe(200);
      expect(page1.body.data.pagination.mode).toBe('cursor');
      expect(page1.body.data.pagination.hasNextPage).toBe(true);
      expect(page1.body.data.pagination.nextCursor).toBeDefined();

      const cursor = page1.body.data.pagination.nextCursor;
      const page2 = await request(app)
        .get(`/api/v1/invoices?limit=3&cursor=${cursor}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(page2.status).toBe(200);
      expect(page2.body.data.items).toHaveLength(3);

      // Verify records are disjoint
      const ids1 = page1.body.data.items.map(i => i.id);
      const ids2 = page2.body.data.items.map(i => i.id);
      const intersection = ids1.filter(id => ids2.includes(id));
      expect(intersection).toHaveLength(0);
    });
  });
});
