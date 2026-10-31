import { describe, it, expect } from 'vitest';
import { verifyLiveGemini, verifyLiveHuggingFace, verifyLiveEmbedding, verifyAllLiveProviders } from '../src/utils/liveDiagnostics.js';
import { config } from '../src/config/index.js';

describe('Live LLM Provider Diagnostics & Verification [Gemini 3.8, HF, Embeddings]', () => {
  it('Gemini: accurately reports SKIPPED_NOT_CONFIGURED when GEMINI_API_KEY is not configured', async () => {
    if (!config.geminiApiKey || config.geminiApiKey.includes('your-gemini-api-key')) {
      const diag = await verifyLiveGemini();
      expect(diag.configured).toBe(false);
      expect(diag.status).toBe('SKIPPED_NOT_CONFIGURED');
      expect(diag.message).toContain('GEMINI_API_KEY is not configured');
    } else {
      const diag = await verifyLiveGemini(15000);
      expect(diag.configured).toBe(true);
      expect(['SUCCESS', 'FAILED']).toContain(diag.status);
      expect(diag.model).toBe(config.geminiModel);
    }
  });

  it('Hugging Face: accurately reports SKIPPED_NOT_CONFIGURED when token is not configured', async () => {
    if (!config.huggingFaceApiKey || config.huggingFaceApiKey.includes('your-huggingface-api-key')) {
      const diag = await verifyLiveHuggingFace();
      expect(diag.configured).toBe(false);
      expect(diag.status).toBe('SKIPPED_NOT_CONFIGURED');
      expect(diag.message).toContain('HUGGINGFACE_API_KEY');
    } else {
      const diag = await verifyLiveHuggingFace(15000);
      expect(diag.configured).toBe(true);
      expect(['SUCCESS', 'FAILED']).toContain(diag.status);
      expect(diag.model).toBe(config.huggingFaceModel);
    }
  });

  it('Gemini Embeddings: accurately reports SKIPPED_NOT_CONFIGURED when GEMINI_API_KEY is not configured', async () => {
    if (!config.geminiApiKey || config.geminiApiKey.includes('your-gemini-api-key')) {
      const diag = await verifyLiveEmbedding();
      expect(diag.configured).toBe(false);
      expect(diag.status).toBe('SKIPPED_NOT_CONFIGURED');
      expect(diag.message).toContain('GEMINI_API_KEY is not configured');
    } else {
      const diag = await verifyLiveEmbedding(15000);
      expect(diag.configured).toBe(true);
      expect(['SUCCESS', 'FAILED']).toContain(diag.status);
      expect(diag.model).toBe(config.geminiEmbeddingModel);
      if (diag.status === 'SUCCESS') {
        expect(diag.dimensions).toBe(768);
      }
    }
  });

  it('verifyAllLiveProviders: returns status for all 3 components without unhandled rejections', async () => {
    const results = await verifyAllLiveProviders();
    expect(results).toHaveProperty('gemini');
    expect(results).toHaveProperty('huggingFace');
    expect(results).toHaveProperty('embedding');
    expect(['SUCCESS', 'SKIPPED_NOT_CONFIGURED', 'FAILED']).toContain(results.gemini.status);
    expect(['SUCCESS', 'SKIPPED_NOT_CONFIGURED', 'FAILED']).toContain(results.huggingFace.status);
    expect(['SUCCESS', 'SKIPPED_NOT_CONFIGURED', 'FAILED']).toContain(results.embedding.status);
  });

  it('Model configuration matches supported production models', () => {
    expect(config.geminiModel).toBe('gemini-3.8-flash');
    expect(config.geminiEmbeddingModel).toBe('gemini-embedding-001');
    expect(config.huggingFaceModel).toBe('meta-llama/Llama-3.1-8B-Instruct');
  });

  it('Provider diagnostics never leak secret values in plain text outputs', async () => {
    const diagG = await verifyLiveGemini();
    const diagHF = await verifyLiveHuggingFace();
    const diagE = await verifyLiveEmbedding();

    const sensitivePatterns = ['AIzaSy', 'hf_'];
    for (const pattern of sensitivePatterns) {
      expect(diagG.message.includes(pattern)).toBe(false);
      expect(diagHF.message.includes(pattern)).toBe(false);
      expect(diagE.message.includes(pattern)).toBe(false);
    }
  });
});
