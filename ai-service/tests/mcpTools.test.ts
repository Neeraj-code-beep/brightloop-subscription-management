import { describe, it, expect } from 'vitest';
import { McpBillingClient } from '../src/mcp/client.js';
import { BackendApiClient, BackendHttpError } from '../src/mcp/backendClient.js';
import { billingTools } from '../src/mcp/tools/billingTools.js';

describe('MCP Billing Tools & Financial Integrity [Mocked Tests]', () => {
  it('registers all nine required MCP billing tools', () => {
    const toolNames = billingTools.map((t) => t.name);
    const expectedTools = [
      'search_customer',
      'get_customer_details',
      'get_customer_subscriptions',
      'get_customer_invoice_history',
      'get_invoice_details',
      'get_customer_payment_history',
      'get_customer_billing_summary',
      'get_revenue_summary',
      'get_overdue_invoices'
    ];

    expect(expectedTools.every((t) => toolNames.includes(t))).toBe(true);
    expect(billingTools.length).toBe(9);
  });

  it('forwards the original user JWT Bearer token on backend API requests', async () => {
    let capturedAuthHeader: string | undefined;

    const mockHandler = async (url: string, options: any) => {
      capturedAuthHeader = options.headers['Authorization'];
      return {
        status: 200,
        body: { success: true, data: { id: 'cst_test_1', companyName: 'Acme Test' } }
      };
    };

    const client = new BackendApiClient('jwt_sample_token_xyz123', mockHandler);
    await client.getCustomerDetails('cst_test_1');

    expect(capturedAuthHeader).toBe('Bearer jwt_sample_token_xyz123');
  });

  it('uses authoritative backend-calculated customer billing summary without recalculating', async () => {
    const authoritativeBackendSummary = {
      customerId: 'cst_01',
      currency: 'INR',
      summary: {
        totalSubscriptions: 3,
        activeSubscriptions: 2,
        totalInvoices: 12,
        paidInvoices: 9,
        unpaidInvoices: 2,
        overdueInvoices: 1,
        totalInvoiced: '45000.00',
        totalPaid: '35000.00',
        totalOutstanding: '10000.00',
        totalOverdue: '4000.00'
      }
    };

    const mockHandler = async (url: string) => {
      if (url.includes('summary')) {
        return {
          status: 200,
          body: { success: true, data: authoritativeBackendSummary }
        };
      }
      return { status: 404, body: { message: 'Not found' } };
    };

    const mcpClient = new McpBillingClient('test_jwt', mockHandler);
    const res = await mcpClient.callTool('get_customer_billing_summary', { customerId: 'cst_01' });

    expect(res.isError).toBe(false);
    expect(res.data.currency).toBe('INR');
    expect(res.data.summary.totalOutstanding).toBe('10000.00');
    expect(res.data.summary.totalInvoiced).toBe('45000.00');
    // Verifies the exact backend summary object was passed without alteration
    expect(res.data.summary.activeSubscriptions).toBe(2);
    await mcpClient.close();
  });

  it('returns unavailable response when backend billing summary endpoint is not implemented', async () => {
    const mockHandler = async (url: string) => {
      if (url.includes('summary')) {
        return { status: 404, body: { message: 'Summary endpoint not found' } };
      }
      // Customer profile without summary stats
      return {
        status: 200,
        body: {
          data: {
            id: 'cst_02',
            companyName: 'Beta LLC',
            currency: 'GBP',
            status: 'ACTIVE'
          }
        }
      };
    };

    const mcpClient = new McpBillingClient('test_jwt', mockHandler);
    const res = await mcpClient.callTool('get_customer_billing_summary', { customerId: 'cst_02' });

    expect(res.isError).toBe(false);
    expect(res.data.status).toBe('unavailable');
    expect(res.data.message).toContain('not calculated or available from backend');
    await mcpClient.close();
  });

  it('preserves exact backend financial figures in get_revenue_summary without modification', async () => {
    const mockHandler = async () => ({
      status: 200,
      body: {
        data: {
          mrr: '154200.00',
          arr: '1850400.00',
          activeSubscriptions: 42,
          outstandingInvoicesCount: 5,
          totalOutstanding: '8500.00',
          currency: 'INR'
        }
      }
    });

    const mcpClient = new McpBillingClient('test_jwt', mockHandler);
    const res = await mcpClient.callTool('get_revenue_summary', {});

    expect(res.isError).toBe(false);
    expect(res.data.mrr).toBe('154200.00');
    expect(res.data.currency).toBe('INR');
    await mcpClient.close();
  });

  it('preserves and propagates backend 401 Unauthorized errors', async () => {
    const mockHandler = async () => ({
      status: 401,
      body: { success: false, message: 'Invalid or expired token' }
    });

    const mcpClient = new McpBillingClient('expired_jwt', mockHandler);
    const res = await mcpClient.callTool('get_revenue_summary', {});

    expect(res.isError).toBe(true);
    expect(res.data.isAuthError).toBe(true);
    expect(res.data.statusCode).toBe(401);
    expect(res.data.message).toContain('Invalid or expired token');
    await mcpClient.close();
  });

  it('preserves and propagates backend 403 Forbidden RBAC errors', async () => {
    const mockHandler = async () => ({
      status: 403,
      body: { success: false, message: 'Access denied: insufficient permissions' }
    });

    const mcpClient = new McpBillingClient('customer_role_jwt', mockHandler);
    const res = await mcpClient.callTool('get_revenue_summary', {});

    expect(res.isError).toBe(true);
    expect(res.data.isAuthError).toBe(true);
    expect(res.data.statusCode).toBe(403);
    await mcpClient.close();
  });
});

describe('Live Backend Connection Handling [Live Network Test]', () => {
  it('handles live backend connection failures without crashing when backend is offline', async () => {
    // Real HTTP call without mockHandler targeting offline localhost port
    const liveClient = new BackendApiClient('test_jwt');
    await expect(liveClient.getCustomerDetails('cst_offline')).rejects.toThrow(BackendHttpError);
  });
});
