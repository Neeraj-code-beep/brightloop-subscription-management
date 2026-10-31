import pg from 'pg';
import { config } from '../config/index.js';
import { generateEmbedding } from '../embeddings/generator.js';

const { Pool } = pg;
let pool: pg.Pool | null = null;

export function getDbPool(): pg.Pool | null {
  if (!config.databaseUrl) {
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

export async function retrieveRelevantDocuments(query: string, topK: number = 3): Promise<any[]> {
  const db = getDbPool();
  if (!db) {
    return [];
  }

  // Future pgvector cosine similarity lookup:
  // SELECT id, content, 1 - (embedding <=> $1) AS similarity FROM knowledge_docs ORDER BY similarity DESC LIMIT $2
  return [];
}

