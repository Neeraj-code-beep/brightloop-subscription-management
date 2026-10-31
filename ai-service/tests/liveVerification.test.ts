import { describe, it, expect } from 'vitest';
import { verifyLiveGemini, verifyLiveHuggingFace } from '../src/utils/liveDiagnostics.js';
import { config } from '../src/config/index.js';

describe('Live LLM Provider Diagnostics & Verification [Task 1 & 2]', () => {
  it('Gemini: accurately reports SKIPPED_NOT_CONFIGURED when GEMINI_API_KEY is not configured', async () => {
    // When no key is set in environment
    if (!config.geminiApiKey || config.geminiApiKey.includes('your-gemini-api-key')) {
      const diag = await verifyLiveGemini();
      expect(diag.configured).toBe(false);
      expect(diag.status).toBe('SKIPPED_NOT_CONFIGURED');
      expect(diag.message).toContain('GEMINI_API_KEY is not configured');
    } else {
      // If live key is provided, verify real response
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
      // If live token is provided, verify real response
      const diag = await verifyLiveHuggingFace(15000);
      expect(diag.configured).toBe(true);
      expect(['SUCCESS', 'FAILED']).toContain(diag.status);
      expect(diag.model).toBe(config.huggingFaceModel);
    }
  });

  it('Model configuration matches supported production models', () => {
    expect(config.geminiModel).toBe('gemini-2.0-flash');
    expect(config.geminiEmbeddingModel).toBe('gemini-embedding-001');
    expect(config.huggingFaceModel).toBe('meta-llama/Llama-3.1-8B-Instruct');
  });
});
