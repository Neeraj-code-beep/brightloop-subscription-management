import { getGeminiClient } from '../gemini/client.js';
import { config } from '../config/index.js';

export async function generateEmbedding(text: string, dimensions = 768): Promise<number[]> {
  const client = getGeminiClient();

  if (client) {
    try {
      // Use currently supported Gemini embedding model (gemini-embedding-001)
      const response: any = await client.models.embedContent({
        model: config.geminiEmbeddingModel,
        contents: text,
        config: {
          outputDimensionality: dimensions
        }
      });

      const values = response.embeddings?.[0]?.values || response.embedding?.values;
      if (values && Array.isArray(values)) {
        return values;
      }
    } catch (err: any) {
      console.warn(
        `[Embeddings] Gemini embedding model (${config.geminiEmbeddingModel}) invocation failed, using normalized semantic vectorizer:`,
        err.message
      );
    }
  }

  // Deterministic normalized semantic projection vectorizer (768 dimensions)
  // Used during test suites, offline development, or when GEMINI_API_KEY is not configured
  return computeDeterministicVector(text, dimensions);
}

function computeDeterministicVector(text: string, dimensions = 768): number[] {
  const vector = new Array(dimensions).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);

  if (words.length === 0) {
    vector[0] = 1;
    return vector;
  }

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let c = 0; c < word.length; c++) {
      hash = (hash << 5) - hash + word.charCodeAt(c);
      hash |= 0;
    }

    const idx = Math.abs(hash) % dimensions;
    const secondaryIdx = Math.abs((hash * 31) ^ (i * 17)) % dimensions;

    vector[idx] += 1.0;
    vector[secondaryIdx] += 0.5;
  }

  // Apply L2 normalization
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] = vector[i] / norm;
    }
  }

  return vector;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
