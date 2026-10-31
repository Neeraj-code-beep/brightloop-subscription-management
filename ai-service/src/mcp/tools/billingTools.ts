/**
 * MCP Tools for Subscription Management System (SMS)
 * Defines the Model Context Protocol tools for AI Assistant interactions.
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
    name: 'search_customer',
    description: 'Searches for customers by company name, contact name, or email address. Returns customer identifiers and status.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search string (e.g. Acme, billing@acme.com, John Doe)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of customer records to return (default 10)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_customer_details',
    description: 'Retrieves complete profile details for a specific customer, including company name, contact info, currency, and account status.',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: {
          type: 'string',
          description: 'The unique customer identifier (e.g., cst_12345)'
        }
      },
      required: ['customerId']
    }
  },
  {
    name: 'get_customer_subscriptions',
    description: 'Retrieves active, trialing, paused, or canceled subscription records for a given customer.',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: {
          type: 'string',
          description: 'The unique customer identifier'
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'TRIALING', 'PAST_DUE', 'PAUSED', 'CANCELED', 'EXPIRED'],
          description: 'Optional status filter'
        }
      },
      required: ['customerId']
    }
  },
  {
    name: 'get_customer_invoice_history',
    description: 'Fetches historical and pending invoices for a specific customer, including amounts, statuses, and due dates.',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: {
          type: 'string',
          description: 'The unique customer identifier'
        },
        status: {
          type: 'string',
          enum: ['DRAFT', 'OPEN', 'PAID', 'UNCOLLECTIBLE', 'VOID'],
          description: 'Optional invoice status filter'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of invoices to return'
        }
      },
      required: ['customerId']
    }
  },
  {
    name: 'get_invoice_details',
    description: 'Fetches comprehensive details for a single invoice, including line item breakdown, applied taxes, discounts, amount paid, and outstanding balance.',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'string',
          description: 'The unique invoice ID or invoice number (e.g. INV-2026-0001)'
        }
      },
      required: ['invoiceId']
    }
  },
  {
    name: 'get_customer_payment_history',
    description: 'Retrieves settled and attempted payment transactions for a customer, including payment method, transaction reference, amount, and status.',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: {
          type: 'string',
          description: 'The unique customer identifier'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of payment records to retrieve'
        }
      },
      required: ['customerId']
    }
  },
  {
    name: 'get_customer_billing_summary',
    description: 'Calculates an aggregated high-level billing summary for a customer, including active subscription counts, total outstanding dues, and open invoice counts.',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: {
          type: 'string',
          description: 'The unique customer identifier'
        }
      },
      required: ['customerId']
    }
  },
  {
    name: 'get_revenue_summary',
    description: 'Retrieves executive platform revenue metrics, including Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), and total active subscriptions.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_overdue_invoices',
    description: 'Retrieves company-wide overdue invoice aging analysis (0-30, 31-60, 61-90, 90+ days past due) and lists delinquent accounts.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];
