import { describe, it, expect, vi } from 'vitest';
import { processBillingQuery } from '../src/services/billingAssistant.js';
import { HuggingFaceFallbackClient } from '../src/fallback/huggingface.js';

describe('Billing Assistant End-to-End Orchestration & Fallback', () => {
  it('rejects unauthenticated requests when identity or token is not provided', async () => {
    await expect(processBillingQuery('What is the current MRR?')).rejects.toThrow(
      'Authentication required: Missing Authorization token'
    );
  });

  it('returns both reply and answer fields in scaffolding response for authenticated requests', async () => {
    const result = await processBillingQuery('What is the current MRR?', {
      identity: { userId: 'usr_staff_01', role: 'STAFF', isAuthenticated: true }
    });

    expect(result).toHaveProperty('reply');
    expect(result).toHaveProperty('answer');
    expect(result.reply).toBe(result.answer);
    expect(result.provider).toBe('scaffold');
    expect(result.reply).toContain('scaffolding mode');
  });

  it('preserves backend RBAC 403 errors and refuses to fallback to external models', async () => {
    const mockHandler = async () => ({
      status: 403,
      body: { success: false, message: 'Access denied: insufficient permissions' }
    });

    const mcpClient = new (await import('../src/mcp/client.js')).McpBillingClient('customer_jwt', mockHandler);
    const toolRes = await mcpClient.callTool('get_revenue_summary', {});

    expect(toolRes.isError).toBe(true);
    expect(toolRes.data.isAuthError).toBe(true);
    expect(toolRes.data.statusCode).toBe(403);
    await mcpClient.close();
  });

  it('triggers Hugging Face fallback with verified context on eligible Gemini provider failure', async () => {
    // Spy on HuggingFaceFallbackClient.generateResponse
    const hfSpy = vi.spyOn(HuggingFaceFallbackClient.prototype, 'generateResponse').mockResolvedValue({
      reply: 'According to authoritative backend records, customer cst_1 has an outstanding balance of 12000 cents EUR.',
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      provider: 'huggingface'
    });
    vi.spyOn(HuggingFaceFallbackClient.prototype, 'isConfigured').mockReturnValue(true);

    const mockHandler = async (url: string) => {
      if (url.includes('/auth/me')) {
        return {
          status: 200,
          body: { success: true, data: { id: 'usr_staff_01', role: 'STAFF', email: 'staff@brightloop.com' } }
        };
      }
      return {
        status: 200,
        body: { data: [{ id: 'cst_1', companyName: 'Acme Corp', currency: 'EUR' }] }
      };
    };

    const result = await processBillingQuery('What is Acme Corp balance?', {
      jwtToken: 'staff_jwt',
      mockHandler,
      forceGeminiFailure: true
    });

    expect(result.provider).toBe('huggingface');
    expect(result.reply).toContain('12000 cents EUR');
    expect(result.answer).toBe(result.reply);
    expect(hfSpy).toHaveBeenCalled();

    hfSpy.mockRestore();
  });

  it('returns clean error without fabricating records when both providers fail', async () => {
    vi.spyOn(HuggingFaceFallbackClient.prototype, 'isConfigured').mockReturnValue(true);
    vi.spyOn(HuggingFaceFallbackClient.prototype, 'generateResponse').mockRejectedValue(
      new Error('Hugging Face upstream 504 Gateway Timeout')
    );

    await expect(
      processBillingQuery('Show revenue numbers', {
        identity: { userId: 'usr_admin_01', role: 'ADMIN', isAuthenticated: true },
        forceGeminiFailure: true
      })
    ).rejects.toThrow(/Hugging Face/);
  });
});
