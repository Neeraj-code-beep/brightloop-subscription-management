import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { billingTools } from './tools/billingTools.js';
import { BackendApiClient, BackendHttpError } from './backendClient.js';

export function createMcpServer(backendClient?: BackendApiClient) {
  const client = backendClient || new BackendApiClient();

  const server = new Server(
    {
      name: 'brightloop-billing-mcp',
      version: '1.1.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: billingTools
    };
  });

  // Execute tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = args || {};

    try {
      let result: any = null;

      switch (name) {
        case 'search_customer': {
          const query = String(toolArgs.query || '');
          const page = toolArgs.page !== undefined ? Number(toolArgs.page) : undefined;
          const limit = toolArgs.limit !== undefined ? Number(toolArgs.limit) : 10;
          const cursor = toolArgs.cursor !== undefined ? String(toolArgs.cursor) : undefined;
          result = await client.searchCustomers(query, { page, limit, cursor });
          break;
        }

        case 'get_customer_details': {
          const customerId = String(toolArgs.customerId || '');
          result = await client.getCustomerDetails(customerId);
          break;
        }

        case 'get_customer_subscriptions': {
          const customerId = String(toolArgs.customerId || '');
          const status = toolArgs.status ? String(toolArgs.status) : undefined;
          const page = toolArgs.page !== undefined ? Number(toolArgs.page) : undefined;
          const limit = toolArgs.limit !== undefined ? Number(toolArgs.limit) : 20;
          const cursor = toolArgs.cursor !== undefined ? String(toolArgs.cursor) : undefined;
          result = await client.getCustomerSubscriptions(customerId, { status, page, limit, cursor });
          break;
        }

        case 'get_customer_invoice_history': {
          const customerId = String(toolArgs.customerId || '');
          const status = toolArgs.status ? String(toolArgs.status) : undefined;
          const page = toolArgs.page !== undefined ? Number(toolArgs.page) : undefined;
          const limit = toolArgs.limit !== undefined ? Number(toolArgs.limit) : 20;
          const cursor = toolArgs.cursor !== undefined ? String(toolArgs.cursor) : undefined;
          result = await client.getCustomerInvoices(customerId, { status, page, limit, cursor });
          break;
        }

        case 'get_invoice_details': {
          const invoiceId = String(toolArgs.invoiceId || '');
          result = await client.getInvoiceDetails(invoiceId);
          break;
        }

        case 'get_customer_payment_history': {
          const customerId = String(toolArgs.customerId || '');
          const page = toolArgs.page !== undefined ? Number(toolArgs.page) : undefined;
          const limit = toolArgs.limit !== undefined ? Number(toolArgs.limit) : 20;
          const cursor = toolArgs.cursor !== undefined ? String(toolArgs.cursor) : undefined;
          result = await client.getCustomerPayments(customerId, { page, limit, cursor });
          break;
        }

        case 'get_customer_billing_summary': {
          const customerId = String(toolArgs.customerId || '');
          // Strictly delegate to authoritative backend-calculated summary
          result = await client.getCustomerBillingSummary(customerId);
          break;
        }

        case 'get_revenue_summary': {
          // Strictly delegate to authoritative backend-calculated metrics
          result = await client.getRevenueSummary();
          break;
        }

        case 'get_overdue_invoices': {
          // Strictly delegate to authoritative backend-calculated aging report
          result = await client.getOverdueInvoices();
          break;
        }

        default:
          throw new Error(`Unknown MCP tool requested: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (err: any) {
      const isAuth = err instanceof BackendHttpError && err.isAuthError;
      const statusCode = err instanceof BackendHttpError ? err.statusCode : 500;

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              tool: name,
              statusCode,
              isAuthError: isAuth,
              message: err.message || 'Error executing MCP billing tool',
              details: err.details
            })
          }
        ]
      };
    }
  });

  return server;
}
