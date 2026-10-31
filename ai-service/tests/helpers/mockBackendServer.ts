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
    city: 'Bengaluru',
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
    currentPeriodStart: '2026-10-15T00:00:00.000Z',
    currentPeriodEnd: '2026-11-15T00:00:00.000Z',
    items: [
      {
        id: 'item_01',
        planId: 'plan_pro_monthly',
        quantity: 1,
        unitPriceInCents: 4999,
        plan: {
          name: 'Pro Monthly Tier',
          billingInterval: 'MONTHLY'
        }
      }
    ]
  }
];

export const FIXTURE_RAHUL_INVOICES = [
  {
    id: 'inv_rahul_101',
    invoiceNumber: 'INV-2026-0101',
    customerId: 'cst_rahul_01',
    status: 'PAID' as const,
    subtotalInCents: 4999,
    taxInCents: 0,
    discountInCents: 0,
    totalInCents: 4999,
    amountPaidInCents: 4999,
    amountDueInCents: 0,
    currency: 'INR',
    dueDate: '2026-09-15T00:00:00.000Z',
    paidAt: '2026-09-14T10:00:00.000Z'
  },
  {
    id: 'inv_rahul_102',
    invoiceNumber: 'INV-2026-0102',
    customerId: 'cst_rahul_01',
    status: 'OPEN' as const,
    subtotalInCents: 4999,
    taxInCents: 0,
    discountInCents: 0,
    totalInCents: 4999,
    amountPaidInCents: 0,
    amountDueInCents: 4999,
    currency: 'INR',
    dueDate: '2026-10-15T00:00:00.000Z' // Overdue
  }
];

export const FIXTURE_RAHUL_PAYMENTS = [
  {
    id: 'pay_rahul_001',
    invoiceId: 'inv_rahul_101',
    paymentMethod: 'CREDIT_CARD',
    transactionReference: 'txn_razorpay_99482',
    amountInCents: 4999,
    currency: 'INR',
    status: 'SUCCEEDED' as const,
    paidAt: '2026-09-14T10:00:00.000Z',
    createdAt: '2026-09-14T10:00:00.000Z'
  }
];

export const FIXTURE_RAHUL_SUMMARY = {
  customerId: 'cst_rahul_01',
  companyName: 'Sharma Tech Enterprises',
  currency: 'INR',
  totalBilledInCents: 9998,
  totalPaidInCents: 4999,
  totalOutstandingInCents: 4999,
  activeSubscriptionsCount: 1,
  openInvoicesCount: 1,
  overdueInvoicesCount: 1
};

export const FIXTURE_ANALYTICS_OVERDUE = {
  agingBuckets: {
    days0To30InCents: 4999,
    days31To60InCents: 15000,
    days61To90InCents: 0,
    days90PlusInCents: 0
  },
  totalOverdueInCents: 19999,
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
        const customerIdParam = url.searchParams.get('customerId') || '';

        // Authentication Header Validation
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

        // Routing
        if (pathname === '/api/v1/customers') {
          if (search.toLowerCase().includes('rahul sharma')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(
              JSON.stringify({
                success: true,
                message: 'Customers retrieved successfully',
                data: {
                  items: [FIXTURE_RAHUL_CUSTOMER]
                }
              })
            );
          } else if (search.toLowerCase() === 'rahul') {
            // Ambiguous query
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(
              JSON.stringify({
                success: true,
                message: 'Customers retrieved successfully',
                data: {
                  items: [FIXTURE_RAHUL_CUSTOMER, FIXTURE_RAHUL_VERMA]
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
                  items: []
                }
              })
            );
          }
        }

        if (pathname === '/api/v1/customers/cst_rahul_01') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: FIXTURE_RAHUL_CUSTOMER
            })
          );
        }

        if (pathname === '/api/v1/customers/cst_rahul_01/summary') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: FIXTURE_RAHUL_SUMMARY
            })
          );
        }

        if (pathname === '/api/v1/subscriptions' && customerIdParam === 'cst_rahul_01') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: {
                items: FIXTURE_RAHUL_SUBSCRIPTIONS
              }
            })
          );
        }

        if (pathname === '/api/v1/invoices') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: {
                items: FIXTURE_RAHUL_INVOICES
              }
            })
          );
        }

        if (pathname === '/api/v1/invoices/inv_rahul_102') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: FIXTURE_RAHUL_INVOICES[1]
            })
          );
        }

        if (pathname === '/api/v1/payments' && customerIdParam === 'cst_rahul_01') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: {
                items: FIXTURE_RAHUL_PAYMENTS
              }
            })
          );
        }

        if (pathname === '/api/v1/analytics/overdue') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: FIXTURE_ANALYTICS_OVERDUE
            })
          );
        }

        if (pathname === '/api/v1/analytics/dashboard') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              data: {
                mrrInCents: 499900,
                arrInCents: 5998800,
                activeSubscriptions: 100,
                outstandingInvoicesCount: 15,
                totalOutstandingInCents: 74985,
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
