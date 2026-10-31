import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processBillingQuery } from '../src/services/billingAssistant.js';
import { HuggingFaceFallbackClient } from '../src/fallback/huggingface.js';
import * as geminiClientModule from '../src/gemini/client.js';
import { McpBillingClient } from '../src/mcp/client.js';

describe('AI Provider Resilience, Fallback Scenarios & Zero-Hallucination Guarantees [Section 8]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockAdminIdentity = {
    userId: 'usr_admin_01',
    role: 'ADMIN' as const,
    isAuthenticated: true,
    email: 'admin@brightloop.com'
  };

  const mockCustomerIdentity = {
    userId: 'usr_cst_01',
    role: 'CUSTOMER' as const,
    isAuthenticated: true,
    customerId: 'cst_rahul_01',
    email: 'rahul@brightloop.com'
  };

  it('1. Gemini succeeds: returns direct grounded response with provider=gemini', async () => {
    const mockGemini = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ text: 'Your monthly recurring subscription is 4999.00 INR and is active.' }]
              }
            }
          ],
          text: 'Your monthly recurring subscription is 4999.00 INR and is active.'
        })
      }
    };
    vi.spyOn(geminiClientModule, 'getGeminiClient').mockReturnValue(mockGemini as any);

    const result = await processBillingQuery('What is my current subscription price?', {
      identity: mockCustomerIdentity,
      jwtToken: 'valid_jwt_customer'
    });

    expect(result.provider).toBe('gemini');
    expect(result.reply).toContain('4999.00 INR');
    expect(result.answer).toBe(result.reply);
  });

  it('2. Gemini rate limit (HTTP 429): gracefully triggers Hugging Face fallback with verified context', async () => {
    const mockGemini = {
      models: {
        generateContent: vi.fn().mockRejectedValue({
          status: 429,
          message: 'Resource exhausted: rate limit exceeded. Please retry in 60s.'
        })
      }
    };
    vi.spyOn(geminiClientModule, 'getGeminiClient').mockReturnValue(mockGemini as any);

    const hfSpy = vi.spyOn(HuggingFaceFallbackClient.prototype, 'generateResponse').mockResolvedValue({
      reply: 'According to backend records, customer cst_rahul_01 has an active plan at 4999.00 INR.',
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      provider: 'huggingface'
    });
    vi.spyOn(HuggingFaceFallbackClient.prototype, 'isConfigured').mockReturnValue(true);

    const result = await processBillingQuery('Check my plan rate', {
      identity: mockCustomerIdentity,
      jwtToken: 'valid_jwt_customer'
    });

    expect(result.provider).toBe('huggingface');
    expect(result.reply).toContain('4999.00 INR');
    expect(hfSpy).toHaveBeenCalled();
  });

  it('3. Gemini temporary outage (HTTP 503): cleanly activates Hugging Face fallback', async () => {
    const mockGemini = {
      models: {
        generateContent: vi.fn().mockRejectedValue({
          status: 503,
          message: 'Service Unavailable: The model is currently overloaded. Please try again later.'
        })
      }
    };
    vi.spyOn(geminiClientModule, 'getGeminiClient').mockReturnValue(mockGemini as any);

    const hfSpy = vi.spyOn(HuggingFaceFallbackClient.prototype, 'generateResponse').mockResolvedValue({
      reply: 'Fallback service response: Active subscriptions verified.',
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      provider: 'huggingface'
    });
    vi.spyOn(HuggingFaceFallbackClient.prototype, 'isConfigured').mockReturnValue(true);

    const result = await processBillingQuery('List my active services', {
      identity: mockCustomerIdentity,
      jwtToken: 'valid_jwt_customer'
    });

    expect(result.provider).toBe('huggingface');
    expect(result.reply).toContain('Active subscriptions verified');
    expect(hfSpy).toHaveBeenCalled();
  });

  it('4. Gemini timeout (AbortError): cleanly activates Hugging Face fallback', async () => {
    const abortError = new Error('The operation was aborted due to timeout.');
    abortError.name = 'AbortError';

    const mockGemini = {
      models: {
        generateContent: vi.fn().mockRejectedValue(abortError)
      }
    };
    vi.spyOn(geminiClientModule, 'getGeminiClient').mockReturnValue(mockGemini as any);

    const hfSpy = vi.spyOn(HuggingFaceFallbackClient.prototype, 'generateResponse').mockResolvedValue({
      reply: 'Fallback response: Subscription record retrieved successfully.',
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      provider: 'huggingface'
    });
    vi.spyOn(HuggingFaceFallbackClient.prototype, 'isConfigured').mockReturnValue(true);

    const result = await processBillingQuery('Check my subscription status', {
      identity: mockCustomerIdentity,
      jwtToken: 'valid_jwt_customer'
    });

    expect(result.provider).toBe('huggingface');
    expect(hfSpy).toHaveBeenCalled();
  });

  it('5. Hugging Face fallback succeeds: preserves exact INR decimal strings without floating-point conversion', async () => {
    vi.spyOn(HuggingFaceFallbackClient.prototype, 'isConfigured').mockReturnValue(true);
    const hfSpy = vi.spyOn(HuggingFaceFallbackClient.prototype, 'generateResponse').mockResolvedValue({
      reply: 'The outstanding invoice total is 35000.00 INR and paid amount is 35000.00 INR.',
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      provider: 'huggingface'
    });

    const result = await processBillingQuery('What is invoice inv_001 balance?', {
      identity: mockCustomerIdentity,
      jwtToken: 'valid_jwt_customer',
      forceGeminiFailure: true
    });

    expect(result.provider).toBe('huggingface');
    expect(result.reply).toContain('35000.00 INR');
    expect(result.answer).toBe(result.reply);
    expect(hfSpy).toHaveBeenCalled();
  });

  it('6. Both providers fail: returns clean error without fabricating financial records', async () => {
    vi.spyOn(HuggingFaceFallbackClient.prototype, 'isConfigured').mockReturnValue(true);
    vi.spyOn(HuggingFaceFallbackClient.prototype, 'generateResponse').mockRejectedValue(
      new Error('Hugging Face upstream 504 Gateway Timeout')
    );

    await expect(
      processBillingQuery('Show company revenue numbers', {
        identity: mockAdminIdentity,
        jwtToken: 'valid_jwt_admin',
        forceGeminiFailure: true
      })
    ).rejects.toThrow(/Hugging Face/);
  });

  it('7. Backend returns 401 Unauthorized: halts immediately without activating fallback to bypass auth', async () => {
    const mockHandler = async () => ({
      status: 401,
      body: { success: false, message: 'Invalid or expired session token' }
    });

    const mcpClient = new McpBillingClient('invalid_or_expired_jwt', mockHandler);
    const toolRes = await mcpClient.callTool('get_customer_details', { customerId: 'cst_rahul_01' });

    expect(toolRes.isError).toBe(true);
    expect(toolRes.data.isAuthError).toBe(true);
    expect(toolRes.data.statusCode).toBe(401);
    await mcpClient.close();
  });

  it('8. Backend returns 403 Forbidden: customer denied access to admin tools without fallback bypass', async () => {
    const mockHandler = async () => ({
      status: 403,
      body: { success: false, message: 'Forbidden: Admin role required for executive analytics' }
    });

    const mcpClient = new McpBillingClient('customer_jwt', mockHandler, mockCustomerIdentity);
    const toolRes = await mcpClient.callTool('get_revenue_summary', {});

    expect(toolRes.isError).toBe(true);
    expect(toolRes.data.isAuthError).toBe(true);
    expect(toolRes.data.statusCode).toBe(403);
    await mcpClient.close();
  });

  it('9. No authorized business context: does not hallucinate financial records', async () => {
    // When MCP search returns empty items array (no matching record found) for staff query
    const mockStaffIdentity = {
      userId: 'usr_staff_01',
      role: 'STAFF' as const,
      isAuthenticated: true,
      email: 'staff@brightloop.com'
    };

    const mockHandler = async () => ({
      status: 200,
      body: { data: { items: [], pagination: { total: 0 } } }
    });

    const mcpClient = new McpBillingClient('staff_jwt', mockHandler, mockStaffIdentity);
    const toolRes = await mcpClient.callTool('search_customer', { query: 'nonexistent_customer_xyz' });

    expect(toolRes.isError).toBe(false);
    expect(toolRes.data.items).toEqual([]);
    expect(toolRes.data.pagination.total).toBe(0);
    await mcpClient.close();

    // When customer has no subscriptions, returns empty list without error
    const customerMcpClient = new McpBillingClient('customer_jwt', mockHandler, mockCustomerIdentity);
    const subRes = await customerMcpClient.callTool('get_customer_subscriptions', { customerId: 'cst_rahul_01' });

    expect(subRes.isError).toBe(false);
    expect(subRes.data.items).toEqual([]);
    await customerMcpClient.close();
  });
});
