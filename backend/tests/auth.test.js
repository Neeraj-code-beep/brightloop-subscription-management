import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { setPrismaClient } from '../src/utils/prisma.js';
import { createMockPrisma, seedTestUser } from './testHelper.js';

describe('Authentication & Registration Suite', () => {
  let mockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    setPrismaClient(mockPrisma);
  });

  describe('POST /api/v1/auth/register', () => {
    it('successfully registers a customer with valid details and strong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'Password@123'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('jane@example.com');
      expect(res.body.data.user.role).toBe('CUSTOMER');
      expect(res.body.data.user.customerId).toBeTruthy();
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('rejects registration with duplicate email (409 Conflict)', async () => {
      await seedTestUser(mockPrisma, { email: 'existing@example.com' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Another Jane',
          email: 'existing@example.com',
          password: 'Password@123'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('rejects invalid email formats (422)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'not-an-email',
          password: 'Password@123'
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('rejects weak password with fewer than 9 characters (422)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'short@example.com',
          password: 'P@1'
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('rejects weak password missing special character (422)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'nospecial@example.com',
          password: 'Password123'
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('prevents privilege escalation: client cannot register as ADMIN or STAFF', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Attacker',
          email: 'attacker@example.com',
          password: 'Password@123',
          role: 'ADMIN' // Malicious attempt to escalate privileges
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('CUSTOMER'); // Strictly enforced as CUSTOMER
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('successfully logs in with valid credentials', async () => {
      await seedTestUser(mockPrisma, {
        email: 'active@example.com',
        password: 'Password@123',
        role: 'CUSTOMER'
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'active@example.com',
          password: 'Password@123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user.email).toBe('active@example.com');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('rejects login with incorrect password with generic error (401)', async () => {
      await seedTestUser(mockPrisma, {
        email: 'user@example.com',
        password: 'Password@123'
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'user@example.com',
          password: 'WrongPassword@123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('rejects login for unknown email with generic error (401)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password@123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('rejects deactivated user account (403)', async () => {
      await seedTestUser(mockPrisma, {
        email: 'inactive@example.com',
        password: 'Password@123',
        isActive: false
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'inactive@example.com',
          password: 'Password@123'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/deactivated/i);
    });

    it('rejects missing credentials (422)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });
});

