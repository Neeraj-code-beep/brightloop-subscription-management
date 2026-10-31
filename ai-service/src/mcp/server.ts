import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { billingTools } from './tools/billingTools.js';

export function createMcpServer() {
  const server = new Server(
    {
      name: 'brightloop-billing-mcp',
      version: '0.1.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // List available tools for Gemini agent
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: billingTools
    };
  });

  // Handle tool execution requests
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'get_customer_subscriptions':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ message: 'Customer subscriptions tool stub ready', data: [] })
            }
          ]
        };
      case 'get_invoice_status':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ message: `Invoice ${args?.invoiceNumber} status lookup ready` })
            }
          ]
        };
      case 'calculate_plan_proration':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ message: 'Proration calculation ready', proratedAmountInCents: 0 })
            }
          ]
        };
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}

