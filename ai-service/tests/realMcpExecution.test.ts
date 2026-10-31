import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startMockBackendServer, MockServerInstance } from './helpers/mockBackendServer.js';
import { McpBillingClient } from '../src/mcp/client.js';
import { config } from '../src/config/index.js';

describe('Real MCP Execution Over HTTP Network Adapter [Task 3 & 4]', () => {
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

  it('1. MCP client successfully connects to MCP server in-memory', async () => {
    const client = new McpBillingClient('test_jwt_bearer_token');
    await client.ensureConnected();
    expect(client).toBeDefined();
    await client.close();
  });

  it('2. All nine tools are registered on the MCP server', async () => {
    const client = new McpBillingClient('test_jwt_bearer_token');
    const tools = await client.listTools();

    expect(tools.length).toBe(9);
    const names = tools.map((t) => t.name);
    expect(names).toContain('search_customer');
    expect(names).toContain('get_customer_details');
    expect(names).toContain('get_customer_subscriptions');
    expect(names).toContain('get_customer_invoice_history');
    expect(names).toContain('get_invoice_details');
    expect(names).toContain('get_customer_payment_history');
    expect(names).toContain('get_customer_billing_summary');
    expect(names).toContain('get_revenue_summary');
    expect(names).toContain('get_overdue_invoices');

    await client.close();
  });

  it('3. Tool execution calls real backend HTTP adapter and forwards original JWT', async () => {
    const testJwt = 'valid_bearer_token_rahul_user_123';
    const client = new McpBillingClient(testJwt);

    // Call search_customer over live HTTP
    const searchRes = await client.callTool('search_customer', { query: 'Rahul Sharma' });

    expect(searchRes.isError).toBe(false);
    expect(Array.isArray(searchRes.data)).toBe(true);
    expect(searchRes.data.length).toBe(1);
    expect(searchRes.data[0].contactName).toBe('Rahul Sharma');
    expect(searchRes.data[0].currency).toBe('INR');

    // Verify HTTP request was recorded with Authorization header
    const lastReq = mockServer.recordedRequests[mockServer.recordedRequests.length - 1];
    expect(lastReq.headers['authorization']).toBe(`Bearer ${testJwt}`);

    await client.close();
  });

  it('4. Tool get_customer_subscriptions fetches live subscription records for Rahul Sharma', async () => {
    const client = new McpBillingClient('valid_jwt');
    const res = await client.callTool('get_customer_subscriptions', { customerId: 'cst_rahul_01' });

    expect(res.isError).toBe(false);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBe(1);
    expect(res.data[0].id).toBe('sub_rahul_pro');
    expect(res.data[0].status).toBe('ACTIVE');
    expect(res.data[0].items[0].unitPriceInCents).toBe(4999);
    expect(res.data[0].currency).toBe('INR');

    await client.close();
  });

  it('5. Tool get_customer_invoice_history retrieves unpaid and paid invoices without recalculation', async () => {
    const client = new McpBillingClient('valid_jwt');
    const res = await client.callTool('get_customer_invoice_history', { customerId: 'cst_rahul_01' });

    expect(res.isError).toBe(false);
    expect(res.data.length).toBe(2);

    const paid = res.data.find((i: any) => i.status === 'PAID');
    const unpaid = res.data.find((i: any) => i.status === 'OPEN');

    expect(paid).toBeDefined();
    expect(paid.amountPaidInCents).toBe(4999);
    expect(paid.amountDueInCents).toBe(0);

    expect(unpaid).toBeDefined();
    expect(unpaid.amountDueInCents).toBe(4999);
    expect(unpaid.invoiceNumber).toBe('INV-2026-0102');

    await client.close();
  });

  it('6. Tool get_customer_payment_history retrieves payment details', async () => {
    const client = new McpBillingClient('valid_jwt');
    const res = await client.callTool('get_customer_payment_history', { customerId: 'cst_rahul_01' });

    expect(res.isError).toBe(false);
    expect(res.data.length).toBe(1);
    expect(res.data[0].id).toBe('pay_rahul_001');
    expect(res.data[0].amountInCents).toBe(4999);
    expect(res.data[0].status).toBe('SUCCEEDED');
    expect(res.data[0].currency).toBe('INR');

    await client.close();
  });

  it('7. Tool get_customer_billing_summary uses authoritative backend summary without recalculating', async () => {
    const client = new McpBillingClient('valid_jwt');
    const res = await client.callTool('get_customer_billing_summary', { customerId: 'cst_rahul_01' });

    expect(res.isError).toBe(false);
    expect(res.data.customerId).toBe('cst_rahul_01');
    expect(res.data.totalBilledInCents).toBe(9998); // Exact backend figure
    expect(res.data.totalPaidInCents).toBe(4999);   // Exact backend figure
    expect(res.data.totalOutstandingInCents).toBe(4999); // Exact backend figure
    expect(res.data.currency).toBe('INR'); // Preserves INR
    expect(res.data.overdueInvoicesCount).toBe(1);

    await client.close();
  });

  it('8. Tool get_overdue_invoices returns authoritative backend overdue aging', async () => {
    const client = new McpBillingClient('valid_jwt');
    const res = await client.callTool('get_overdue_invoices', {});

    expect(res.isError).toBe(false);
    expect(res.data.agingBuckets.days0To30InCents).toBe(4999);
    expect(res.data.agingBuckets.days31To60InCents).toBe(15000);
    expect(res.data.totalOverdueInCents).toBe(19999);
    expect(res.data.currency).toBe('INR');

    await client.close();
  });

  it('9. Preserves backend 401 Unauthorized errors over HTTP', async () => {
    const client = new McpBillingClient('invalid_or_expired_token');
    const res = await client.callTool('get_revenue_summary', {});

    expect(res.isError).toBe(true);
    expect(res.data.isAuthError).toBe(true);
    expect(res.data.statusCode).toBe(401);
    expect(res.data.message).toContain('Invalid or expired token');

    await client.close();
  });

  it('10. Preserves backend 403 Forbidden RBAC errors over HTTP', async () => {
    const client = new McpBillingClient('valid_jwt');
    const res = await client.callTool('get_customer_details', { customerId: 'cst_forbidden' });

    expect(res.isError).toBe(true);
    expect(res.data.isAuthError).toBe(true);
    expect(res.data.statusCode).toBe(403);
    expect(res.data.message).toContain('Access denied');

    await client.close();
  });

  it('11. Handles ambiguous customer queries over HTTP', async () => {
    const client = new McpBillingClient('valid_jwt');
    const res = await client.callTool('search_customer', { query: 'Rahul' });

    expect(res.isError).toBe(false);
    expect(res.data.length).toBe(2);
    expect(res.data.some((c: any) => c.contactName === 'Rahul Sharma')).toBe(true);
    expect(res.data.some((c: any) => c.contactName === 'Rahul Verma')).toBe(true);

    await client.close();
  });

  it('12. Handles missing customer records over HTTP', async () => {
    const client = new McpBillingClient('valid_jwt');
    const res = await client.callTool('search_customer', { query: 'nonexistent_person_xyz' });

    expect(res.isError).toBe(false);
    expect(res.data.length).toBe(0);

    await client.close();
  });
});
