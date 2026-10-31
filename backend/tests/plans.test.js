import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createMockPrisma, seedTestUser } from './testHelper.js';
import { setPrismaClient } from '../src/utils/prisma.js';
import {
  calculateNextBillingDate,
  BILLING_CYCLES,
  CUSTOM_BILLING_UNITS
} from '../src/utils/billingCycle.js';

describe('Plans & Billing Cycles Module', () => {
  let mockPrisma;
  let adminToken;
  let staffToken;
  let customerToken;
  let productId;
  let inactiveProductId;
  let otherProductId;
  let variantAId;
  let variantBId;
  let inactiveVariantId;
  let foreignVariantId;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    setPrismaClient(mockPrisma);

    // Seed Users
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

    const customer = await seedTestUser(mockPrisma, {
      name: 'Customer User',
      email: 'customer@subpilot.com',
      role: 'CUSTOMER'
    });
    customerToken = customer.token;

    // Seed Active Product (Base Price = 5000.00)
    const product = await mockPrisma.product.create({
      data: {
        name: 'Odoo ERP',
        slug: 'odoo-erp',
        type: 'SOFTWARE',
        basePrice: '5000.00',
        isActive: true
      }
    });
    productId = product.id;

    // Seed Inactive Product
    const inactiveProd = await mockPrisma.product.create({
      data: {
        name: 'Legacy Odoo 12',
        slug: 'legacy-odoo-12',
        type: 'SOFTWARE',
        basePrice: '2000.00',
        isActive: false
      }
    });
    inactiveProductId = inactiveProd.id;

    // Seed Another Product for Foreign Variant testing
    const otherProd = await mockPrisma.product.create({
      data: {
        name: 'Slack Integration',
        slug: 'slack-integration',
        type: 'ADD_ON',
        basePrice: '500.00',
        isActive: true
      }
    });
    otherProductId = otherProd.id;

    // Seed Variants for Primary Product
    const varA = await mockPrisma.productVariant.create({
      data: {
        productId,
        name: 'Premium Support',
        sku: 'ODOO-PREM-SUPP',
        additionalPrice: '560.00',
        isActive: true
      }
    });
    variantAId = varA.id;

    const varB = await mockPrisma.productVariant.create({
      data: {
        productId,
        name: 'Advanced Integration',
        sku: 'ODOO-ADV-INT',
        additionalPrice: '1000.00',
        isActive: true
      }
    });
    variantBId = varB.id;

    const inactVar = await mockPrisma.productVariant.create({
      data: {
        productId,
        name: 'Deprecated Addon',
        sku: 'ODOO-DEP-ADD',
        additionalPrice: '150.00',
        isActive: false
      }
    });
    inactiveVariantId = inactVar.id;

    // Seed Variant for Other Product
    const foreignVar = await mockPrisma.productVariant.create({
      data: {
        productId: otherProductId,
        name: 'Slack Webhook Bot',
        sku: 'SLACK-BOT',
        additionalPrice: '250.00',
        isActive: true
      }
    });
    foreignVariantId = foreignVar.id;
  });

  // =========================================================================
  // 1. Plan CRUD & Price Calculation
  // =========================================================================
  describe('1. Plan CRUD & Authoritative Pricing', () => {
    it('ADMIN can create a plan with base price and selected variants', async () => {
      // Base (5000.00) + Premium Support (560.00) = 5560.00
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Odoo Standard Monthly',
          description: 'Standard plan with premium support',
          productId,
          billingCycle: 'MONTHLY',
          setupFee: '1500.00',
          variantIds: [variantAId]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Odoo Standard Monthly');
      expect(res.body.data.price).toBe('5560.00');
      expect(res.body.data.setupFee).toBe('1500.00');
      expect(res.body.data.pricingBreakdown.basePrice).toBe('5000.00');
      expect(res.body.data.pricingBreakdown.variantsTotal).toBe('560.00');
      expect(res.body.data.pricingBreakdown.recurringPrice).toBe('5560.00');
      expect(res.body.data.pricingBreakdown.firstPaymentTotal).toBe('7060.00');
      expect(res.body.data.variants).toHaveLength(1);
      expect(res.body.data.variants[0].id).toBe(variantAId);
    });

    it('STAFF can create a plan with multiple variants and verified price', async () => {
      // Base (5000.00) + VarA (560.00) + VarB (1000.00) = 6560.00
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Odoo Enterprise Annual',
          productId,
          billingCycle: 'YEARLY',
          price: '6560.00',
          variantIds: [variantAId, variantBId]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.price).toBe('6560.00');
      expect(res.body.data.variants).toHaveLength(2);
    });

    it('Rejects client price that does not match backend calculated total', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Odoo Cheated Plan',
          productId,
          billingCycle: 'MONTHLY',
          price: '100.00', // Client tries to discount to 100
          variantIds: [variantAId]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/price mismatch/i);
    });

    it('Allows creating a plan with no variants (equals product base price)', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Odoo Vanilla Quarterly',
          productId,
          billingCycle: 'QUARTERLY',
          variantIds: []
        });

      expect(res.status).toBe(201);
      expect(res.body.data.price).toBe('5000.00');
      expect(res.body.data.variants).toHaveLength(0);
    });

    it('Can fetch plan details by ID with product and variant details', async () => {
      const createRes = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Odoo Pro Plan',
          productId,
          billingCycle: 'HALF_YEARLY',
          variantIds: [variantAId]
        });

      const planId = createRes.body.data.id;

      const getRes = await request(app)
        .get(`/api/v1/plans/${planId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.id).toBe(planId);
      expect(getRes.body.data.product.name).toBe('Odoo ERP');
      expect(getRes.body.data.nextBillingDatePreview).toBeDefined();
    });

    it('Can update plan details and update variant mapping', async () => {
      const createRes = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Odoo Editable Plan',
          productId,
          billingCycle: 'MONTHLY',
          variantIds: [variantAId] // 5000 + 560 = 5560
        });

      const planId = createRes.body.data.id;

      // Update variants to include VarB (5000 + 1000 = 6000)
      const updateRes = await request(app)
        .patch(`/api/v1/plans/${planId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Odoo Updated Plan',
          variantIds: [variantBId]
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe('Odoo Updated Plan');
      expect(updateRes.body.data.price).toBe('6000.00');
      expect(updateRes.body.data.variants).toHaveLength(1);
      expect(updateRes.body.data.variants[0].id).toBe(variantBId);
    });

    it('Can toggle active status of a plan', async () => {
      const createRes = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Odoo Deactivatable Plan',
          productId,
          billingCycle: 'MONTHLY'
        });

      const planId = createRes.body.data.id;

      // Deactivate
      const deactRes = await request(app)
        .patch(`/api/v1/plans/${planId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(deactRes.status).toBe(200);
      expect(deactRes.body.data.isActive).toBe(false);

      // Reactivate
      const reactRes = await request(app)
        .patch(`/api/v1/plans/${planId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ isActive: true });

      expect(reactRes.status).toBe(200);
      expect(reactRes.body.data.isActive).toBe(true);
    });
  });

  // =========================================================================
  // 2. Role-Based Access Control
  // =========================================================================
  describe('2. Role-Based Access Control', () => {
    it('CUSTOMER cannot create a plan (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Customer Created Plan',
          productId,
          billingCycle: 'MONTHLY'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('CUSTOMER cannot list or update plans (403 Forbidden)', async () => {
      const listRes = await request(app)
        .get('/api/v1/plans')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(listRes.status).toBe(403);
      expect(listRes.body.success).toBe(false);

      const updateRes = await request(app)
        .patch(`/api/v1/plans/some-id`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Hacked' });

      expect(updateRes.status).toBe(403);
      expect(updateRes.body.success).toBe(false);
    });

    it('Unauthenticated requests are rejected (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/v1/plans');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 3. Validation, Integrity & Error Handling
  // =========================================================================
  describe('3. Validation & Product/Variant Relationships', () => {
    it('Rejects plan creation for non-existent product (404)', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Plan on Missing Product',
          productId: 'non-existent-prod-id',
          billingCycle: 'MONTHLY'
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('Rejects plan creation for inactive product (400)', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Plan on Inactive Product',
          productId: inactiveProductId,
          billingCycle: 'MONTHLY'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/inactive product/i);
    });

    it('Rejects variant belonging to another product (400)', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Foreign Variant Plan',
          productId,
          billingCycle: 'MONTHLY',
          variantIds: [foreignVariantId]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/does not belong to product/i);
    });

    it('Rejects inactive variants (400)', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Inactive Variant Plan',
          productId,
          billingCycle: 'MONTHLY',
          variantIds: [inactiveVariantId]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/inactive/i);
    });

    it('Rejects duplicate variant IDs in the same request (400)', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate Variant Plan',
          productId,
          billingCycle: 'MONTHLY',
          variantIds: [variantAId, variantAId]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/duplicate variant/i);
    });

    it('Prevents duplicate plan configuration (same name + billing cycle on product) (409 Conflict)', async () => {
      await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Unique Monthly Plan',
          productId,
          billingCycle: 'MONTHLY'
        });

      const dupRes = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Unique Monthly Plan',
          productId,
          billingCycle: 'MONTHLY'
        });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.message).toMatch(/already exists/i);
    });

    it('Requires customDuration and customDurationUnit for CUSTOM billing cycle', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Custom Duration Plan Missing Info',
          productId,
          billingCycle: 'CUSTOM'
        });

      expect(res.status).toBe(422);
    });

    it('Successfully creates plan with CUSTOM billing cycle and valid duration', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Custom 45-Day Cycle Plan',
          productId,
          billingCycle: 'CUSTOM',
          customDuration: 45,
          customDurationUnit: 'DAYS'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.billingCycle).toBe('CUSTOM');
      expect(res.body.data.customDuration).toBe(45);
      expect(res.body.data.customDurationUnit).toBe('DAYS');
    });
  });

  // =========================================================================
  // 4. Billing Cycle Calculation & Month-End Tests
  // =========================================================================
  describe('4. Billing Cycle Utilities & Month-End Edge Cases', () => {
    it('MONTHLY: Jan 31 clamps to Feb 28 in non-leap year', () => {
      const startDate = new Date(Date.UTC(2025, 0, 31)); // 2025-01-31
      const nextDate = calculateNextBillingDate(startDate, BILLING_CYCLES.MONTHLY);

      expect(nextDate.getUTCFullYear()).toBe(2025);
      expect(nextDate.getUTCMonth()).toBe(1); // February
      expect(nextDate.getUTCDate()).toBe(28); // Clamped to 28
    });

    it('MONTHLY: Jan 31 clamps to Feb 29 in leap year (2024)', () => {
      const startDate = new Date(Date.UTC(2024, 0, 31)); // 2024-01-31
      const nextDate = calculateNextBillingDate(startDate, BILLING_CYCLES.MONTHLY);

      expect(nextDate.getUTCFullYear()).toBe(2024);
      expect(nextDate.getUTCMonth()).toBe(1); // February
      expect(nextDate.getUTCDate()).toBe(29); // Clamped to 29
    });

    it('QUARTERLY: Jan 31 advances 3 months to Apr 30', () => {
      const startDate = new Date(Date.UTC(2026, 0, 31)); // 2026-01-31
      const nextDate = calculateNextBillingDate(startDate, BILLING_CYCLES.QUARTERLY);

      expect(nextDate.getUTCFullYear()).toBe(2026);
      expect(nextDate.getUTCMonth()).toBe(3); // April
      expect(nextDate.getUTCDate()).toBe(30); // April has 30 days
    });

    it('HALF_YEARLY: Jan 31 advances 6 months to Jul 31', () => {
      const startDate = new Date(Date.UTC(2026, 0, 31)); // 2026-01-31
      const nextDate = calculateNextBillingDate(startDate, BILLING_CYCLES.HALF_YEARLY);

      expect(nextDate.getUTCFullYear()).toBe(2026);
      expect(nextDate.getUTCMonth()).toBe(6); // July
      expect(nextDate.getUTCDate()).toBe(31); // July has 31 days
    });

    it('YEARLY: Feb 29 leap year advances to Feb 28 in non-leap year', () => {
      const startDate = new Date(Date.UTC(2024, 1, 29)); // 2024-02-29
      const nextDate = calculateNextBillingDate(startDate, BILLING_CYCLES.YEARLY);

      expect(nextDate.getUTCFullYear()).toBe(2025);
      expect(nextDate.getUTCMonth()).toBe(1); // February
      expect(nextDate.getUTCDate()).toBe(28); // 2025 has 28 days
    });

    it('CUSTOM: Handles days, weeks, months, and years correctly', () => {
      const start = new Date(Date.UTC(2026, 2, 1, 10, 0, 0)); // 2026-03-01 10:00:00 UTC

      // Days
      const in10Days = calculateNextBillingDate(start, BILLING_CYCLES.CUSTOM, 10, CUSTOM_BILLING_UNITS.DAYS);
      expect(in10Days.getUTCDate()).toBe(11);

      // Weeks
      const in2Weeks = calculateNextBillingDate(start, BILLING_CYCLES.CUSTOM, 2, CUSTOM_BILLING_UNITS.WEEKS);
      expect(in2Weeks.getUTCDate()).toBe(15);

      // Months
      const in5Months = calculateNextBillingDate(start, BILLING_CYCLES.CUSTOM, 5, CUSTOM_BILLING_UNITS.MONTHS);
      expect(in5Months.getUTCMonth()).toBe(7); // August
      expect(in5Months.getUTCDate()).toBe(1);

      // Years
      const in3Years = calculateNextBillingDate(start, BILLING_CYCLES.CUSTOM, 3, CUSTOM_BILLING_UNITS.YEARS);
      expect(in3Years.getUTCFullYear()).toBe(2029);
    });
  });

  // =========================================================================
  // 5. Dual Pagination (Offset & Cursor)
  // =========================================================================
  describe('5. Dual Pagination (Offset-based & Cursor-based)', () => {
    beforeEach(async () => {
      // Seed 5 plans deterministically
      for (let i = 1; i <= 5; i++) {
        await mockPrisma.plan.create({
          data: {
            productId,
            name: `Test Plan ${i}`,
            billingCycle: i % 2 === 0 ? 'MONTHLY' : 'YEARLY',
            price: `${5000 + i * 100}.00`,
            setupFee: '0.00',
            currency: 'INR',
            isActive: i !== 5 // Plan 5 is inactive
          }
        });
      }
    });

    it('Offset mode: returns page, limit, total, totalPages, and slice', async () => {
      const res = await request(app)
        .get('/api/v1/plans?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.mode).toBe('offset');
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.total).toBe(5);
      expect(res.body.data.pagination.totalPages).toBe(3);
      expect(res.body.data.items).toHaveLength(2);
    });

    it('Offset mode: page 2 returns subsequent records', async () => {
      const res = await request(app)
        .get('/api/v1/plans?page=2&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(2);
      expect(res.body.data.items).toHaveLength(2);
    });

    it('Cursor mode: page 1 returns nextCursor and hasNextPage=true', async () => {
      const res = await request(app)
        .get('/api/v1/plans?limit=2&cursor')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.mode).toBe('cursor');
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.hasNextPage).toBe(true);
      expect(res.body.data.pagination.nextCursor).toBeDefined();
      expect(res.body.data.items).toHaveLength(2);
    });

    it('Cursor mode: page 2 using nextCursor fetches deterministic next batch', async () => {
      const p1 = await request(app)
        .get('/api/v1/plans?limit=2&cursor')
        .set('Authorization', `Bearer ${adminToken}`);

      const cursor = p1.body.data.pagination.nextCursor;

      const p2 = await request(app)
        .get(`/api/v1/plans?limit=2&cursor=${cursor}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(p2.status).toBe(200);
      expect(p2.body.data.items).toHaveLength(2);

      // Verify no overlap between page 1 and page 2
      const idsP1 = p1.body.data.items.map(x => x.id);
      const idsP2 = p2.body.data.items.map(x => x.id);
      expect(idsP1.some(id => idsP2.includes(id))).toBe(false);
    });

    it('Rejects request supplying both page and cursor simultaneously (400 Bad Request)', async () => {
      const res = await request(app)
        .get('/api/v1/plans?page=1&limit=2&cursor=dummy-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot provide both/i);
    });

    it('Rejects invalid/non-existent cursor with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/plans?limit=2&cursor=non-existent-plan-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid pagination cursor/i);
    });

    it('Preserves filtering across dual pagination modes', async () => {
      // Filter by billingCycle = MONTHLY (plans 2, 4 -> 2 items total)
      const res = await request(app)
        .get('/api/v1/plans?billingCycle=MONTHLY&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.items.every(p => p.billingCycle === 'MONTHLY')).toBe(true);

      // Filter by isActive = true (plans 1, 2, 3, 4 -> 4 items)
      const activeRes = await request(app)
        .get('/api/v1/plans?isActive=true&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(activeRes.status).toBe(200);
      expect(activeRes.body.data.items).toHaveLength(4);
    });

    it('Handles search by name correctly', async () => {
      const res = await request(app)
        .get('/api/v1/plans?search=Plan 3')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].name).toBe('Test Plan 3');
    });

    it('Handles empty results gracefully in both pagination modes', async () => {
      const offsetRes = await request(app)
        .get('/api/v1/plans?search=NonExistentPlanName&page=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(offsetRes.status).toBe(200);
      expect(offsetRes.body.data.items).toHaveLength(0);
      expect(offsetRes.body.data.pagination.total).toBe(0);

      const cursorRes = await request(app)
        .get('/api/v1/plans?search=NonExistentPlanName&limit=10&cursor')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(cursorRes.status).toBe(200);
      expect(cursorRes.body.data.items).toHaveLength(0);
      expect(cursorRes.body.data.pagination.hasNextPage).toBe(false);
      expect(cursorRes.body.data.pagination.nextCursor).toBeNull();
    });
  });
});
