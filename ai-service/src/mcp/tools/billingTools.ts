/**
 * MCP Tools for Subscription Management System
 * Exposes core billing queries and operations to Gemini via Model Context Protocol
 */

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const billingTools: McpToolDefinition[] = [
  {
    name: 'get_customer_subscriptions',
    description: 'Retrieves active and past subscriptions for a given customer identifier or email.',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: {
          type: 'string',
          description: 'The unique customer ID (e.g., cst_12345)'
        },
        email: {
          type: 'string',
          description: 'Customer contact email address'
        }
      }
    }
  },
  {
    name: 'get_invoice_status',
    description: 'Fetches detailed status and breakdown of a specific invoice including paid and outstanding amounts.',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceNumber: {
          type: 'string',
          description: 'Invoice number (e.g., INV-2026-0001)'
        }
      },
      required: ['invoiceNumber']
    }
  },
  {
    name: 'calculate_plan_proration',
    description: 'Calculates the prorated credit or charge when switching between subscription tiers.',
    inputSchema: {
      type: 'object',
      properties: {
        currentPlanId: { type: 'string' },
        newPlanId: { type: 'string' },
        effectiveDate: { type: 'string', description: 'ISO date string' }
      },
      required: ['currentPlanId', 'newPlanId']
    }
  }
];

