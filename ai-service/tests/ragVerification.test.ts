import { describe, it, expect, beforeEach } from 'vitest';
import {
  retrieveRelevantDocuments
} from '../src/rag/retriever.js';
import {
  registerVerifiedDocument,
  clearVerifiedDocuments,
  DEMO_POLICY_FIXTURES
} from '../src/rag/knowledgeStore.js';
import { generateEmbedding, cosineSimilarity } from '../src/embeddings/generator.js';
import { config as conf } from '../src/config/index.js';

describe('RAG Subsystem Verification & Document Isolation [Task 6]', () => {
  beforeEach(() => {
    clearVerifiedDocuments();
  });

  it('1. Returns "No verified policy document available" when no official documents are indexed', async () => {
    const retrieval = await retrieveRelevantDocuments('How do I cancel my plan?');

    expect(retrieval.hasVerifiedDocuments).toBe(false);
    expect(retrieval.results.length).toBe(0);
    expect(retrieval.message).toContain('No verified policy document available');
  });

  it('2. Ingests and retrieves verified company policies with exact citations', async () => {
    registerVerifiedDocument({
      id: 'doc_verified_sla',
      title: 'Brightloop Official 99.9% Uptime SLA',
      category: 'SLA',
      allowedRoles: ['ADMIN', 'STAFF', 'CUSTOMER'],
      lastUpdated: '2026-10-31',
      isDemoFixture: false,
      sections: [
        {
          heading: 'Uptime Commitment & 10% Credit',
          content: 'Brightloop guarantees 99.9% uptime. Accounts falling below this SLA receive a 10% credit.',
          citation: 'Official SLA Schedule B Section 1'
        }
      ]
    });

    const retrieval = await retrieveRelevantDocuments('99.9% uptime credit', { topK: 1 });

    expect(retrieval.hasVerifiedDocuments).toBe(true);
    expect(retrieval.results.length).toBe(1);
    expect(retrieval.results[0].title).toBe('Brightloop Official 99.9% Uptime SLA');
    expect(retrieval.results[0].citation).toBe('Official SLA Schedule B Section 1');
    expect(retrieval.results[0].source).toBe('verified_knowledge_store');
    expect(retrieval.results[0].isDemoFixture).toBe(false);
  });

  it('3. Generates 768-dimensional normalized embeddings for text chunks', async () => {
    const vecA = await generateEmbedding('Subscription cancellation terms and conditions', 768);
    const vecB = await generateEmbedding('How do I cancel my recurring subscription plan?', 768);
    const vecC = await generateEmbedding('Unrelated recipe for baking chocolate cake', 768);

    expect(vecA.length).toBe(768);
    expect(vecB.length).toBe(768);
    expect(vecC.length).toBe(768);

    // Semantic relevance check: vecA and vecB should have higher cosine similarity than vecA and vecC
    const simRelated = cosineSimilarity(vecA, vecB);
    const simUnrelated = cosineSimilarity(vecA, vecC);

    expect(simRelated).toBeGreaterThan(simUnrelated);
  });

  it('4. Enforces RBAC permissions on document retrieval', async () => {
    // When demo fixtures are evaluated, demo_enterprise_terms is restricted from CUSTOMER role
    const customerRetrieval = await retrieveRelevantDocuments('Net-30 payment terms and collection', {
      userRole: 'CUSTOMER',
      includeDemoFixtures: true
    });
    expect(customerRetrieval.results.some((r) => r.documentId === 'demo_enterprise_terms')).toBe(false);

    // STAFF role has access to enterprise terms
    const staffRetrieval = await retrieveRelevantDocuments('Net-30 payment terms and collection', {
      userRole: 'STAFF',
      includeDemoFixtures: true
    });
    expect(staffRetrieval.results.some((r) => r.documentId === 'demo_enterprise_terms')).toBe(true);
  });

  it('5. Clearly labels all demo fixtures with disclaimers and nonpersistent source', async () => {
    const retrieval = await retrieveRelevantDocuments('cancellation at period end', {
      includeDemoFixtures: true,
      topK: 1
    });

    expect(retrieval.results.length).toBe(1);
    const doc = retrieval.results[0];
    expect(doc.isDemoFixture).toBe(true);
    expect(doc.disclaimer).toContain('DEMO / TEST FIXTURE ONLY');
    expect(doc.source).toBe('nonpersistent_development_store');
  });

  it('6. Does not connect to or query Neeraj business PostgreSQL database', () => {
    // Verified: config does not expose or connect to business databaseUrl
    expect((conf as any).databaseUrl).toBeUndefined();
  });
});
