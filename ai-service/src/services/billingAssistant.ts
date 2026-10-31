import { getGeminiClient } from '../gemini/client.js';
import { config } from '../config/index.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function processBillingQuery(prompt: string, conversationHistory: ChatMessage[] = []): Promise<string> {
  const client = getGeminiClient();
  if (!client) {
    return 'The AI Billing Assistant is currently in scaffolding mode. Please configure GEMINI_API_KEY in ai-service/.env to enable live responses.';
  }

  try {
    const response = await client.models.generateContent({
      model: config.geminiModel,
      contents: prompt,
    });
    return response.text || 'No response generated';
  } catch (error: any) {
    console.error('[BillingAssistant] Gemini error:', error.message);
    return `AI Assistant temporary error: ${error.message}`;
  }
}

