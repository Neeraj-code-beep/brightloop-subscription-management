import { getGeminiClient } from '../gemini/client.js';
import { config } from '../config/index.js';
import { McpBillingClient } from '../mcp/client.js';
import { BackendMockHandler } from '../mcp/backendClient.js';
import { HuggingFaceFallbackClient, FallbackContextItem } from '../fallback/huggingface.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ProcessBillingQueryOptions {
  jwtToken?: string;
  conversationHistory?: ChatMessage[];
  mockHandler?: BackendMockHandler;
  forceGeminiFailure?: boolean;
}

export interface BillingAssistantResult {
  reply: string;
  answer: string;
  toolsUsed: string[];
  provider: 'gemini' | 'huggingface' | 'scaffold';
}

const SYSTEM_INSTRUCTION =
  'You are SubPilot, an enterprise AI billing assistant for Brightloop Software Subscription Management System (SMS). ' +
  'You have direct access to authoritative billing tools through the Model Context Protocol (MCP). ' +
  'Always execute the appropriate tools to look up customer records, subscription statuses, invoice histories, and overdue balances before generating answers. ' +
  'STRICT FINANCIAL ACCURACY & FIDELITY RULES:\n' +
  '1. Authoritative Backend Values Only: Use ONLY the exact monetary amounts, currency codes, and financial values returned by the backend tools. Never recalculate, sum, estimate, or reconstruct financial totals, MRR, ARR, or balances independently.\n' +
  '2. Preserve Currency & Units: Output the exact currency code and units as returned by the backend. Do not assume USD or convert amounts unless the backend field explicitly identifies minor units (e.g., amountInCents). Always cite the currency provided in the record.\n' +
  '3. Unavailable Summaries: If a billing summary or financial metric is reported as unavailable or missing from the backend, inform the user clearly that the authoritative summary is currently unavailable from the billing service. Never fabricate substitute figures.\n' +
  '4. Customer Ambiguity: If a customer search returns multiple possible matches, present the candidates with their IDs and emails, and ask the user to clarify.\n' +
  '5. Missing Records: If no matching records exist, state clearly that the record was not found.\n' +
  '6. Security & RBAC: If a tool reports that access is forbidden or unauthorized (401/403), state clearly that the user permissions do not permit viewing that resource.';

export async function processBillingQuery(
  prompt: string,
  options: ProcessBillingQueryOptions = {}
): Promise<BillingAssistantResult> {
  const gemini = getGeminiClient();
  const hfClient = new HuggingFaceFallbackClient();

  // If neither provider is available or configured, return scaffolding message immediately
  if (!gemini && !options.forceGeminiFailure && !hfClient.isConfigured()) {
    const scaffoldMsg =
      'The AI Billing Assistant is currently in scaffolding mode. Please configure GEMINI_API_KEY or HUGGINGFACE_API_KEY in ai-service/.env to enable live responses.';
    return {
      reply: scaffoldMsg,
      answer: scaffoldMsg,
      toolsUsed: [],
      provider: 'scaffold'
    };
  }

  const mcpClient = new McpBillingClient(options.jwtToken, options.mockHandler);
  const verifiedContext: FallbackContextItem[] = [];
  const toolsUsed: string[] = [];

  try {
    // Check if Gemini is disabled or forced into failure
    if (!gemini || options.forceGeminiFailure) {
      if (hfClient.isConfigured()) {
        console.warn('[BillingAssistant] Gemini unavailable or simulated failure. Activating Hugging Face fallback.');
        const hfRes = await hfClient.generateResponse({
          prompt,
          verifiedContext,
          systemInstruction: SYSTEM_INSTRUCTION
        });
        return {
          reply: hfRes.reply,
          answer: hfRes.reply,
          toolsUsed,
          provider: 'huggingface'
        };
      }

      const scaffoldMsg =
        'The AI Billing Assistant is currently in scaffolding mode. Please configure GEMINI_API_KEY or HUGGINGFACE_API_KEY in ai-service/.env to enable live responses.';
      return {
        reply: scaffoldMsg,
        answer: scaffoldMsg,
        toolsUsed: [],
        provider: 'scaffold'
      };
    }

    // Retrieve tool declarations from MCP
    const mcpTools = await mcpClient.listTools();
    const functionDeclarations: any[] = mcpTools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema
    }));

    // Multi-turn tool execution loop (max 5 turns)
    const contents: any[] = [{ role: 'user', parts: [{ text: prompt }] }];
    let finalReply = '';

    for (let turn = 0; turn < 5; turn++) {
      let response: any;
      try {
        if (options.forceGeminiFailure) {
          throw new Error('Simulated Gemini provider outage (HTTP 503)');
        }

        response = await gemini.models.generateContent({
          model: config.geminiModel,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations }]
          }
        });
      } catch (geminiError: any) {
        console.error(`[BillingAssistant] Gemini API failure on turn ${turn}:`, geminiError.message);

        // Check if fallback is eligible: provider errors (timeout, 5xx, rate limits, network)
        if (hfClient.isConfigured()) {
          console.info('[BillingAssistant] Eligible provider error. Falling back to Hugging Face with verified context.');
          const fallbackRes = await hfClient.generateResponse({
            prompt,
            verifiedContext,
            systemInstruction: SYSTEM_INSTRUCTION
          });
          return {
            reply: fallbackRes.reply,
            answer: fallbackRes.reply,
            toolsUsed,
            provider: 'huggingface'
          };
        }

        throw new Error(
          `Primary provider (Gemini) failed: ${geminiError.message}. Fallback provider (Hugging Face) is unconfigured.`
        );
      }

      // Check if candidate requested function calls
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const functionCalls = parts.filter((p: any) => Boolean(p.functionCall));

      if (functionCalls.length === 0) {
        // No further tools needed, text response generated
        finalReply = response.text || 'No response text received from model';
        break;
      }

      // Append model turn with function calls
      contents.push(candidate.content);

      // Execute each tool call requested by Gemini
      for (const part of functionCalls) {
        const fc = part.functionCall;
        const toolName = fc.name;
        const toolArgs = fc.args || {};

        if (!toolsUsed.includes(toolName)) {
          toolsUsed.push(toolName);
        }

        const mcpResult = await mcpClient.callTool(toolName, toolArgs);
        verifiedContext.push({
          tool: toolName,
          args: toolArgs,
          result: mcpResult.data
        });

        // If backend returned authorization error (401/403), stop immediately and preserve RBAC
        if (mcpResult.data?.isAuthError === true || mcpResult.data?.statusCode === 401 || mcpResult.data?.statusCode === 403) {
          const deniedReply = `Access Denied: Your account does not have permission to access records for tool '${toolName}'. (${mcpResult.data?.message || 'Forbidden'})`;
          return {
            reply: deniedReply,
            answer: deniedReply,
            toolsUsed,
            provider: 'gemini'
          };
        }

        // Return tool output to Gemini as functionResponse
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: toolName,
                response: {
                  output: mcpResult.data
                }
              }
            }
          ]
        });
      }
    }

    const replyText = finalReply || 'Billing query completed.';
    return {
      reply: replyText,
      answer: replyText,
      toolsUsed,
      provider: 'gemini'
    };
  } finally {
    await mcpClient.close();
  }
}
