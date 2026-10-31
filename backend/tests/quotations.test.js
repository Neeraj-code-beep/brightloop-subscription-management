import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createMockPrisma, seedTestUser } from './testHelper.js';
import { setPrismaClient } from '../src/utils/prisma.js';

describe('Quotation Management & Conversion Suite', () => {
  let mockPrisma;
  let adminToken;
  let staffToken;
  let customerUserA;
  let customerUserB;
  let customerAId;
  let customerBId;
  let productId;
  let planId;
  let variantId;
  let taxId;
  let discountId;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    setPrismaClient(mockPrisma);

    // Seed Admin & Staff
    const admin = await seedTestUser(mockPrisma, {
      name: 'Admin User',
      email: 'admin@subpilot.com',
      role: 'ADMIN'
    });
    adminToken = admin.token;

    const staff = await seedTestUser(mockPrisma, {
      name: 'Staff User',
      email: 'staff@subpilot.com',
      role: 'STAFF'
    });
    staffToken = staff.token;

    // Seed Two Customers for Ownership/IDOR tests
    customerUserA = await seedTestUser(mockPrisma, {
      name: 'Customer A',
      email: 'customer.a@brightloop.com',
      role: 'CUSTOMER'
    });
    customerAId = customerUserA.customerId;

    customerUserB = await seedTestUser(mockPrisma, {
      name: 'Customer B',
      email: 'customer.b@brightloop.com',
      role: 'CUSTOMER'
    });
    customerBId = customerUserB.customerId;

    // Seed Product (Base Price = 5000.00)
    const product = await mockPrisma.product.create({
      data: {
        name: 'Odoo ERP Professional',
        slug: 'odoo-erp-pro',
        basePrice: '5000.00',
        isActive: true
      }
    });
    productId = product.id;

    // Seed Variant (Additional Price = 560.00)
    const variant = await mockPrisma.productVariant.create({
      data: {
        productId,
        name: 'Premium Support Addon',
        sku: 'ODOO-PREM-SUPP',
        additionalPrice: '560.00',
        isActive: true
      }
    });
    variantId = variant.id;

    // Seed Plan (Price = 5560.00, SetupFee = 1000.00)
    const plan = await mockPrisma.plan.create({
      data: {
        productId,
        name: 'Odoo Pro Monthly',
        billingCycle: 'MONTHLY',
        price: '5560.00',
        setupFee: '1000.00',
        currency: 'INR',
        isActive: true
      }
    });
    planId = plan.id;

    // Seed Tax (18% GST)
    const tax = await mockPrisma.tax.create({
      data: {
        name: 'GST 18%',
        percentage: '18.00',
        jurisdiction: 'India'
      }
    });
    taxId = tax.id;

    // Seed Discount (10% = 1000 basis points)
    const discount = await mockPrisma.discount.create({
      data: {
        code: 'WELCOME10',
        type: 'PERCENTAGE',
        value: 1000,
        currency: 'INR'
      }
    });
    discountId = discount.id;
  });

  // =========================================================================
  // 1. Quotation Creation, Pricing & Line-Item Calculations
  // =========================================================================
  describe('1. Quotation Creation & Financial Calculations', () => {
    it('Creates quotation with line-item pricing, tax, and discount snapshots', async () => {
      // Plan: 5560.00, Qty: 2 -> Subtotal = 11120.00
      // Discount 10% on subtotal = 1112.00 -> Taxable = 10008.00
      // Tax 18% on 10008.00 = 1801.44
      // Setup Fee: 1000.00 * 2 = 2000.00
      // Grand Total = 10008.00 + 1801.44 + 2000.00 = 13809.44
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerAId,
          validUntil: futureDate,
          currency: 'INR',
          notes: 'Standard 7-day quote',
          items: [
            {
              productId,
              planId,
              quantity: 2,
              taxId,
              discountId
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quotationNumber).toMatch(/^QUO-\d{6}$/);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.subtotal).toBe('11120.00');
      expect(res.body.data.discountAmount).toBe('1112.00');
      expect(res.body.data.taxAmount).toBe('1801.44');
      expect(res.body.data.grandTotal).toBe('13809.44');
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].unitPrice).toBe('5560.00');
    });

    it('Catalog price changes do NOT alter existing quotation price snapshots', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const createRes = await request(app)
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerAId,
          validUntil: futureDate,
          items: [{ productId, planId, quantity: 1 }]
        });

      const quoId = createRes.body.data.id;
      expect(createRes.body.data.subtotal).toBe('5560.00');

      // Change catalog plan price from 5560.00 to 9999.00
      await mockPrisma.plan.update({
        where: { id: planId },
        data: { price: '9999.00' }
      });

      // Fetch quotation again -> price snapshot must be preserved
      const getRes = await request(app)
        .get(`/api/v1/quotations/${quoId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.subtotal).toBe('5560.00');
      expect(getRes.body.data.items[0].unitPrice).toBe('5560.00');
    });

    it('Rejects quotation creation with past validUntil date', async () => {
      const pastDate = new Date(Date.now() - 10000).toISOString();

      const res = await request(app)
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerAId,
          validUntil: pastDate,
          items: [{ productId, quantity: 1 }]
        });

      expect(res.status).toBe(422);
    });

    it('Rejects quotation with inactive product or inactive plan', async () => {
      const inactiveProd = await mockPrisma.product.create({
        data: { name: 'Inactive Prod', slug: 'inact-prod', basePrice: '100.00', isActive: false }
      });

      const res = await request(app)
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerAId,
          validUntil: new Date(Date.now() + 100000).toISOString(),
          items: [{ productId: inactiveProd.id, quantity: 1 }]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/inactive product/i);
    });
  });

  // =========================================================================
  // 2. Lifecycle & State Machine
  // =========================================================================
  describe('2. Quotation State Machine & Validation', () => {
    let draftQuotationId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerAId,
          validUntil: new Date(Date.now() + 500000).toISOString(),
          items: [{ productId, planId, quantity: 1 }]
        });
      draftQuotationId = res.body.data.id;
    });

    it('Enforces valid lifecycle flow: DRAFT -> SENT -> ACCEPTED', async () => {
      // 1. Mark as SENT
      const sendRes = await request(app)
        .post(`/api/v1/quotations/${draftQuotationId}/send`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.data.status).toBe('SENT');

      // 2. Accept
      const acceptRes = await request(app)
        .patch(`/api/v1/quotations/${draftQuotationId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'ACCEPTED' });

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.status).toBe('ACCEPTED');
    });

    it('Rejects invalid transitions (e.g. DRAFT -> ACCEPTED or REJECTED -> SENT)', async () => {
      const res = await request(app)
        .patch(`/api/v1/quotations/${draftQuotationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACCEPTED' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid status transition/i);
    });

    it('Cannot modify quotation once moved out of DRAFT status', async () => {
      await request(app)
        .post(`/api/v1/quotations/${draftQuotationId}/send`)
        .set('Authorization', `Bearer ${adminToken}`);

      const editRes = await request(app)
        .patch(`/api/v1/quotations/${draftQuotationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Sneaky edit' });

      expect(editRes.status).toBe(400);
      expect(editRes.body.message).toMatch(/only draft quotations can be modified/i);
    });

    it('Cannot send an expired quotation', async () => {
      // Manually set expiration in past
      await mockPrisma.quotation.update({
        where: { id: draftQuotationId },
        data: { validUntil: new Date(Date.now() - 50000) }
      });

      const res = await request(app)
        .post(`/api/v1/quotations/${draftQuotationId}/send`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/expired/i);
    });
  });

  // =========================================================================
  // 3. Quotation-to-Subscription Conversion
  // =========================================================================
  describe('3. Quotation-to-Subscription Conversion', () => {
    let acceptedQuotationId;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerAId,
          validUntil: new Date(Date.now() + 600000).toISOString(),
          items: [{ productId, planId, quantity: 1 }]
        });
      acceptedQuotationId = createRes.body.data.id;

      // Transition to SENT then ACCEPTED
      await request(app)
        .post(`/api/v1/quotations/${acceptedQuotationId}/send`)
        .set('Authorization', `Bearer ${adminToken}`);

      await request(app)
        .patch(`/api/v1/quotations/${acceptedQuotationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACCEPTED' });
    });

    it('Successfully converts an ACCEPTED quotation to an active subscription', async () => {
      const res = await request(app)
        .post(`/api/v1/quotations/${acceptedQuotationId}/convert`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subscription).toBeDefined();
      expect(res.body.data.subscription.subscriptionNumber).toMatch(/^SUB-\d{6}$/);
      expect(res.body.data.subscription.status).toBe('ACTIVE');
      expect(res.body.data.subscription.customerId).toBe(customerAId);
      expect(res.body.data.quotation.status).toBe('CONVERTED');
    });

    it('Idempotent conversion: repeated convert calls return existing subscription safely', async () => {
      // First conversion
      const firstRes = await request(app)
        .post(`/api/v1/quotations/${acceptedQuotationId}/convert`)
        .set('Authorization', `Bearer ${adminToken}`);

      const subId = firstRes.body.data.subscription.id;

      // Second conversion call
      const secondRes = await request(app)
        .post(`/api/v1/quotations/${acceptedQuotationId}/convert`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(secondRes.status).toBe(201);
      expect(secondRes.body.data.subscription.id).toBe(subId);
    });

    it('Rejects conversion of REJECTED or DRAFT quotations', async () => {
      const draftRes = await request(app)
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerAId,
          validUntil: new Date(Date.now() + 600000).toISOString(),
          items: [{ productId, planId, quantity: 1 }]
        });

      const res = await request(app)
        .post(`/api/v1/quotations/${draftRes.body.data.id}/convert`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/only accepted quotations/i);
    });

    it('CUSTOMER cannot convert a quotation (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/quotations/${acceptedQuotationId}/convert`)
        .set('Authorization', `Bearer ${customerUserA.token}`);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 4. RBAC & Customer Ownership (Anti-IDOR)
  // =========================================================================
  describe('4. RBAC & Customer Ownership', () => {
    let quoAId;

    beforeEach(async () => {
      const resA = await request(app)
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerAId,
          validUntil: new Date(Date.now() + 500000).toISOString(),
          items: [{ productId, planId, quantity: 1 }]
        });
      quoAId = resA.body.data.id;
    });

    it('Customer A can view their own quotation', async () => {
      const res = await request(app)
        .get(`/api/v1/quotations/${quoAId}`)
        .set('Authorization', `Bearer ${customerUserA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(quoAId);
    });

    it('Customer B CANNOT view Customer A quotation (403 Anti-IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/quotations/${quoAId}`)
        .set('Authorization', `Bearer ${customerUserB.token}`);

      expect(res.status).toBe(403);
    });

    it('Customer listing automatically filters to own customerId', async () => {
      // Create a quotation for Customer B
      await request(app)
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerBId,
          validUntil: new Date(Date.now() + 500000).toISOString(),
          items: [{ productId, planId, quantity: 1 }]
        });

      const listResA = await request(app)
        .get('/api/v1/quotations')
        .set('Authorization', `Bearer ${customerUserA.token}`);

      expect(listResA.status).toBe(200);
      expect(listResA.body.data.items.every(q => q.customerId === customerAId)).toBe(true);
    });
  });

  // =========================================================================
  // 5. Dual Pagination (Offset & Cursor)
  // =========================================================================
  describe('5. Dual Pagination for Quotations', () => {
    beforeEach(async () => {
      // Seed 4 quotations
      for (let i = 1; i <= 4; i++) {
        await mockPrisma.quotation.create({
          data: {
            quotationNumber: `QUO-PAGE-00${i}`,
            customerId: customerAId,
            status: 'DRAFT',
            subtotal: `${1000 * i}.00`,
            discountAmount: '0.00',
            taxAmount: '0.00',
            grandTotal: `${1000 * i}.00`,
            validUntil: new Date(Date.now() + 500000)
          }
        });
      }
    });

    it('Offset mode: returns pagination envelope with total and page count', async () => {
      const res = await request(app)
        .get('/api/v1/quotations?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.mode).toBe('offset');
      expect(res.body.data.pagination.total).toBe(4);
      expect(res.body.data.items).toHaveLength(2);
    });

    it('Cursor mode: returns nextCursor and fetches next page deterministically', async () => {
      const p1 = await request(app)
        .get('/api/v1/quotations?limit=2&cursor')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(p1.status).toBe(200);
      expect(p1.body.data.pagination.mode).toBe('cursor');
      expect(p1.body.data.pagination.hasNextPage).toBe(true);

      const cursor = p1.body.data.pagination.nextCursor;

      const p2 = await request(app)
        .get(`/api/v1/quotations?limit=2&cursor=${cursor}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(p2.status).toBe(200);
      expect(p2.body.data.items).toHaveLength(2);
    });
  });
});

