import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { setPrismaClient } from '../src/utils/prisma.js';
import { createMockPrisma } from './testHelper.js';
import { hashToken } from '../src/utils/crypto.js';

describe('Session, Refresh Tokens & Password Reset Suite', () => {
  let mockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    setPrismaClient(mockPrisma);
  });

  describe('Refresh Token Rotation & Revocation', () => {
    it('valid refresh token rotates successfully, returning new access & refresh tokens', async () => {
      // 1. Register user
      const reg = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Session User',
          email: 'session@example.com',
          password: 'Password@123'
        });

      const initialRefreshToken = reg.body.data.refreshToken;

      // 2. Refresh
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data).toHaveProperty('accessToken');
      expect(refreshRes.body.data).toHaveProperty('refreshToken');

      const newRefreshToken = refreshRes.body.data.refreshToken;
      expect(newRefreshToken).not.toBe(initialRefreshToken);

      // 3. Old refresh token should now be revoked and rejected (token reuse protection)
      const reusedRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(reusedRes.status).toBe(401);
      expect(reusedRes.body.success).toBe(false);
    });

    it('rejects expired refresh token (401)', async () => {
      // Seed user and expired refresh token
      const user = await mockPrisma.user.create({
        data: {
          name: 'Expired Token User',
          email: 'expired@example.com',
          passwordHash: 'hashed',
          role: 'CUSTOMER'
        }
      });

      const rawToken = 'expired_raw_token_xyz';
      mockPrisma._state.refreshTokens.push({
        id: 'rt_expired',
        userId: user.id,
        tokenHash: hashToken(rawToken),
        isRevoked: false,
        expiresAt: new Date(Date.now() - 1000 * 60 * 60) // Expired 1 hour ago
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rawToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/expired/i);
    });

    it('logout invalidates the current session', async () => {
      const reg = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Logout User',
          email: 'logout@example.com',
          password: 'Password@123'
        });

      const tokenToLogout = reg.body.data.refreshToken;

      // Logout
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: tokenToLogout });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Attempting to refresh with the logged-out token fails
      const refreshAttempt = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokenToLogout });

      expect(refreshAttempt.status).toBe(401);
      expect(refreshAttempt.body.success).toBe(false);
    });
  });

  describe('Password Reset Lifecycle', () => {
    it('forgot-password returns generic response regardless of whether email exists', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'anyemail@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/instructions have been sent/i);
    });

    it('reset-password validates token and updates password', async () => {
      // 1. Register
      const reg = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Reset User',
          email: 'reset@example.com',
          password: 'Password@123'
        });

      const userId = reg.body.data.user.id;
      const rawResetToken = 'valid_reset_token_secret_123';

      mockPrisma._state.passwordResetTokens.push({
        id: 'prt_1',
        userId,
        tokenHash: hashToken(rawResetToken),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        isUsed: false
      });

      // 2. Perform reset
      const resetRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawResetToken,
          newPassword: 'BrandNewPassword@456'
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // 3. Login with new password succeeds
      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'reset@example.com',
          password: 'BrandNewPassword@456'
        });

      expect(newLogin.status).toBe(200);
      expect(newLogin.body.success).toBe(true);

      // 4. Login with old password fails
      const oldLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'reset@example.com',
          password: 'Password@123'
        });

      expect(oldLogin.status).toBe(401);
    });
  });
});

