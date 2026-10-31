import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { setPrismaClient } from '../src/utils/prisma.js';
import { createMockPrisma, seedTestUser } from './testHelper.js';

describe('RBAC & Role Enforcement Suite', () => {
  let mockPrisma;
  let adminToken, staffToken, customerToken;
  let adminUser, staffUser, customerUser;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    setPrismaClient(mockPrisma);

    const seededAdmin = await seedTestUser(mockPrisma, {
      name: 'Admin User',
      email: 'admin@brightloop.com',
      role: 'ADMIN'
    });
    adminToken = seededAdmin.token;
    adminUser = seededAdmin.user;

    const seededStaff = await seedTestUser(mockPrisma, {
      name: 'Staff User',
      email: 'staff@brightloop.com',
      role: 'STAFF'
    });
    staffToken = seededStaff.token;
    staffUser = seededStaff.user;

    const seededCustomer = await seedTestUser(mockPrisma, {
      name: 'Customer User',
      email: 'customer@client.com',
      role: 'CUSTOMER'
    });
    customerToken = seededCustomer.token;
    customerUser = seededCustomer.user;
  });

  describe('POST /api/v1/users/staff (Staff Creation)', () => {
    it('ADMIN can successfully create a STAFF account', async () => {
      const res = await request(app)
        .post('/api/v1/users/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Staff',
          email: 'newstaff@brightloop.com',
          password: 'Password@123'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('STAFF');
      expect(res.body.data.createdById).toBe(adminUser.id);
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('STAFF cannot create staff accounts (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/users/staff')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Another Staff',
          email: 'anotherstaff@brightloop.com',
          password: 'Password@123'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/insufficient permissions/i);
    });

    it('CUSTOMER cannot create staff accounts (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/users/staff')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Fake Staff',
          email: 'fakestaff@client.com',
          password: 'Password@123'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/insufficient permissions/i);
    });

    it('Unauthenticated requests receive 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/users/staff')
        .send({
          name: 'No Auth',
          email: 'noauth@example.com',
          password: 'Password@123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/users (Admin-only Endpoint)', () => {
    it('ADMIN can list all user accounts', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('STAFF cannot access user list (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('CUSTOMER cannot access user list (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/users/:id (Role Protection & Anti-Self-Promotion)', () => {
    it('Ordinary user cannot promote themselves to ADMIN (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          role: 'ADMIN'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/self-promotion|role changing is prohibited/i);
    });

    it('ADMIN can update another user role to STAFF or ADMIN', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'STAFF'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('STAFF');
    });
  });
});

