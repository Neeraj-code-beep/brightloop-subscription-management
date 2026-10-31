import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';

let genAIClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (!config.geminiApiKey) {
    console.warn('[Gemini Client] Warning: GEMINI_API_KEY is not configured.');
    return null;
  }

  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }

  return genAIClient;
}

