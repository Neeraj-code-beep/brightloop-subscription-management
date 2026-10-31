import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';

let genAIClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (!config.geminiApiKey || config.geminiApiKey.includes('your-gemini-api-key')) {
    return null;
  }

  // Do not automatically run paid API requests during ordinary unit tests
  // unless live verification is explicitly enabled
  if (process.env.VITEST === 'true' && process.env.ENABLE_LIVE_API !== 'true' && process.env.LIVE_VERIFICATION !== 'true') {
    return null;
  }

  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }

  return genAIClient;
}

