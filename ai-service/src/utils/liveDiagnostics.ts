import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../config/index.js';
import { HuggingFaceFallbackClient } from '../fallback/huggingface.js';
import { cosineSimilarity } from '../embeddings/generator.js';

export type DiagnosticErrorCategory =
  | 'AUTHENTICATION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'MODEL_NOT_FOUND_ERROR'
  | 'SERVICE_OUTAGE_ERROR'
  | 'AVAILABILITY_ERROR'
  | 'TIMEOUT_ERROR'
  | 'UNKNOWN_ERROR';

export interface ProviderDiagnosticResult {
  provider: 'gemini' | 'huggingface' | 'gemini-embedding';
  configured: boolean;
  model: string;
  status: 'SUCCESS' | 'SKIPPED_NOT_CONFIGURED' | 'FAILED';
  latencyMs?: number;
  message: string;
  dimensions?: number;
  functionCallingSupported?: boolean;
  errorCategory?: DiagnosticErrorCategory;
  details?: any;
}

function redactSecrets(text: string): string {
  if (!text) return '';
  let result = text;
  const secrets = [
    config.geminiApiKey,
    config.huggingFaceApiKey,
    process.env.GEMINI_API_KEY,
    process.env.HUGGINGFACE_API_KEY,
    process.env.HF_TOKEN
  ].filter((s): s is string => Boolean(s && s.trim().length > 4 && !s.includes('your-')));

  for (const secret of secrets) {
    result = result.split(secret).join('[REDACTED_SECRET]');
  }
  return result;
}

function classifyGeminiError(err: any): { category: DiagnosticErrorCategory; safeMessage: string } {
  const status = err.status || err.statusCode || (err.response && err.response.status);
  const rawMsg = redactSecrets(err.message || String(err));

  if (status === 401 || status === 403 || /api[ _-]?key|unauthenticated|permission_denied/i.test(rawMsg)) {
    return {
      category: 'AUTHENTICATION_ERROR',
      safeMessage: 'Authentication failed. Please check that GEMINI_API_KEY is valid.'
    };
  }
  if (status === 429 || /resource_exhausted|quota|rate limit/i.test(rawMsg)) {
    return {
      category: 'RATE_LIMIT_ERROR',
      safeMessage: 'Gemini API rate limit or quota exceeded (HTTP 429).'
    };
  }
  if (status === 404 || /not[ _-]?found/i.test(rawMsg)) {
    return {
      category: 'MODEL_NOT_FOUND_ERROR',
      safeMessage: `Gemini model '${config.geminiModel}' was not found or is unavailable.`
    };
  }
  if (status >= 500 || /unavailable|overloaded|outage|econnreset/i.test(rawMsg)) {
    return {
      category: 'SERVICE_OUTAGE_ERROR',
      safeMessage: 'Gemini service is temporarily unavailable or experiencing an outage (HTTP 5xx).'
    };
  }
  if (err.name === 'AbortError' || /timeout/i.test(rawMsg)) {
    return {
      category: 'TIMEOUT_ERROR',
      safeMessage: 'Gemini request timed out.'
    };
  }
  return {
    category: 'UNKNOWN_ERROR',
    safeMessage: rawMsg
  };
}

function classifyHuggingFaceError(err: any): { category: DiagnosticErrorCategory; safeMessage: string } {
  const rawMsg = redactSecrets(err.message || String(err));
  const statusMatch = rawMsg.match(/HTTP (\d+)|status (\d+)/i);
  const status = statusMatch ? parseInt(statusMatch[1] || statusMatch[2], 10) : err.status;

  if (status === 401 || status === 403 || /unauthorized|invalid credentials|invalid username or password|forbidden/i.test(rawMsg)) {
    return {
      category: 'AUTHENTICATION_ERROR',
      safeMessage: 'Authentication failed. Please verify that HUGGINGFACE_API_KEY / HF_TOKEN is valid.'
    };
  }
  if (status === 402 || status === 429 || /rate limit|too many requests|remaining credits|pre-paid credits/i.test(rawMsg)) {
    return {
      category: 'RATE_LIMIT_ERROR',
      safeMessage: 'Hugging Face account has no remaining inference credits or rate limit was reached (HTTP 402/429).'
    };
  }
  if (status === 404 || status === 503 || /model is loading|unavailable|not found/i.test(rawMsg)) {
    return {
      category: 'AVAILABILITY_ERROR',
      safeMessage: `Model '${config.huggingFaceModel}' is loading or unavailable on Hugging Face router.`
    };
  }
  if (err.name === 'AbortError' || /timeout/i.test(rawMsg)) {
    return {
      category: 'TIMEOUT_ERROR',
      safeMessage: 'Hugging Face request timed out.'
    };
  }
  return {
    category: 'UNKNOWN_ERROR',
    safeMessage: rawMsg
  };
}

export async function verifyLiveGemini(timeoutMs = 15000): Promise<ProviderDiagnosticResult> {
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

    // Step 1: Small real completion request
    const response = await client.models.generateContent({
      model: config.geminiModel,
      contents: 'Respond with exactly: PONG'
    });

    const replyText = response.text || '';

    // Step 2: Synthetic tool-calling test (safe, isolated function declaration)
    let functionCallingVerified = false;
    try {
      const syntheticTool = {
        functionDeclarations: [
          {
            name: 'get_system_time',
            description: 'Returns the current server time for a given timezone',
            parameters: {
              type: Type.OBJECT,
              properties: {
                timezone: {
                  type: Type.STRING,
                  description: 'The IANA timezone identifier, e.g. UTC, Asia/Kolkata'
                }
              },
              required: ['timezone']
            }
          }
        ]
      };

      const toolTestResponse = await client.models.generateContent({
        model: config.geminiModel,
        contents: 'What is the time in Asia/Kolkata? Call the get_system_time tool.',
        config: {
          tools: [syntheticTool]
        }
      });

      const parts = toolTestResponse.candidates?.[0]?.content?.parts || [];
      const called = parts.some((p: any) => p.functionCall?.name === 'get_system_time');
      functionCallingVerified = Boolean(called);
    } catch {
      // Function calling verification is non-fatal for basic connectivity
      functionCallingVerified = false;
    }

    const latencyMs = Date.now() - startTime;
    return {
      provider: 'gemini',
      configured: true,
      model: config.geminiModel,
      status: 'SUCCESS',
      latencyMs,
      functionCallingSupported: functionCallingVerified,
      message: `Gemini live verification succeeded in ${latencyMs}ms. Model '${config.geminiModel}' responded: "${replyText.trim()}". Function calling verified: ${functionCallingVerified ? 'YES' : 'PENDING'}.`
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const classified = classifyGeminiError(err);
    return {
      provider: 'gemini',
      configured: true,
      model: config.geminiModel,
      status: 'FAILED',
      latencyMs,
      errorCategory: classified.category,
      message: `Gemini live verification failed [${classified.category}]: ${classified.safeMessage}`,
      details: {
        errorName: err.name || 'Error'
      }
    };
  }
}

export async function verifyLiveHuggingFace(timeoutMs = 15000): Promise<ProviderDiagnosticResult> {
  const hfClient = new HuggingFaceFallbackClient();

  if (!hfClient.isConfigured(true)) {
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
    const classified = classifyHuggingFaceError(err);
    return {
      provider: 'huggingface',
      configured: true,
      model: config.huggingFaceModel,
      status: 'FAILED',
      latencyMs,
      errorCategory: classified.category,
      message: `Hugging Face live verification failed [${classified.category}]: ${classified.safeMessage}`,
      details: {
        cause: classified.safeMessage
      }
    };
  }
}

export async function verifyLiveEmbedding(timeoutMs = 15000): Promise<ProviderDiagnosticResult> {
  const apiKey = config.geminiApiKey;
  if (!apiKey || apiKey.trim().length === 0 || apiKey.includes('your-gemini-api-key')) {
    return {
      provider: 'gemini-embedding',
      configured: false,
      model: config.geminiEmbeddingModel,
      status: 'SKIPPED_NOT_CONFIGURED',
      message: 'GEMINI_API_KEY is not configured in ai-service environment. Live embedding test skipped.'
    };
  }

  const startTime = Date.now();
  try {
    const client = new GoogleGenAI({ apiKey });
    const sampleText = 'SubPilot AI enterprise subscription billing assistant diagnostic text';

    const response: any = await client.models.embedContent({
      model: config.geminiEmbeddingModel,
      contents: sampleText,
      config: {
        outputDimensionality: 768
      }
    });

    const values = response.embeddings?.[0]?.values || response.embedding?.values;
    if (!values || !Array.isArray(values)) {
      throw new Error(`Embedding response did not contain numerical values array. Response: ${JSON.stringify(response)}`);
    }

    if (values.length !== 768) {
      throw new Error(`Embedding vector dimension mismatch: expected 768, received ${values.length}`);
    }

    // Verify numeric validity
    const hasInvalid = values.some((v) => typeof v !== 'number' || isNaN(v) || !isFinite(v));
    if (hasInvalid) {
      throw new Error('Embedding contains invalid numeric values (NaN or Infinity).');
    }

    // Verify compatibility with in-memory store retrieval (cosine similarity)
    const testSimilarity = cosineSimilarity(values, values);
    if (Math.abs(testSimilarity - 1.0) > 0.001) {
      throw new Error(`Cosine similarity self-test failed: expected 1.0, got ${testSimilarity}`);
    }

    const latencyMs = Date.now() - startTime;
    return {
      provider: 'gemini-embedding',
      configured: true,
      model: config.geminiEmbeddingModel,
      status: 'SUCCESS',
      latencyMs,
      dimensions: values.length,
      message: `Gemini embeddings live verification succeeded in ${latencyMs}ms. Model '${config.geminiEmbeddingModel}' returned valid 768-dimensional vector (self-similarity: ${testSimilarity.toFixed(4)}).`
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const classified = classifyGeminiError(err);
    return {
      provider: 'gemini-embedding',
      configured: true,
      model: config.geminiEmbeddingModel,
      status: 'FAILED',
      latencyMs,
      errorCategory: classified.category,
      message: `Gemini embeddings live verification failed [${classified.category}]: ${classified.safeMessage}`,
      details: {
        errorName: err.name || 'Error'
      }
    };
  }
}

export async function verifyAllLiveProviders(): Promise<Record<string, ProviderDiagnosticResult>> {
  const [gemini, huggingFace, embedding] = await Promise.all([
    verifyLiveGemini(),
    verifyLiveHuggingFace(),
    verifyLiveEmbedding()
  ]);

  return {
    gemini,
    huggingFace,
    embedding
  };
}
