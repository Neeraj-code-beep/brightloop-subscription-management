import http from 'http';
import { AddressInfo } from 'net';

export interface RecordedRequest {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body?: any;
}

export interface MockServerInstance {
  server: http.Server;
  port: number;
  baseUrl: string;
  recordedRequests: RecordedRequest[];
  close: () => Promise<void>;
}

export const FIXTURE_RAHUL_CUSTOMER = {
  id: 'cst_rahul_01',
  companyName: 'Sharma Tech Enterprises',
  contactName: 'Rahul Sharma',
  email: 'rahul@sharma.in',
  currency: 'INR',
  status: 'ACTIVE' as const,
  billingAddress: {
    street: '12 Brigade Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'IN'
  },
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-10-31T00:00:00.000Z'
};

export const FIXTURE_RAHUL_VERMA = {
  id: 'cst_rahul_02',
  companyName: 'Verma Logistics',
  contactName: 'Rahul Verma',
  email: 'rahul@verma.com',
  currency: 'INR',
  status: 'ACTIVE' as const,
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-10-31T00:00:00.000Z'
};

export const FIXTURE_RAHUL_SUBSCRIPTIONS = [
  {
    id: 'sub_rahul_pro',
    customerId: 'cst_rahul_01',
    planId: 'plan_pro_monthly',
    status: 'ACTIVE' as const,
    currency: 'INR',
    price: '4999.00', // Decimal string
    currentPeriodStart: '2026-10-15T00:00:00.000Z',
    currentPeriodEnd: '2026-11-15T00:00:00.000Z',
    items: [
      {
        id: 'item_01',
        planId: 'plan_pro_monthly',
        quantity: 1,
        unitPrice: '4999.00',
        plan: {
          name: 'Pro Monthly Tier',
          billingInterval: 'MONTHLY'
        }
      }
    ]
  },
  {
    id: 'sub_rahul_storage',
    customerId: 'cst_rahul_01',
    planId: 'plan_addon_storage',
    status: 'ACTIVE' as const,
    currency: 'INR',
    price: '500.00',
    currentPeriodStart: '2026-10-15T00:00:00.000Z',
    currentPeriodEnd: '2026-11-15T00:00:00.000Z'
  }
];

export const FIXTURE_RAHUL_INVOICES = [
  {
    id: 'inv_rahul_101',
    invoiceNumber: 'INV-2026-0101',
    customerId: 'cst_rahul_01',
    status: 'PAID' as const,
    subtotal: '35000.00',
    total: '35000.00',
    amountPaid: '35000.00',
    amountDue: '0.00',
    currency: 'INR',
    dueDate: '2026-09-15T00:00:00.000Z',
    paidAt: '2026-09-14T10:00:00.000Z'
  },
  {
    id: 'inv_rahul_102',
    invoiceNumber: 'INV-2026-0102',
    customerId: 'cst_rahul_01',
    status: 'OPEN' as const,
    subtotal: '10000.00',
    total: '10000.00',
    amountPaid: '0.00',
    amountDue: '10000.00',
    currency: 'INR',
    dueDate: '2026-10-15T00:00:00.000Z' // Overdue
  }
];

export const FIXTURE_RAHUL_PAYMENTS = [
  {
    id: 'pay_rahul_001',
    invoiceId: 'inv_rahul_101',
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'IMPS_8849204',
    amount: '35000.00',
    currency: 'INR',
    status: 'SUCCEEDED' as const,
    paidAt: '2026-09-14T10:00:00.000Z',
    createdAt: '2026-09-14T10:00:00.000Z'
  }
];

// Neeraj's Authoritative Billing Summary contract using decimal strings
export const FIXTURE_AUTHORITATIVE_BILLING_SUMMARY = {
  customerId: 'cst_rahul_01',
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

export const FIXTURE_ANALYTICS_OVERDUE = {
  agingBuckets: {
    days0To30: '6000.00',
    days31To60: '4000.00',
    days61To90: '0.00',
    days90Plus: '0.00'
  },
  totalOverdue: '10000.00',
  overdueInvoicesCount: 2,
  currency: 'INR'
};

export function startMockBackendServer(): Promise<MockServerInstance> {
  return new Promise((resolve, reject) => {
    const recordedRequests: RecordedRequest[] = [];

    const server = http.createServer((req, res) => {
      let bodyText = '';
      req.on('data', (chunk) => {
        bodyText += chunk;
      });

      req.on('end', () => {
        let parsedBody: any = undefined;
        try {
          if (bodyText) parsedBody = JSON.parse(bodyText);
        } catch {
          parsedBody = bodyText;
        }

        recordedRequests.push({
          method: req.method || 'GET',
          url: req.url || '/',
          headers: req.headers,
          body: parsedBody
        });

        const url = new URL(req.url || '/', 'http://127.0.0.1');
        const pathname = url.pathname;
        const search = url.searchParams.get('search') || '';
        const cursor = url.searchParams.get('cursor');
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);

        // Security: Header Verification
        const authHeader = req.headers['authorization'];
        if (authHeader === 'Bearer invalid_or_expired_token') {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: false,
              message: 'Invalid or expired token',
              errors: []
            })
          );
        }

        if (pathname.includes('/customers/cst_forbidden')) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: false,
              message: 'Access denied: insufficient permissions',
              errors: []
            })
          );
        }

        // 1. GET /api/v1/customers (List & search)
        if (pathname === '/api/v1/customers') {
          if (search.toLowerCase().includes('rahul sharma')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(
              JSON.stringify({
                success: true,
                message: 'Customers retrieved successfully',
                data: {
                  items: [FIXTURE_RAHUL_CUSTOMER],
                  pagination: {
                    page: 1,
                    limit,
                    totalItems: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPrevPage: false
                  }
                }
              })
            );
          } else if (search.toLowerCase() === 'rahul') {
            // Ambiguous query
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(
              JSON.stringify({
                success: true,
                message: 'Multiple customers retrieved',
                data: {
                  items: [FIXTURE_RAHUL_CUSTOMER, FIXTURE_RAHUL_VERMA],
                  pagination: {
                    page: 1,
                    limit,
                    totalItems: 2,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPrevPage: false
                  }
                }
              })
            );
          } else if (cursor === 'cursor_page_1') {
            // Cursor pagination continuation page
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(
              JSON.stringify({
                success: true,
                message: 'Customers page 2 retrieved',
                data: {
                  items: [FIXTURE_RAHUL_VERMA],
                  pagination: {
                    limit,
                    hasNextPage: false,
                    hasPrevPage: true,
                    nextCursor: undefined,
                    previousCursor: 'cursor_page_1'
                  }
                }
              })
            );
          } else if (search.toLowerCase().includes('all') || search === '') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(
              JSON.stringify({
                success: true,
                message: 'Customers retrieved',
                data: {
                  items: [FIXTURE_RAHUL_CUSTOMER, FIXTURE_RAHUL_VERMA],
                  pagination: {
                    page,
                    limit,
                    totalItems: 2,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPrevPage: false,
                    nextCursor: 'cursor_page_1'
                  }
                }
              })
            );
          } else {
            // Missing record
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(
              JSON.stringify({
                success: true,
                message: 'No customers found',
                data: {
                  items: [],
                  pagination: { page: 1, limit, totalItems: 0, totalPages: 0 }
                }
              })
            );
          }
        }

        // 2. GET /api/v1/customers/:id
        if (pathname === '/api/v1/customers/cst_rahul_01') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: FIXTURE_RAHUL_CUSTOMER
            })
          );
        }

        // 3. GET /api/v1/customers/:id/subscriptions (Confirmed customer-scoped endpoint)
        if (pathname === '/api/v1/customers/cst_rahul_01/subscriptions') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: {
                items: FIXTURE_RAHUL_SUBSCRIPTIONS,
                pagination: {
                  page: 1,
                  limit,
                  totalItems: 2,
                  totalPages: 1,
                  hasNextPage: false,
                  hasPrevPage: false
                }
              }
            })
          );
        }

        // 4. GET /api/v1/customers/:id/invoices (Confirmed customer-scoped endpoint)
        if (pathname === '/api/v1/customers/cst_rahul_01/invoices') {
          const status = url.searchParams.get('status');
          let items = FIXTURE_RAHUL_INVOICES;
          if (status) {
            items = FIXTURE_RAHUL_INVOICES.filter((i) => i.status === status);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: {
                items,
                pagination: {
                  page: 1,
                  limit,
                  totalItems: items.length,
                  totalPages: 1,
                  hasNextPage: false,
                  hasPrevPage: false
                }
              }
            })
          );
        }

        // 5. GET /api/v1/customers/:id/payments (Confirmed customer-scoped endpoint)
        if (pathname === '/api/v1/customers/cst_rahul_01/payments') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: {
                items: FIXTURE_RAHUL_PAYMENTS,
                pagination: {
                  page: 1,
                  limit,
                  totalItems: 1,
                  totalPages: 1,
                  hasNextPage: false,
                  hasPrevPage: false
                }
              }
            })
          );
        }

        // 6. GET /api/v1/customers/:id/billing-summary (Authoritative summary)
        if (
          pathname === '/api/v1/customers/cst_rahul_01/billing-summary' ||
          pathname === '/api/v1/customers/cst_rahul_01/summary'
        ) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: FIXTURE_AUTHORITATIVE_BILLING_SUMMARY
            })
          );
        }

        // 7. GET /api/v1/invoices/:id
        if (pathname === '/api/v1/invoices/inv_rahul_102') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: FIXTURE_RAHUL_INVOICES[1]
            })
          );
        }

        // 8. Analytics endpoints
        if (pathname === '/api/v1/analytics/overdue') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: FIXTURE_ANALYTICS_OVERDUE
            })
          );
        }

        if (pathname === '/api/v1/analytics/summary' || pathname === '/api/v1/analytics/dashboard') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: {
                mrr: '450000.00',
                arr: '5400000.00',
                activeSubscriptions: 120,
                outstandingInvoicesCount: 15,
                totalOutstanding: '150000.00',
                currency: 'INR'
              }
            })
          );
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            success: false,
            message: `Resource not found at ${pathname}`
          })
        );
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      const port = address.port;
      const baseUrl = `http://127.0.0.1:${port}/api/v1`;

      resolve({
        server,
        port,
        baseUrl,
        recordedRequests,
        close: () =>
          new Promise<void>((resClose) => {
            server.close(() => resClose());
          })
      });
    });

    server.on('error', (err) => reject(err));
  });
}
