import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startMockBackendServer, MockServerInstance } from './helpers/mockBackendServer.js';
import { McpBillingClient } from '../src/mcp/client.js';
import { config } from '../src/config/index.js';

describe('Real MCP Execution Over Customer-Scoped HTTP APIs [v1 Contract Alignment]', () => {
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

  it('1. Connects to MCP server and lists all nine registered tools', async () => {
    const client = new McpBillingClient('jwt_token_1');
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

  it('2. Customer search supports offset pagination (?page=1&limit=2)', async () => {
    const client = new McpBillingClient('jwt_token_1');
    const res = await client.callTool('search_customer', { query: 'all', page: 1, limit: 2 });

    expect(res.isError).toBe(false);
    expect(res.data.items.length).toBe(2);
    expect(res.data.pagination.page).toBe(1);
    expect(res.data.pagination.limit).toBe(2);

    await client.close();
  });

  it('3. Customer search supports cursor pagination (?cursor=cursor_page_1)', async () => {
    const client = new McpBillingClient('jwt_token_1');
    const res = await client.callTool('search_customer', { cursor: 'cursor_page_1' });

    expect(res.isError).toBe(false);
    expect(res.data.items.length).toBe(1);
    expect(res.data.items[0].contactName).toBe('Rahul Verma');
    expect(res.data.pagination.hasPrevPage).toBe(true);

    await client.close();
  });

  it('4. Calls confirmed customer-scoped path /customers/:id/subscriptions', async () => {
    const testJwt = 'jwt_scope_customer_123';
    const client = new McpBillingClient(testJwt);
    const res = await client.callTool('get_customer_subscriptions', { customerId: 'cst_rahul_01' });

    expect(res.isError).toBe(false);
    expect(res.data.items.length).toBe(2);
    expect(res.data.items[0].id).toBe('sub_rahul_pro');
    expect(res.data.items[0].price).toBe('4999.00'); // Decimal string
    expect(res.data.items[0].currency).toBe('INR');

    // Verify HTTP request called /customers/cst_rahul_01/subscriptions
    const recorded = mockServer.recordedRequests.find((r) =>
      r.url.includes('/customers/cst_rahul_01/subscriptions')
    );
    expect(recorded).toBeDefined();
    expect(recorded?.headers['authorization']).toBe(`Bearer ${testJwt}`);

    await client.close();
  });

  it('5. Calls confirmed customer-scoped path /customers/:id/invoices with decimal string amounts', async () => {
    const client = new McpBillingClient('jwt_token_1');
    const res = await client.callTool('get_customer_invoice_history', { customerId: 'cst_rahul_01' });

    expect(res.isError).toBe(false);
    expect(res.data.items.length).toBe(2);

    const paidInv = res.data.items.find((i: any) => i.status === 'PAID');
    const openInv = res.data.items.find((i: any) => i.status === 'OPEN');

    // Decimal string assertions
    expect(paidInv.total).toBe('35000.00');
    expect(paidInv.amountPaid).toBe('35000.00');
    expect(paidInv.amountDue).toBe('0.00');
    expect(paidInv.currency).toBe('INR');

    expect(openInv.total).toBe('10000.00');
    expect(openInv.amountDue).toBe('10000.00');
    expect(openInv.amountPaid).toBe('0.00');
    expect(openInv.currency).toBe('INR');

    // Verify customer-scoped path was called
    const recorded = mockServer.recordedRequests.find((r) =>
      r.url.includes('/customers/cst_rahul_01/invoices')
    );
    expect(recorded).toBeDefined();

    await client.close();
  });

  it('6. Calls confirmed customer-scoped path /customers/:id/payments', async () => {
    const client = new McpBillingClient('jwt_token_1');
    const res = await client.callTool('get_customer_payment_history', { customerId: 'cst_rahul_01' });

    expect(res.isError).toBe(false);
    expect(res.data.items.length).toBe(1);
    expect(res.data.items[0].amount).toBe('35000.00'); // Decimal string
    expect(res.data.items[0].currency).toBe('INR');
    expect(res.data.items[0].status).toBe('SUCCEEDED');

    await client.close();
  });

  it('7. Retrieves authoritative nested billing summary with exact decimal strings', async () => {
    const client = new McpBillingClient('jwt_token_1');
    const res = await client.callTool('get_customer_billing_summary', { customerId: 'cst_rahul_01' });

    expect(res.isError).toBe(false);
    expect(res.data.customerId).toBe('cst_rahul_01');
    expect(res.data.currency).toBe('INR');

    // Exact backend summary fields as specified in contract
    const s = res.data.summary;
    expect(s.totalSubscriptions).toBe(3);
    expect(s.activeSubscriptions).toBe(2);
    expect(s.totalInvoices).toBe(12);
    expect(s.paidInvoices).toBe(9);
    expect(s.unpaidInvoices).toBe(2);
    expect(s.overdueInvoices).toBe(1);
    expect(s.totalInvoiced).toBe('45000.00');
    expect(s.totalPaid).toBe('35000.00');
    expect(s.totalOutstanding).toBe('10000.00');
    expect(s.totalOverdue).toBe('4000.00');

    await client.close();
  });

  it('8. Revenue summary returns authoritative backend decimal strings in INR', async () => {
    const client = new McpBillingClient('jwt_token_1');
    const res = await client.callTool('get_revenue_summary', {});

    expect(res.isError).toBe(false);
    expect(res.data.mrr).toBe('450000.00');
    expect(res.data.arr).toBe('5400000.00');
    expect(res.data.currency).toBe('INR');

    await client.close();
  });

  it('9. Overdue analytics returns authoritative decimal aging buckets in INR', async () => {
    const client = new McpBillingClient('jwt_token_1');
    const res = await client.callTool('get_overdue_invoices', {});

    expect(res.isError).toBe(false);
    expect(res.data.agingBuckets.days0To30).toBe('6000.00');
    expect(res.data.agingBuckets.days31To60).toBe('4000.00');
    expect(res.data.totalOverdue).toBe('10000.00');
    expect(res.data.currency).toBe('INR');

    await client.close();
  });

  it('10. Concurrent requests maintain strict JWT isolation without crosstalk', async () => {
    const clientUserA = new McpBillingClient('jwt_token_user_alice');
    const clientUserB = new McpBillingClient('jwt_token_user_bob');

    const [resA, resB] = await Promise.all([
      clientUserA.callTool('get_customer_details', { customerId: 'cst_rahul_01' }),
      clientUserB.callTool('get_customer_details', { customerId: 'cst_rahul_01' })
    ]);

    expect(resA.isError).toBe(false);
    expect(resB.isError).toBe(false);

    // Verify both JWTs were distinctly recorded on the mock backend
    const reqAlice = mockServer.recordedRequests.find(
      (r) => r.headers['authorization'] === 'Bearer jwt_token_user_alice'
    );
    const reqBob = mockServer.recordedRequests.find(
      (r) => r.headers['authorization'] === 'Bearer jwt_token_user_bob'
    );

    expect(reqAlice).toBeDefined();
    expect(reqBob).toBeDefined();

    await clientUserA.close();
    await clientUserB.close();
  });

  it('11. Preserves backend 401 Unauthorized status', async () => {
    const client = new McpBillingClient('invalid_or_expired_token');
    const res = await client.callTool('get_customer_details', { customerId: 'cst_rahul_01' });

    expect(res.isError).toBe(true);
    expect(res.data.statusCode).toBe(401);
    expect(res.data.isAuthError).toBe(true);

    await client.close();
  });

  it('12. Preserves backend 403 Forbidden RBAC status', async () => {
    const client = new McpBillingClient('jwt_token_staff');
    const res = await client.callTool('get_customer_details', { customerId: 'cst_forbidden' });

    expect(res.isError).toBe(true);
    expect(res.data.statusCode).toBe(403);
    expect(res.data.isAuthError).toBe(true);

    await client.close();
  });
});
