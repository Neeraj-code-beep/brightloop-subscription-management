import { getGeminiClient } from '../gemini/client.js';

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getGeminiClient();
  if (!client) {
    // Return empty mock embedding vector when API key is not yet set
    return new Array(768).fill(0);
  }

  // Ready for text-embedding-004 invocation
  return new Array(768).fill(0);
}

