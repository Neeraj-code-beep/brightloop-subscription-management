import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { config } from '../src/config/index.js';
import { startMockBackendServer, MockServerInstance } from './helpers/mockBackendServer.js';
import { retrieveRelevantDocuments } from '../src/rag/retriever.js';
import {
  registerVerifiedDocument,
  clearVerifiedDocuments
} from '../src/rag/knowledgeStore.js';

describe('RAG Knowledge Retrieval & Document Isolation', () => {
  let mockServer: MockServerInstance;
  let originalBackendUrl: string;

  beforeAll(async () => {
    mockServer = await startMockBackendServer();
    originalBackendUrl = config.backendApiUrl;
    config.backendApiUrl = mockServer.baseUrl;
  });

  afterAll(async () => {
    config.backendApiUrl = originalBackendUrl;
    await mockServer.close();
  });

  beforeEach(() => {
    clearVerifiedDocuments();
  });

  it('returns appropriate notice when no verified company policy documents are indexed', async () => {
    // In production mode, demo fixtures are disabled by default
    const retrieval = await retrieveRelevantDocuments('What is the refund policy?');

    expect(retrieval.hasVerifiedDocuments).toBe(false);
    expect(retrieval.results.length).toBe(0);
    expect(retrieval.message).toContain('No verified policy document available');
  });

  it('retrieves registered authoritative company documents with exact citations', async () => {
    registerVerifiedDocument({
      id: 'official_refund_policy_v1',
      title: 'Official Brightloop Refund Policy (2026)',
      category: 'REFUND',
      allowedRoles: ['ADMIN', 'STAFF', 'CUSTOMER'],
      lastUpdated: '2026-10-31',
      isDemoFixture: false,
      sections: [
        {
          heading: 'Satisfaction Guarantee',
          content: 'Authorized refund guarantee: Full refund within 14 calendar days.',
          citation: 'Brightloop Official Refund Policy Section 1'
        }
      ]
    });

    const retrieval = await retrieveRelevantDocuments('refund guarantee', { topK: 2 });

    expect(retrieval.results.length).toBe(1);
    const doc = retrieval.results[0];
    expect(doc.source).toBe('verified_knowledge_store');
    expect(doc.isDemoFixture).toBe(false);
    expect(doc.citation).toBe('Brightloop Official Refund Policy Section 1');
  });

  it('verifies demo fixtures algorithms when explicitly permitted for testing', async () => {
    const retrieval = await retrieveRelevantDocuments('cancellation at period end', {
      topK: 2,
      includeDemoFixtures: true
    });

    expect(retrieval.results.length).toBeGreaterThan(0);
    const topResult = retrieval.results[0];
    expect(topResult.isDemoFixture).toBe(true);
    expect(topResult.source).toBe('nonpersistent_development_store');
    expect(topResult.disclaimer).toContain('DEMO / TEST FIXTURE ONLY');
  });

  it('enforces role-based document access control (RBAC) on demo fixtures', async () => {
    // CUSTOMER role cannot retrieve demo enterprise Net-30 documents
    const customerResults = await retrieveRelevantDocuments('enterprise Net-30 payment terms', {
      userRole: 'CUSTOMER',
      includeDemoFixtures: true
    });
    expect(customerResults.results.some((r) => r.documentId === 'demo_enterprise_terms')).toBe(false);

    // STAFF role can retrieve demo enterprise Net-30 documents
    const staffResults = await retrieveRelevantDocuments('enterprise Net-30 payment terms', {
      userRole: 'STAFF',
      includeDemoFixtures: true
    });
    expect(staffResults.results.some((r) => r.documentId === 'demo_enterprise_terms')).toBe(true);
  });

  it('POST /api/v1/ai/rag/query returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/api/v1/ai/rag/query')
      .send({ query: 'cancellation terms' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Authentication required');
  });

  it('POST /api/v1/ai/rag/query returns 200 with standard envelope and "No verified policy document available" when authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/ai/rag/query')
      .set('Authorization', 'Bearer jwt_token_customer_rahul')
      .send({ query: 'cancellation terms' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('No verified policy document available');
    expect(res.body.data.results.length).toBe(0);
  });

  it('POST /api/v1/ai/rag/query returns 400 when query is missing', async () => {
    const res = await request(app)
      .post('/api/v1/ai/rag/query')
      .set('Authorization', 'Bearer jwt_token_customer_rahul')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Query is required');
  });
});
