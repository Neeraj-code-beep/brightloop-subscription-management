import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { setPrismaClient } from '../src/utils/prisma.js';
import { createMockPrisma, seedTestUser } from './testHelper.js';

describe('Customer Ownership & IDOR Protection Suite', () => {
  let mockPrisma;
  let customerAToken, customerBToken, adminToken, staffToken;
  let customerAId, customerBId;
  let invoiceAId, invoiceBId;
  let subscriptionAId, subscriptionBId;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    setPrismaClient(mockPrisma);

    // Seed Admin & Staff
    const admin = await seedTestUser(mockPrisma, { email: 'admin@brightloop.com', role: 'ADMIN' });
    adminToken = admin.token;

    const staff = await seedTestUser(mockPrisma, { email: 'staff@brightloop.com', role: 'STAFF' });
    staffToken = staff.token;

    // Seed Customer A
    const customerA = await seedTestUser(mockPrisma, { email: 'customerA@client.com', role: 'CUSTOMER' });
    customerAToken = customerA.token;
    customerAId = customerA.customerId;

    // Seed Customer B
    const customerB = await seedTestUser(mockPrisma, { email: 'customerB@client.com', role: 'CUSTOMER' });
    customerBToken = customerB.token;
    customerBId = customerB.customerId;

    // Seed Invoice A & B
    invoiceAId = 'inv_customer_a_001';
    invoiceBId = 'inv_customer_b_002';
    mockPrisma._state.invoices.push(
      { id: invoiceAId, customerId: customerAId, invoiceNumber: 'INV-A-01', totalInCents: 5000 },
      { id: invoiceBId, customerId: customerBId, invoiceNumber: 'INV-B-02', totalInCents: 9000 }
    );

    // Seed Subscription A & B
    subscriptionAId = 'sub_customer_a_001';
    subscriptionBId = 'sub_customer_b_002';
    mockPrisma._state.subscriptions.push(
      { id: subscriptionAId, customerId: customerAId, status: 'ACTIVE' },
      { id: subscriptionBId, customerId: customerBId, status: 'ACTIVE' }
    );
  });

  describe('Invoice Ownership Checks (Anti-IDOR)', () => {
    it('Customer A can successfully access their own invoice', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${invoiceAId}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(invoiceAId);
      expect(res.body.data.customerId).toBe(customerAId);
    });

    it('Customer A CANNOT access Customer B invoice (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${invoiceBId}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/do not own this invoice/i);
    });

    it('Customer B CANNOT access Customer A invoice by altering URL ID parameter (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${invoiceAId}`)
        .set('Authorization', `Bearer ${customerBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/do not own this invoice/i);
    });

    it('ADMIN can access any customer invoice', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${invoiceAId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(invoiceAId);
    });

    it('STAFF can access any customer invoice for operational support', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${invoiceAId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(invoiceAId);
    });
  });

  describe('Subscription Ownership Checks (Anti-IDOR)', () => {
    it('Customer A can access their own subscription', async () => {
      const res = await request(app)
        .get(`/api/v1/subscriptions/${subscriptionAId}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(subscriptionAId);
    });

    it('Customer A CANNOT access Customer B subscription (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/subscriptions/${subscriptionBId}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/do not own this subscription/i);
    });
  });
});

