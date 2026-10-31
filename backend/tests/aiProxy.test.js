import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createMockPrisma, seedTestUser } from './testHelper.js';
import { setPrismaClient } from '../src/utils/prisma.js';
import { config } from '../src/config/index.js';

describe('AI Gateway Proxy Module Suite', () => {
  let mockPrisma;
  let adminToken, staffToken, customerToken;
  let originalFetch;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    setPrismaClient(mockPrisma);

    // Seed test users
    const adminUser = await seedTestUser(mockPrisma, {
      name: 'Admin Executive',
      email: 'admin.proxy@subpilot.com',
      role: 'ADMIN'
    });
    adminToken = adminUser.token;

    const staffUser = await seedTestUser(mockPrisma, {
      name: 'Staff Analyst',
      email: 'staff.proxy@subpilot.com',
      role: 'STAFF'
    });
    staffToken = staffUser.token;

    const custUser = await seedTestUser(mockPrisma, {
      name: 'Rahul Sharma',
      email: 'rahul.proxy@customer.com',
      role: 'CUSTOMER'
    });
    customerToken = custUser.token;

    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. HEALTH PROBE PROXY
  // =========================================================================
  describe('1. GET /api/v1/ai/health (Public Health Proxy)', () => {
    it('successfully proxies health request to upstream AI service without requiring authentication', async () => {
      const mockUpstreamResponse = {
        success: true,
        message: 'AI Service is healthy',
        data: {
          status: 'UP',
          service: 'sms-ai-service',
          geminiConfigured: true,
          huggingFaceConfigured: false,
          timestamp: '2026-10-31T12:00:00.000Z'
        }
      };

      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        expect(url).toContain('/api/v1/ai/health');
        expect(options.method).toBe('GET');
        return new Response(JSON.stringify(mockUpstreamResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      });

      const res = await request(app).get('/api/v1/ai/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UP');
      expect(res.body.data.service).toBe('sms-ai-service');
    });
  });

  // =========================================================================
  // 2. AUTHENTICATION & SECURITY ENFORCEMENT
  // =========================================================================
  describe('2. Authentication & JWT Enforcement', () => {
    it('rejects unauthenticated requests to /api/v1/ai/chat with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/ai/chat')
        .send({ prompt: 'How much do I owe?' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('token is missing or malformed');
    });

    it('rejects invalid or forged JWT tokens with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', 'Bearer invalid.bogus.token')
        .send({ prompt: 'How much do I owe?' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('forwards the caller JWT Authorization header intact to upstream AI service', async () => {
      let forwardedAuthHeader = null;

      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        forwardedAuthHeader = options.headers['authorization'];
        return new Response(
          JSON.stringify({
            success: true,
            data: { reply: 'Your balance is 0.00 INR', provider: 'scaffold' }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const res = await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ prompt: 'Check my balance' });

      expect(res.status).toBe(200);
      expect(forwardedAuthHeader).toBe(`Bearer ${customerToken}`);
    });
  });

  // =========================================================================
  // 3. CHAT PROXY & BODY/QUERY FORWARDING
  // =========================================================================
  describe('3. POST /api/v1/ai/chat (Chat Proxy)', () => {
    it('forwards request body, headers, and query parameters to upstream', async () => {
      let receivedBody = null;
      let targetUrlCalled = null;

      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        targetUrlCalled = url;
        receivedBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Query processed successfully',
            data: {
              reply: 'Active subscriptions: 2',
              answer: 'Active subscriptions: 2',
              toolsUsed: ['get_customer_subscriptions'],
              provider: 'gemini'
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const res = await request(app)
        .post('/api/v1/ai/chat?debug=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          prompt: 'Show active subscriptions',
          conversationId: 'conv_12345',
          context: { role: 'ADMIN' }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reply).toBe('Active subscriptions: 2');
      expect(res.body.data.toolsUsed).toContain('get_customer_subscriptions');

      expect(targetUrlCalled).toContain('/api/v1/ai/chat');
      expect(targetUrlCalled).toContain('debug=true');
      expect(receivedBody.prompt).toBe('Show active subscriptions');
      expect(receivedBody.conversationId).toBe('conv_12345');
    });

    it('transparently preserves upstream non-200 error responses (e.g. 400 Bad Request)', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Prompt is required and must be a string'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const res = await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Prompt is required and must be a string');
    });
  });

  // =========================================================================
  // 4. ERROR HANDLING, TIMEOUTS & AVAILABILITY
  // =========================================================================
  describe('4. Resiliency & Controlled Error Handling', () => {
    it('returns a controlled 503 Service Unavailable when the AI service is unreachable', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        const error = new TypeError('fetch failed');
        error.cause = { code: 'ECONNREFUSED' };
        throw error;
      });

      const res = await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ prompt: 'Hello AI' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('AI service is temporarily unavailable. Please try again later.');
      // Verify internal port/URL is not leaked
      expect(JSON.stringify(res.body)).not.toContain('5001');
      expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
    });

    it('returns a controlled 504 Gateway Timeout when the AI service times out', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        throw abortError;
      });

      const res = await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ prompt: 'Long running query' });

      expect(res.status).toBe(504);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('AI service request timed out');
      expect(JSON.stringify(res.body)).not.toContain('5001');
    });
  });

  // =========================================================================
  // 5. RAG QUERY & FALLBACK ROUTE FORWARDING
  // =========================================================================
  describe('5. RAG Query & Subpath Forwarding', () => {
    it('proxies POST /api/v1/ai/rag/query with authentication', async () => {
      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        expect(url).toContain('/api/v1/ai/rag/query');
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              query: 'late payment fee',
              count: 1,
              results: [{ title: 'Billing Policy', score: 0.92 }]
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const res = await request(app)
        .post('/api/v1/ai/rag/query')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ query: 'late payment fee', topK: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results[0].title).toBe('Billing Policy');
    });
  });
});

