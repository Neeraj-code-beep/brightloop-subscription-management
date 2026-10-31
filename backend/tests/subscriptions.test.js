import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createMockPrisma, seedTestUser } from './testHelper.js';
import { setPrismaClient } from '../src/utils/prisma.js';

describe('Subscription Management & Lifecycle Suite', () => {
  let mockPrisma;
  let adminToken;
  let staffToken;
  let customerUserA;
  let customerUserB;
  let customerAId;
  let customerBId;
  let productId;
  let planId;

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

    // Seed Two Customers for Ownership/IDOR
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

    // Seed Product
    const product = await mockPrisma.product.create({
      data: {
        name: 'Brightloop CRM',
        slug: 'brightloop-crm',
        basePrice: '3000.00',
        isActive: true
      }
    });
    productId = product.id;

    // Seed Plan (Monthly, ₹3000.00)
    const plan = await mockPrisma.plan.create({
      data: {
        productId,
        name: 'CRM Starter Monthly',
        billingCycle: 'MONTHLY',
        price: '3000.00',
        setupFee: '500.00',
        currency: 'INR',
        isActive: true
      }
    });
    planId = plan.id;
  });

  // =========================================================================
  // 1. Subscription Creation & Date Computations
  // =========================================================================
  describe('1. Subscription Creation & Billing Cycles', () => {
    it('Creates subscription with snapshot prices and calculated period end dates', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerAId,
          planId,
          startDate: '2026-01-31T00:00:00.000Z',
          quantity: 1
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subscriptionNumber).toMatch(/^SUB-\d{6}$/);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.recurringPrice).toBe('3000.00');
      expect(res.body.data.setupFee).toBe('500.00');
      // Month-end calculation: Jan 31 + 1 month in 2026 -> 2026-02-28
      const currentPeriodEnd = new Date(res.body.data.currentPeriodEnd);
      expect(currentPeriodEnd.getUTCMonth()).toBe(1); // February
      expect(currentPeriodEnd.getUTCDate()).toBe(28); // Clamped to 28
    });

    it('Rejects subscription creation for inactive plan', async () => {
      const inactivePlan = await mockPrisma.plan.create({
        data: {
          productId,
          name: 'Old Deprecated Plan',
          billingCycle: 'MONTHLY',
          price: '1000.00',
          isActive: false
        }
      });

      const res = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerAId,
          planId: inactivePlan.id
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot subscribe to inactive plan/i);
    });

    it('CUSTOMER cannot create subscriptions directly (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({
          customerId: customerAId,
          planId
        });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 2. Lifecycle: Pause, Resume, Cancel & Status Transitions
  // =========================================================================
  describe('2. Subscription Lifecycle Transitions', () => {
    let subId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ customerId: customerAId, planId });
      subId = res.body.data.id;
    });

    it('Can pause an active subscription and then resume it', async () => {
      // Pause
      const pauseRes = await request(app)
        .post(`/api/v1/subscriptions/${subId}/pause`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(pauseRes.status).toBe(200);
      expect(pauseRes.body.data.status).toBe('PAUSED');
      expect(pauseRes.body.data.pausedAt).toBeDefined();

      // Resume
      const resumeRes = await request(app)
        .post(`/api/v1/subscriptions/${subId}/resume`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.data.status).toBe('ACTIVE');
      expect(resumeRes.body.data.resumedAt).toBeDefined();
    });

    it('Can cancel subscription immediately', async () => {
      const cancelRes = await request(app)
        .post(`/api/v1/subscriptions/${subId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ immediate: true, cancellationReason: 'Customer requested refund' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELED');
      expect(cancelRes.body.data.canceledAt).toBeDefined();
    });

    it('Can schedule cancellation at end of period', async () => {
      const cancelRes = await request(app)
        .post(`/api/v1/subscriptions/${subId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ immediate: false, cancellationReason: 'Will not renew next cycle' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('ACTIVE');
      expect(cancelRes.body.data.cancelAtPeriodEnd).toBe(true);
      expect(cancelRes.body.data.cancellationReason).toBe('Will not renew next cycle');
    });

    it('Rejects invalid transitions (e.g. CANCELED -> ACTIVE)', async () => {
      // First cancel
      await request(app)
        .post(`/api/v1/subscriptions/${subId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ immediate: true });

      // Attempt to resume canceled subscription
      const res = await request(app)
        .post(`/api/v1/subscriptions/${subId}/resume`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid subscription transition/i);
    });
  });

  // =========================================================================
  // 3. Customer Ownership & Anti-IDOR
  // =========================================================================
  describe('3. Customer Ownership & IDOR Protection', () => {
    let subAId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ customerId: customerAId, planId });
      subAId = res.body.data.id;
    });

    it('Customer A can view their own subscription', async () => {
      const res = await request(app)
        .get(`/api/v1/subscriptions/${subAId}`)
        .set('Authorization', `Bearer ${customerUserA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(subAId);
    });

    it('Customer B CANNOT access Customer A subscription (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/subscriptions/${subAId}`)
        .set('Authorization', `Bearer ${customerUserB.token}`);

      expect(res.status).toBe(403);
    });

    it('Customer listing automatically filters to customer own records', async () => {
      // Create sub for B
      await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ customerId: customerBId, planId });

      const listResA = await request(app)
        .get('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${customerUserA.token}`);

      expect(listResA.status).toBe(200);
      expect(listResA.body.data.items.every(s => s.customerId === customerAId)).toBe(true);
    });

    it('GET /api/v1/customers/:id/subscriptions returns customer subscriptions', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerAId}/subscriptions`)
        .set('Authorization', `Bearer ${customerUserA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 4. Dual Pagination for Subscriptions
  // =========================================================================
  describe('4. Dual Pagination for Subscriptions', () => {
    beforeEach(async () => {
      // Seed 4 subscriptions
      for (let i = 1; i <= 4; i++) {
        await mockPrisma.subscription.create({
          data: {
            subscriptionNumber: `SUB-PAGE-00${i}`,
            customerId: customerAId,
            planId,
            status: 'ACTIVE',
            recurringPrice: '3000.00',
            setupFee: '0.00',
            currency: 'INR'
          }
        });
      }
    });

    it('Offset mode: returns pagination envelope with total and limit', async () => {
      const res = await request(app)
        .get('/api/v1/subscriptions?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.mode).toBe('offset');
      expect(res.body.data.pagination.total).toBe(4);
      expect(res.body.data.items).toHaveLength(2);
    });

    it('Cursor mode: returns nextCursor and paginates deterministically', async () => {
      const p1 = await request(app)
        .get('/api/v1/subscriptions?limit=2&cursor')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(p1.status).toBe(200);
      expect(p1.body.data.pagination.mode).toBe('cursor');
      expect(p1.body.data.pagination.hasNextPage).toBe(true);

      const cursor = p1.body.data.pagination.nextCursor;

      const p2 = await request(app)
        .get(`/api/v1/subscriptions?limit=2&cursor=${cursor}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(p2.status).toBe(200);
      expect(p2.body.data.items).toHaveLength(2);
    });
  });
});

