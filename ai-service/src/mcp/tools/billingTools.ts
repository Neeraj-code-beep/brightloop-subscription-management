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
    description: 'Searches for customers by company name, contact name, or email address. Supports offset and cursor pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search string (e.g. Rahul Sharma, Acme, rahul@sharma.in)'
        },
        page: {
          type: 'number',
          description: '1-based page index for offset pagination'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of customer records per page (default 10)'
        },
        cursor: {
          type: 'string',
          description: 'Record ID cursor for cursor-based pagination'
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
          description: 'The unique customer identifier (e.g., cst_rahul_01)'
        }
      },
      required: ['customerId']
    }
  },
  {
    name: 'get_customer_subscriptions',
    description: 'Retrieves active, trialing, paused, or canceled subscription records for a given customer via customer-scoped endpoint.',
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
        },
        page: {
          type: 'number',
          description: 'Page number for offset pagination'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of subscriptions to return'
        },
        cursor: {
          type: 'string',
          description: 'Cursor token for pagination'
        }
      },
      required: ['customerId']
    }
  },
  {
    name: 'get_customer_invoice_history',
    description: 'Fetches historical and pending invoices for a specific customer with exact decimal string amounts, statuses, and due dates.',
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
        page: {
          type: 'number',
          description: 'Page number for offset pagination'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of invoices to return'
        },
        cursor: {
          type: 'string',
          description: 'Cursor token for pagination'
        }
      },
      required: ['customerId']
    }
  },
  {
    name: 'get_invoice_details',
    description: 'Fetches comprehensive details for a single invoice, including line item breakdown, applied taxes, discounts, amount paid, and outstanding balance as decimal strings.',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'string',
          description: 'The unique invoice ID or invoice number (e.g. INV-2026-0101)'
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
        page: {
          type: 'number',
          description: 'Page number for offset pagination'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of payment records to retrieve'
        },
        cursor: {
          type: 'string',
          description: 'Cursor token for pagination'
        }
      },
      required: ['customerId']
    }
  },
  {
    name: 'get_customer_billing_summary',
    description: 'Fetches the authoritative backend-calculated billing summary for a customer (totalSubscriptions, activeSubscriptions, totalInvoiced, totalPaid, totalOutstanding, totalOverdue) with exact decimal strings and currency.',
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
    description: 'Retrieves authoritative platform revenue metrics (MRR, ARR, active subscriptions, total outstanding) with exact backend decimal strings and currency.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_overdue_invoices',
    description: 'Retrieves authoritative company-wide overdue invoice aging analysis (0-30, 31-60, 61-90, 90+ days past due) with exact backend decimal strings.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];
