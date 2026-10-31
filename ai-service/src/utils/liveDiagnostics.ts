import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';
import { HuggingFaceFallbackClient } from '../fallback/huggingface.js';

export interface ProviderDiagnosticResult {
  provider: 'gemini' | 'huggingface';
  configured: boolean;
  model: string;
  status: 'SUCCESS' | 'SKIPPED_NOT_CONFIGURED' | 'FAILED';
  latencyMs?: number;
  message: string;
  details?: any;
}

export async function verifyLiveGemini(timeoutMs = 10000): Promise<ProviderDiagnosticResult> {
  const apiKey = config.geminiApiKey;
  if (!apiKey || apiKey.trim().length === 0 || apiKey.includes('your-gemini-api-key')) {
    return {
      provider: 'gemini',
      configured: false,
      model: config.geminiModel,
      status: 'SKIPPED_NOT_CONFIGURED',
      message: 'GEMINI_API_KEY is not configured in ai-service environment. Live provider call skipped.'
    };
  }

  const startTime = Date.now();
  try {
    const client = new GoogleGenAI({ apiKey });

    // Use AbortController for timeout handling
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await client.models.generateContent({
      model: config.geminiModel,
      contents: 'Respond with exactly: PONG'
    });
    clearTimeout(timer);

    const latencyMs = Date.now() - startTime;
    const text = response.text || '';

    return {
      provider: 'gemini',
      configured: true,
      model: config.geminiModel,
      status: 'SUCCESS',
      latencyMs,
      message: `Gemini API live verification succeeded in ${latencyMs}ms. Model '${config.geminiModel}' responded: "${text.trim()}".`
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      provider: 'gemini',
      configured: true,
      model: config.geminiModel,
      status: 'FAILED',
      latencyMs,
      message: `Gemini live verification failed: ${err.message}`,
      details: {
        errorName: err.name,
        code: err.code || err.status
      }
    };
  }
}

export async function verifyLiveHuggingFace(timeoutMs = 10000): Promise<ProviderDiagnosticResult> {
  const hfClient = new HuggingFaceFallbackClient();

  if (!hfClient.isConfigured()) {
    return {
      provider: 'huggingface',
      configured: false,
      model: config.huggingFaceModel,
      status: 'SKIPPED_NOT_CONFIGURED',
      message: 'HUGGINGFACE_API_KEY / HF_TOKEN is not configured in ai-service environment. Live provider call skipped.'
    };
  }

  const startTime = Date.now();
  try {
    const result = await hfClient.generateResponse({
      prompt: 'Respond with exactly: PONG',
      verifiedContext: []
    });

    const latencyMs = Date.now() - startTime;
    return {
      provider: 'huggingface',
      configured: true,
      model: result.model,
      status: 'SUCCESS',
      latencyMs,
      message: `Hugging Face live verification succeeded in ${latencyMs}ms. Model '${result.model}' responded: "${result.reply.trim().slice(0, 100)}".`
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      provider: 'huggingface',
      configured: true,
      model: config.huggingFaceModel,
      status: 'FAILED',
      latencyMs,
      message: `Hugging Face live verification failed: ${err.message}`,
      details: {
        cause: err.message
      }
    };
  }
}
