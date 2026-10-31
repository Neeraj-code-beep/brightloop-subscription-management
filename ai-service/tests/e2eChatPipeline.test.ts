import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { config } from '../src/config/index.js';
import { startMockBackendServer, MockServerInstance } from './helpers/mockBackendServer.js';
import { HuggingFaceFallbackClient } from '../src/fallback/huggingface.js';
import * as geminiClientModule from '../src/gemini/client.js';

describe('Complete AI Chat Pipeline & Fallback Orchestration [Task 4 & 5]', () => {
  let mockServer: MockServerInstance;
  let originalBackendUrl: string;

  beforeAll(async () => {
    mockServer = await startMockBackendServer();
    originalBackendUrl = config.backendApiUrl;
    config.backendApiUrl = mockServer.baseUrl;
  });

  afterAll(async () => {
    config.backendApiUrl = originalBackendUrl;
    await mockServer.close();
  });

  it('1. Chat flow: "Show Rahul Sharma subscriptions" runs MCP tool and grounds response on backend data', async () => {
    // Mock Gemini client to simulate function call -> tool execution -> final grounded answer
    const mockGemini = {
      models: {
        generateContent: vi
          .fn()
          // Turn 1: Gemini decides to call get_customer_subscriptions
          .mockResolvedValueOnce({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'get_customer_subscriptions',
                        args: { customerId: 'cst_rahul_01' }
                      }
                    }
                  ]
                }
              }
            ]
          })
          // Turn 2: Gemini consumes verified subscription data and returns grounded text
          .mockResolvedValueOnce({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: 'Rahul Sharma has 1 active subscription: Pro Monthly Tier (sub_rahul_pro) at 4999.00 INR per month, valid until November 15, 2026.' }]
                }
              }
            ],
            text: 'Rahul Sharma has 1 active subscription: Pro Monthly Tier (sub_rahul_pro) at 4999.00 INR per month, valid until November 15, 2026.'
          })
      }
    };

    const clientSpy = vi.spyOn(geminiClientModule, 'getGeminiClient').mockReturnValue(mockGemini as any);

    const res = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', 'Bearer valid_user_jwt')
      .send({ prompt: "Show Rahul Sharma's subscriptions." });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reply).toContain('Pro Monthly Tier');
    expect(res.body.data.reply).toContain('4999.00 INR');
    expect(res.body.data.toolsUsed).toContain('get_customer_subscriptions');
    expect(res.body.data.provider).toBe('gemini');
    expect(res.body.data.answer).toBe(res.body.data.reply);

    clientSpy.mockRestore();
  });

  it('2. Chat flow: "How much has Rahul been billed and paid?" preserves exact backend figures and currency', async () => {
    const mockGemini = {
      models: {
        generateContent: vi
          .fn()
          .mockResolvedValueOnce({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'get_customer_billing_summary',
                        args: { customerId: 'cst_rahul_01' }
                      }
                    }
                  ]
                }
              }
            ]
          })
          .mockResolvedValueOnce({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: 'According to authoritative backend records, Rahul Sharma has been invoiced a total of 45000.00 INR, paid 35000.00 INR, and has an outstanding balance of 10000.00 INR.' }]
                }
              }
            ],
            text: 'According to authoritative backend records, Rahul Sharma has been invoiced a total of 45000.00 INR, paid 35000.00 INR, and has an outstanding balance of 10000.00 INR.'
          })
      }
    };

    const clientSpy = vi.spyOn(geminiClientModule, 'getGeminiClient').mockReturnValue(mockGemini as any);

    const res = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', 'Bearer valid_user_jwt')
      .send({ prompt: 'How much has Rahul been billed and paid?' });

    expect(res.status).toBe(200);
    expect(res.body.data.reply).toContain('45000.00 INR');
    expect(res.body.data.reply).toContain('35000.00 INR');
    expect(res.body.data.reply).toContain('10000.00 INR');
    expect(res.body.data.toolsUsed).toContain('get_customer_billing_summary');

    clientSpy.mockRestore();
  });

  it('3. Chat flow: "Show his unpaid invoices" retrieves and presents open invoice INV-2026-0102', async () => {
    const mockGemini = {
      models: {
        generateContent: vi
          .fn()
          .mockResolvedValueOnce({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'get_customer_invoice_history',
                        args: { customerId: 'cst_rahul_01', status: 'OPEN' }
                      }
                    }
                  ]
                }
              }
            ]
          })
          .mockResolvedValueOnce({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: 'Rahul Sharma has 1 unpaid invoice: INV-2026-0102 for 10000.00 INR, due on October 15, 2026.' }]
                }
              }
            ],
            text: 'Rahul Sharma has 1 unpaid invoice: INV-2026-0102 for 10000.00 INR, due on October 15, 2026.'
          })
      }
    };

    const clientSpy = vi.spyOn(geminiClientModule, 'getGeminiClient').mockReturnValue(mockGemini as any);

    const res = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', 'Bearer valid_user_jwt')
      .send({ prompt: 'Show his unpaid invoices.' });

    expect(res.status).toBe(200);
    expect(res.body.data.reply).toContain('INV-2026-0102');
    expect(res.body.data.reply).toContain('10000.00 INR');

    clientSpy.mockRestore();
  });

  it('4. Chat flow: Handles customer ambiguity when searching "Rahul"', async () => {
    const mockGemini = {
      models: {
        generateContent: vi
          .fn()
          .mockResolvedValueOnce({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'search_customer',
                        args: { query: 'Rahul' }
                      }
                    }
                  ]
                }
              }
            ]
          })
          .mockResolvedValueOnce({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: 'Multiple customers matched "Rahul": 1) Rahul Sharma (cst_rahul_01, rahul@sharma.in) 2) Rahul Verma (cst_rahul_02, rahul@verma.com). Please specify which customer you are inquiring about.' }]
                }
              }
            ],
            text: 'Multiple customers matched "Rahul": 1) Rahul Sharma (cst_rahul_01, rahul@sharma.in) 2) Rahul Verma (cst_rahul_02, rahul@verma.com). Please specify which customer you are inquiring about.'
          })
      }
    };

    const clientSpy = vi.spyOn(geminiClientModule, 'getGeminiClient').mockReturnValue(mockGemini as any);

    const res = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', 'Bearer valid_staff_jwt')
      .send({ prompt: 'Show Rahul balance.' });

    expect(res.status).toBe(200);
    expect(res.body.data.reply).toContain('cst_rahul_01');
    expect(res.body.data.reply).toContain('cst_rahul_02');

    clientSpy.mockRestore();
  });

  it('5. Chat flow: Handles missing customer records without hallucination', async () => {
    const mockGemini = {
      models: {
        generateContent: vi
          .fn()
          .mockResolvedValueOnce({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'search_customer',
                        args: { query: 'nonexistent_customer' }
                      }
                    }
                  ]
                }
              }
            ]
          })
          .mockResolvedValueOnce({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: 'No customer record found matching "nonexistent_customer" in the database.' }]
                }
              }
            ],
            text: 'No customer record found matching "nonexistent_customer" in the database.'
          })
      }
    };

    const clientSpy = vi.spyOn(geminiClientModule, 'getGeminiClient').mockReturnValue(mockGemini as any);

    const res = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', 'Bearer valid_staff_jwt')
      .send({ prompt: 'Find nonexistent_customer.' });

    expect(res.status).toBe(200);
    expect(res.body.data.reply).toContain('No customer record found');

    clientSpy.mockRestore();
  });

  it('6. Fallback flow: Hugging Face activates with verified context when Gemini fails with 503 outage', async () => {
    // Mock Gemini throwing provider 503 after first tool call
    let callCount = 0;
    const mockGemini = {
      models: {
        generateContent: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            return {
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [
                      {
                        functionCall: {
                          name: 'get_customer_billing_summary',
                          args: { customerId: 'cst_rahul_01' }
                        }
                      }
                    ]
                  }
                }
              ]
            };
          }
          // Turn 2: Gemini experiences provider 503 outage
          throw new Error('Gemini API Service Unavailable (HTTP 503)');
        })
      }
    };

    // Hugging Face fallback spy
    const hfSpy = vi.spyOn(HuggingFaceFallbackClient.prototype, 'generateResponse').mockImplementation(async (params) => {
      // Verify that Hugging Face receives the verified context already collected from the mock backend
      expect(params.verifiedContext.length).toBeGreaterThan(0);
      expect(params.verifiedContext[0].tool).toBe('get_customer_billing_summary');
      expect(params.verifiedContext[0].result.summary.totalOutstanding).toBe('10000.00');

      return {
        reply: 'Fallback Response: According to verified backend records, Rahul Sharma has an outstanding balance of 10000.00 INR.',
        model: 'meta-llama/Llama-3.1-8B-Instruct',
        provider: 'huggingface'
      };
    });
    vi.spyOn(HuggingFaceFallbackClient.prototype, 'isConfigured').mockReturnValue(true);

    const clientSpy = vi.spyOn(geminiClientModule, 'getGeminiClient').mockReturnValue(mockGemini as any);

    const res = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', 'Bearer valid_user_jwt')
      .send({ prompt: 'What is Rahul Sharma outstanding balance?' });

    expect(res.status).toBe(200);
    expect(res.body.data.provider).toBe('huggingface');
    expect(res.body.data.reply).toContain('10000.00 INR');
    expect(hfSpy).toHaveBeenCalled();

    clientSpy.mockRestore();
    hfSpy.mockRestore();
  });

  it('7. RBAC safety: 403 Forbidden does NOT trigger Hugging Face fallback', async () => {
    const mockGemini = {
      models: {
        generateContent: vi.fn().mockResolvedValueOnce({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  {
                    functionCall: {
                      name: 'get_customer_details',
                      args: { customerId: 'cst_forbidden' }
                    }
                  }
                ]
              }
            }
          ]
        })
      }
    };

    const hfSpy = vi.spyOn(HuggingFaceFallbackClient.prototype, 'generateResponse');
    const clientSpy = vi.spyOn(geminiClientModule, 'getGeminiClient').mockReturnValue(mockGemini as any);

    const res = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', 'Bearer valid_user_jwt')
      .send({ prompt: 'View forbidden customer cst_forbidden.' });

    expect(res.status).toBe(200);
    expect(res.body.data.reply).toContain('Access Denied');
    expect(res.body.data.reply).toContain('does not have permission');
    // Crucial: Fallback was NOT triggered on authorization denial!
    expect(hfSpy).not.toHaveBeenCalled();

    clientSpy.mockRestore();
    hfSpy.mockRestore();
  });
});
