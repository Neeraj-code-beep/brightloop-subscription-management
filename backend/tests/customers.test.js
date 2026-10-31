import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { setPrismaClient } from '../src/utils/prisma.js';
import { createMockPrisma, seedTestUser } from './testHelper.js';

describe('Customer Management Suite', () => {
  let mockPrisma;
  let adminUser, staffUser, customerUserA, customerUserB;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    setPrismaClient(mockPrisma);

    adminUser = await seedTestUser(mockPrisma, {
      name: 'Admin User',
      email: 'admin@subpilot.io',
      role: 'ADMIN'
    });

    staffUser = await seedTestUser(mockPrisma, {
      name: 'Staff User',
      email: 'staff@subpilot.io',
      role: 'STAFF'
    });

    customerUserA = await seedTestUser(mockPrisma, {
      name: 'Alice Customer',
      email: 'alice@client.com',
      role: 'CUSTOMER'
    });

    customerUserB = await seedTestUser(mockPrisma, {
      name: 'Bob Customer',
      email: 'bob@client.com',
      role: 'CUSTOMER'
    });
  });

  describe('1. Customer Creation (POST /api/v1/customers)', () => {
    it('ADMIN can create a customer without a linked account', async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          customerType: 'INDIVIDUAL',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+1-555-0100',
          billingCity: 'San Francisco',
          billingCountry: 'USA'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customer.email).toBe('john.doe@example.com');
      expect(res.body.data.customer.customerCode).toMatch(/^CUST-/);
      expect(res.body.data.customer.isActive).toBe(true);
      expect(res.body.data.accountCreated).toBe(false);
      expect(res.body.data.customer).not.toHaveProperty('passwordHash');
    });

    it('STAFF can create a customer and provision a linked login account', async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${staffUser.token}`)
        .send({
          customerType: 'COMPANY',
          companyName: 'Acme Corp',
          email: 'billing@acme.com',
          createAccount: true,
          accountEmail: 'portal@acme.com',
          accountPassword: 'Password@123',
          accountName: 'Acme Admin'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customer.companyName).toBe('Acme Corp');
      expect(res.body.data.accountCreated).toBe(true);
      expect(res.body.data.accountEmail).toBe('portal@acme.com');

      // Verify the linked user was created with strictly CUSTOMER role
      const createdUser = mockPrisma._state.users.find(u => u.email === 'portal@acme.com');
      expect(createdUser).toBeTruthy();
      expect(createdUser.role).toBe('CUSTOMER');
      expect(createdUser.createdById).toBe(staffUser.user.id);
      expect(res.body.data.customer).not.toHaveProperty('passwordHash');
    });

    it('CUSTOMER cannot create another customer (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({
          customerType: 'INDIVIDUAL',
          firstName: 'Malicious',
          email: 'malicious@example.com'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Unauthenticated requests are rejected (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .send({
          customerType: 'INDIVIDUAL',
          firstName: 'Anon',
          email: 'anon@example.com'
        });

      expect(res.status).toBe(401);
    });

    it('Duplicate customer email is rejected (409 Conflict)', async () => {
      // Seed initial customer
      await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          customerType: 'INDIVIDUAL',
          firstName: 'Existing',
          email: 'duplicate@test.com'
        });

      // Attempt creating with same email
      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          customerType: 'INDIVIDUAL',
          firstName: 'Duplicate',
          email: 'duplicate@test.com'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('Duplicate linked user account email is rejected (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          customerType: 'INDIVIDUAL',
          firstName: 'Existing User Email',
          email: 'unique-contact@test.com',
          createAccount: true,
          accountEmail: customerUserA.user.email, // already taken
          accountPassword: 'Password@123'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/user account.*already exists/i);
    });

    it('Customer and User creation rolls back together on failure', async () => {
      const initialUsersCount = mockPrisma._state.users.length;
      const initialCustomersCount = mockPrisma._state.customers.length;

      // Force an error inside customer creation by monkey-patching mock
      const originalCreate = mockPrisma.customer.create;
      mockPrisma.customer.create = async () => {
        throw new Error('Database disk error during customer insert');
      };

      try {
        await request(app)
          .post('/api/v1/customers')
          .set('Authorization', `Bearer ${adminUser.token}`)
          .send({
            customerType: 'INDIVIDUAL',
            firstName: 'Rollback',
            email: 'rollback@test.com',
            createAccount: true,
            accountEmail: 'rollback.user@test.com',
            accountPassword: 'Password@123'
          });
      } finally {
        mockPrisma.customer.create = originalCreate;
      }

      // Assert state did not keep partial write
      expect(mockPrisma._state.users.length).toBe(initialUsersCount);
      expect(mockPrisma._state.customers.length).toBe(initialCustomersCount);
    });
  });

  describe('2. Customer Listing (GET /api/v1/customers)', () => {
    beforeEach(async () => {
      // Seed 3 distinct customers
      await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          customerType: 'COMPANY',
          companyName: 'Stark Industries',
          email: 'tony@stark.com',
          billingCity: 'Malibu'
        });

      await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          customerType: 'INDIVIDUAL',
          firstName: 'Peter',
          lastName: 'Parker',
          email: 'peter@dailybugle.com',
          billingCity: 'New York'
        });

      await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          customerType: 'COMPANY',
          companyName: 'Wayne Enterprises',
          email: 'bruce@wayne.com',
          billingCity: 'Gotham'
        });
    });

    it('ADMIN can list customers with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/customers?page=1&limit=2')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.totalItems).toBeGreaterThanOrEqual(5); // 2 seeded in root beforeEach + 3 seeded here
      expect(res.body.data.pagination.hasNextPage).toBe(true);
    });

    it('STAFF can list customers', async () => {
      const res = await request(app)
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${staffUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('CUSTOMER cannot list customers (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${customerUserA.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Search filters by query across name, email, company, and code', async () => {
      const res = await request(app)
        .get('/api/v1/customers?search=stark')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].companyName).toBe('Stark Industries');
    });

    it('Filter by customerType works', async () => {
      const res = await request(app)
        .get('/api/v1/customers?customerType=INDIVIDUAL')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      res.body.data.items.forEach(c => {
        expect(c.customerType).toBe('INDIVIDUAL');
      });
    });
  });

  describe('3. Customer Ownership & IDOR Protection', () => {
    it('Customer can view their own profile', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerUserA.customerId}`)
        .set('Authorization', `Bearer ${customerUserA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(customerUserA.customerId);
      expect(res.body.data.email).toBe(customerUserA.user.email);
    });

    it('Customer cannot view another customer profile (403 Anti-IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerUserB.customerId}`)
        .set('Authorization', `Bearer ${customerUserA.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/permission to access another customer profile/i);
    });

    it('Customer can update permitted own profile fields', async () => {
      const res = await request(app)
        .patch(`/api/v1/customers/${customerUserA.customerId}`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({
          firstName: 'Alicia',
          phone: '+1-555-9999',
          billingCity: 'Seattle'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.firstName).toBe('Alicia');
      expect(res.body.data.billingCity).toBe('Seattle');
    });

    it('Customer cannot update protected fields (customerCode, isActive, status)', async () => {
      const res = await request(app)
        .patch(`/api/v1/customers/${customerUserA.customerId}`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({
          customerCode: 'HACKED-CODE',
          isActive: false
        });

      // Strict validation rejects unrecognized/disallowed keys for self-update
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);

      // Verify DB record remained untouched
      const cust = mockPrisma._state.customers.find(c => c.id === customerUserA.customerId);
      expect(cust.customerCode).not.toBe('HACKED-CODE');
      expect(cust.isActive).toBe(true);
    });

    it('Customer can access own subscriptions, but cannot access another customer subscriptions', async () => {
      // Seed a subscription for customer A and customer B
      await mockPrisma.subscription.create({
        data: {
          customerId: customerUserA.customerId,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
          currency: 'USD'
        }
      });
      await mockPrisma.subscription.create({
        data: {
          customerId: customerUserB.customerId,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
          currency: 'USD'
        }
      });

      // Customer A requests own subscriptions
      const ownRes = await request(app)
        .get(`/api/v1/customers/${customerUserA.customerId}/subscriptions`)
        .set('Authorization', `Bearer ${customerUserA.token}`);

      expect(ownRes.status).toBe(200);
      expect(ownRes.body.data.items.length).toBe(1);

      // Customer A requests Customer B subscriptions (IDOR attack attempt)
      const attackRes = await request(app)
        .get(`/api/v1/customers/${customerUserB.customerId}/subscriptions`)
        .set('Authorization', `Bearer ${customerUserA.token}`);

      expect(attackRes.status).toBe(403);
    });

    it('Customer can access own invoices, but cannot access another customer invoices', async () => {
      await mockPrisma.invoice.create({
        data: {
          customerId: customerUserA.customerId,
          invoiceNumber: 'INV-1001',
          status: 'PAID',
          totalInCents: 5000,
          amountDueInCents: 0,
          currency: 'USD',
          dueDate: new Date()
        }
      });

      // Customer A requests own invoices
      const ownRes = await request(app)
        .get(`/api/v1/customers/${customerUserA.customerId}/invoices`)
        .set('Authorization', `Bearer ${customerUserA.token}`);

      expect(ownRes.status).toBe(200);
      expect(ownRes.body.data.items.length).toBe(1);

      // Customer A requests Customer B invoices
      const attackRes = await request(app)
        .get(`/api/v1/customers/${customerUserB.customerId}/invoices`)
        .set('Authorization', `Bearer ${customerUserA.token}`);

      expect(attackRes.status).toBe(403);
    });

    it('Customer can access own payments, but cannot access another customer payments', async () => {
      const invA = await mockPrisma.invoice.create({
        data: {
          customerId: customerUserA.customerId,
          invoiceNumber: 'INV-1002',
          status: 'PAID',
          totalInCents: 5000,
          amountDueInCents: 0,
          currency: 'USD',
          dueDate: new Date()
        }
      });

      await mockPrisma.payment.create({
        data: {
          invoiceId: invA.id,
          amountInCents: 5000,
          currency: 'USD',
          status: 'SUCCEEDED',
          paymentMethod: 'CREDIT_CARD'
        }
      });

      // Customer A requests own payments
      const ownRes = await request(app)
        .get(`/api/v1/customers/${customerUserA.customerId}/payments`)
        .set('Authorization', `Bearer ${customerUserA.token}`);

      expect(ownRes.status).toBe(200);
      expect(ownRes.body.data.items.length).toBe(1);

      // Customer A requests Customer B payments
      const attackRes = await request(app)
        .get(`/api/v1/customers/${customerUserB.customerId}/payments`)
        .set('Authorization', `Bearer ${customerUserA.token}`);

      expect(attackRes.status).toBe(403);
    });
  });

  describe('4. Administrative Restrictions', () => {
    it('ADMIN can deactivate and reactivate a customer', async () => {
      // Deactivate
      const deactRes = await request(app)
        .patch(`/api/v1/customers/${customerUserA.customerId}/status`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ isActive: false });

      expect(deactRes.status).toBe(200);
      expect(deactRes.body.success).toBe(true);
      expect(deactRes.body.data.isActive).toBe(false);
      expect(deactRes.body.data.status).toBe('SUSPENDED');

      // Linked user account remains active (conceptual separation)
      const linkedUser = mockPrisma._state.users.find(u => u.id === customerUserA.user.id);
      expect(linkedUser.isActive).toBe(true);

      // Reactivate
      const reactRes = await request(app)
        .patch(`/api/v1/customers/${customerUserA.customerId}/status`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ isActive: true });

      expect(reactRes.status).toBe(200);
      expect(reactRes.body.data.isActive).toBe(true);
      expect(reactRes.body.data.status).toBe('ACTIVE');
    });

    it('STAFF cannot deactivate a customer (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/customers/${customerUserA.customerId}/status`)
        .set('Authorization', `Bearer ${staffUser.token}`)
        .send({ isActive: false });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('CUSTOMER cannot deactivate a customer (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/customers/${customerUserA.customerId}/status`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({ isActive: false });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('STAFF cannot modify protected administrative fields on PATCH /:id', async () => {
      const res = await request(app)
        .patch(`/api/v1/customers/${customerUserA.customerId}`)
        .set('Authorization', `Bearer ${staffUser.token}`)
        .send({
          customerCode: 'NEW-CODE-NOT-ALLOWED',
          status: 'ARCHIVED'
        });

      // Strict validation rejects disallowed administrative fields
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });
});
