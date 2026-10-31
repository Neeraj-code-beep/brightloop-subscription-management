import { generateEmbedding, cosineSimilarity } from '../embeddings/generator.js';
import {
  KnowledgeDocument,
  VERIFIED_COMPANY_DOCUMENTS,
  DEMO_POLICY_FIXTURES
} from './knowledgeStore.js';

export interface RetrievedDocument {
  id: string;
  documentId: string;
  title: string;
  section: string;
  category: string;
  content: string;
  similarity: number;
  citation: string;
  source: 'verified_knowledge_store' | 'nonpersistent_development_store';
  isDemoFixture: boolean;
  disclaimer?: string;
}

export interface RetrievalOptions {
  topK?: number;
  userRole?: string;
  category?: string;
  minSimilarity?: number;
  includeDemoFixtures?: boolean;
}

interface EmbeddedChunk {
  id: string;
  documentId: string;
  title: string;
  section: string;
  category: string;
  content: string;
  citation: string;
  allowedRoles: string[];
  isDemoFixture: boolean;
  disclaimer?: string;
  embedding: number[];
}

let cachedChunks: { key: string; chunks: EmbeddedChunk[] } | null = null;

async function getOrBuildEmbeddedChunks(docs: KnowledgeDocument[]): Promise<EmbeddedChunk[]> {
  const cacheKey = docs.map((d) => `${d.id}:${d.lastUpdated}`).join('|');
  if (cachedChunks && cachedChunks.key === cacheKey) {
    return cachedChunks.chunks;
  }

  const chunks: EmbeddedChunk[] = [];
  for (const doc of docs) {
    for (let i = 0; i < doc.sections.length; i++) {
      const section = doc.sections[i];
      const chunkText = `${doc.title}\n${section.heading}\n${section.content}`;
      const embedding = await generateEmbedding(chunkText);
      chunks.push({
        id: `${doc.id}_sec_${i + 1}`,
        documentId: doc.id,
        title: doc.title,
        section: section.heading,
        category: doc.category,
        content: section.content,
        citation: section.citation,
        allowedRoles: doc.allowedRoles,
        isDemoFixture: Boolean(doc.isDemoFixture),
        disclaimer: doc.disclaimer,
        embedding
      });
    }
  }

  cachedChunks = { key: cacheKey, chunks };
  return chunks;
}

export async function retrieveRelevantDocuments(
  query: string,
  options: RetrievalOptions = {}
): Promise<{
  results: RetrievedDocument[];
  hasVerifiedDocuments: boolean;
  message?: string;
}> {
  const topK = options.topK || 3;
  const minSimilarity = options.minSimilarity !== undefined ? options.minSimilarity : 0.05;
  // Role-based document access control:
  // If no verified userRole is provided, default to 'CUSTOMER' (least privilege).
  // Never grant privileged ('STAFF' or 'ADMIN') access to unverified or missing roles.
  const userRole = (options.userRole && ['ADMIN', 'STAFF', 'CUSTOMER'].includes(options.userRole.toUpperCase()))
    ? options.userRole.toUpperCase()
    : 'CUSTOMER';

  // Determine active document corpus
  const activeDocs: KnowledgeDocument[] = [...VERIFIED_COMPANY_DOCUMENTS];

  // Demo fixtures are included ONLY when explicitly permitted (e.g. testing/scaffolding)
  if (options.includeDemoFixtures) {
    activeDocs.push(...DEMO_POLICY_FIXTURES);
  }

  // If no verified documents exist and demo fixtures are not permitted, return appropriate notice
  if (activeDocs.length === 0) {
    return {
      results: [],
      hasVerifiedDocuments: false,
      message: 'No verified policy document available. Official company policies have not yet been indexed.'
    };
  }

  const queryEmbedding = await generateEmbedding(query);
  const chunks = await getOrBuildEmbeddedChunks(activeDocs);

  const scored: RetrievedDocument[] = chunks
    .filter((chunk) => {
      // Role-based document access control
      if (userRole && !chunk.allowedRoles.includes(userRole)) {
        return false;
      }
      // Category filter
      if (options.category && chunk.category !== options.category) {
        return false;
      }
      return true;
    })
    .map((chunk) => {
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      return {
        id: chunk.id,
        documentId: chunk.documentId,
        title: chunk.title,
        section: chunk.section,
        category: chunk.category,
        content: chunk.content,
        similarity: Math.round(similarity * 1000) / 1000,
        citation: chunk.citation,
        source: chunk.isDemoFixture
          ? ('nonpersistent_development_store' as const)
          : ('verified_knowledge_store' as const),
        isDemoFixture: chunk.isDemoFixture,
        disclaimer: chunk.disclaimer
      };
    })
    .filter((doc) => doc.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return {
    results: scored,
    hasVerifiedDocuments: VERIFIED_COMPANY_DOCUMENTS.length > 0
  };
}
