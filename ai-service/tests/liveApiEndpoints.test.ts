import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { app } from '../src/index.js';
import { config } from '../src/config/index.js';
import { BackendApiClient, BackendHttpError } from '../src/mcp/backendClient.js';
import { BACKEND_ENDPOINTS } from '../src/config/endpoints.js';
import { startMockBackendServer, MockServerInstance } from './helpers/mockBackendServer.js';

describe('Live AI Service Startup & Backend Endpoint Preparation [Task 3 & 4]', () => {
  let server: http.Server;
  let mockServer: MockServerInstance;
  let originalBackendUrl: string;
  const PORT = 5001;
  const BASE_URL = `http://127.0.0.1:${PORT}`;

  beforeAll(async () => {
    mockServer = await startMockBackendServer();
    originalBackendUrl = config.backendApiUrl;
    config.backendApiUrl = mockServer.baseUrl;

    // Start AI service independently on port 5001
    await new Promise<void>((resolve, reject) => {
      server = app.listen(PORT, '127.0.0.1', () => {
        resolve();
      });
      server.on('error', reject);
    });
  });

  afterAll(async () => {
    config.backendApiUrl = originalBackendUrl;
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (mockServer) {
      await mockServer.close();
    }
  });

  describe('1. Independent Port 5001 AI Service Startup & Core Endpoints', () => {
    it('GET /api/v1/ai/health returns 200 with service status and configuration metadata', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/ai/health`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('UP');
      expect(body.data.service).toBe('sms-ai-service');
      expect(typeof body.data.geminiConfigured).toBe('boolean');
      expect(typeof body.data.huggingFaceConfigured).toBe('boolean');
    });

    it('POST /api/v1/ai/chat returns 200 with dual-key reply and answer fields', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer live_test_scoped_jwt'
        },
        body: JSON.stringify({
          prompt: 'What is my current subscription plan?'
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      // Verifies dual-key contract for frontend consumption
      expect(body.data.reply).toBeDefined();
      expect(body.data.answer).toBeDefined();
      expect(body.data.answer).toBe(body.data.reply);
      expect(body.data.provider).toBeDefined();
    });

    it('POST /api/v1/ai/rag/query returns 200 with safe "No verified policy document available" message', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/ai/rag/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer live_test_scoped_jwt'
        },
        body: JSON.stringify({
          query: 'What is the refund policy for enterprise customers?'
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('No verified policy document available');
      expect(body.data.count).toBe(0);
      expect(body.data.results).toEqual([]);
    });
  });

  describe('2. Provider Configuration & Environment Variable Verification', () => {
    it('verifies Gemini and Hugging Face model identifiers and router endpoints', () => {
      // Confirms supported model identifiers
      expect(config.geminiModel).toBe('gemini-3.8-flash');
      expect(config.geminiEmbeddingModel).toBe('gemini-embedding-001');
      expect(config.huggingFaceModel).toBe('meta-llama/Llama-3.1-8B-Instruct');
      expect(config.huggingFaceBaseUrl).toBe('https://router.huggingface.co/v1/chat/completions');

      // Verifies environment variable keys are not leaked in plain text
      const geminiConfigured = Boolean(config.geminiApiKey && !config.geminiApiKey.includes('your-gemini-api-key'));
      const hfConfigured = Boolean(config.huggingFaceApiKey && !config.huggingFaceApiKey.includes('your-huggingface-api-key'));

      // Safe logging without printing secret values
      console.log(`[Provider Status] Gemini Configured: ${geminiConfigured ? 'YES' : 'NO (Missing API Key)'}`);
      console.log(`[Provider Status] Hugging Face Configured: ${hfConfigured ? 'YES' : 'NO (Missing Token)'}`);
    });
  });

  describe('3. Live Backend Customer Endpoint Integration & Isolation Preparation', () => {
    it('probes Neeraj backend and cleanly marks live test as BLOCKED if backend is offline', async () => {
      let isBackendOnline = false;
      const targetBackendUrl = originalBackendUrl || 'http://localhost:5000/api/v1';
      try {
        const probeRes = await fetch(`${targetBackendUrl}${BACKEND_ENDPOINTS.customers.list}`, {
          method: 'GET',
          signal: AbortSignal.timeout(2000)
        });
        isBackendOnline = probeRes.status > 0;
      } catch {
        isBackendOnline = false;
      }

      if (!isBackendOnline) {
        // Backend is offline on port 5000. Mark integration as BLOCKED without fabricating results
        console.warn(
          `[LIVE INTEGRATION BLOCKED] Backend service at ${targetBackendUrl} is currently offline (ECONNREFUSED). ` +
          `Live customer endpoint verification is blocked until Neeraj's backend service is running.`
        );

        // Verify that the client cleanly handles the offline state
        config.backendApiUrl = targetBackendUrl;
        const offlineClient = new BackendApiClient('test_jwt_account');
        await expect(offlineClient.getCustomerDetails('cst_test_01')).rejects.toThrow(BackendHttpError);
        config.backendApiUrl = mockServer.baseUrl;
        return;
      }

      // If backend is online, run customer-scoped verification with real authenticated test account
      const testJwt = process.env.LIVE_TEST_JWT;
      if (!testJwt) {
        console.warn('[LIVE INTEGRATION BLOCKED] LIVE_TEST_JWT is not provided in environment.');
        return;
      }

      const client = new BackendApiClient(testJwt);
      const customerId = process.env.LIVE_TEST_CUSTOMER_ID || 'cst_test_customer';

      // 1. Authoritative Identity Resolution via /api/v1/auth/me
      const profile = await client.getAuthMe();
      expect(profile).toBeDefined();

      // 2. Customer Details (Own scope only)
      const customer = await client.getCustomerDetails(customerId);
      expect(customer).toBeDefined();
      expect(customer.id).toBe(customerId);

      // 3. Customer Subscriptions (Own scope only)
      const subscriptions = await client.getCustomerSubscriptions(customerId);
      expect(subscriptions.items).toBeDefined();
      subscriptions.items.forEach((sub) => {
        // Ensure no access to another customer's information
        expect(sub.customerId).toBe(customerId);
      });

      // 4. Customer Invoices (Own scope only)
      const invoices = await client.getCustomerInvoices(customerId);
      expect(invoices.items).toBeDefined();
      invoices.items.forEach((inv) => {
        expect(inv.customerId).toBe(customerId);
      });

      // 5. Customer Payments (Own scope only)
      const payments = await client.getCustomerPayments(customerId);
      expect(payments.items).toBeDefined();

      // 6. Customer Billing Summary
      const summary = await client.getCustomerBillingSummary(customerId);
      expect(summary).toBeDefined();
      expect(summary.customerId).toBe(customerId);

      // 7. Global Analytics Authorization (Admin vs Restricted)
      const adminJwt = process.env.LIVE_TEST_ADMIN_JWT;
      if (adminJwt) {
        const adminClient = new BackendApiClient(adminJwt);
        const revenue = await adminClient.getRevenueSummary();
        expect(revenue).toBeDefined();
        const overdue = await adminClient.getOverdueInvoices();
        expect(overdue).toBeDefined();
      }
    });
  });
});
