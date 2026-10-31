import { config } from '../config/index.js';

export interface BackendCustomer {
  id: string;
  userId?: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  currency?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  billingAddress?: any;
  billingSummary?: any;
  summaryStats?: any;
  createdAt: string;
  updatedAt: string;
}

export interface BackendSubscription {
  id: string;
  customerId: string;
  planId?: string;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'PAUSED' | 'CANCELED' | 'EXPIRED';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  currency?: string;
  items?: Array<{
    id: string;
    planId: string;
    quantity: number;
    unitPriceInCents: number;
    plan?: { name: string; billingInterval: string };
  }>;
}

export interface BackendInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  subscriptionId?: string;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'UNCOLLECTIBLE' | 'VOID';
  subtotalInCents: number;
  taxInCents: number;
  discountInCents: number;
  totalInCents: number;
  amountPaidInCents: number;
  amountDueInCents: number;
  currency?: string;
  dueDate: string;
  paidAt?: string;
  items?: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPriceInCents: number;
    totalInCents: number;
  }>;
}

export interface BackendPayment {
  id: string;
  invoiceId: string;
  paymentMethod: string;
  transactionReference?: string;
  amountInCents: number;
  currency?: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  paidAt?: string;
  createdAt: string;
}

export interface BackendAnalyticsDashboard {
  mrrInCents: number;
  arrInCents: number;
  activeSubscriptions: number;
  outstandingInvoicesCount: number;
  totalOutstandingInCents: number;
  currency?: string;
}

export interface BackendAnalyticsOverdue {
  agingBuckets: {
    days0To30InCents: number;
    days31To60InCents: number;
    days61To90InCents: number;
    days90PlusInCents: number;
  };
  totalOverdueInCents: number;
  overdueInvoicesCount: number;
  currency?: string;
}

export class BackendHttpError extends Error {
  public statusCode: number;
  public details?: any;
  public isAuthError: boolean;

  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.name = 'BackendHttpError';
    this.statusCode = statusCode;
    this.details = details;
    this.isAuthError = statusCode === 401 || statusCode === 403;
  }
}

export type BackendMockHandler = (url: string, options: { method: string; headers: Record<string, string> }) => Promise<{ status: number; body: any }>;

export class BackendApiClient {
  private baseUrl: string;
  private jwtToken?: string;
  private mockHandler?: BackendMockHandler;

  constructor(jwtToken?: string, mockHandler?: BackendMockHandler) {
    this.baseUrl = config.backendApiUrl.replace(/\/+$/, '');
    this.jwtToken = jwtToken;

    // Safety constraint: mock handlers are strictly prohibited in production
    if (mockHandler) {
      if (config.nodeEnv === 'production') {
        throw new Error('Fatal Security Violation: Mock fixtures cannot be attached in production mode.');
      }
      this.mockHandler = mockHandler;
    }
  }

  private cleanToken(token?: string): string | undefined {
    if (!token) return undefined;
    return token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  }

  private async request<T>(endpoint: string, options: { method?: string; query?: Record<string, any> } = {}): Promise<T> {
    const method = options.method || 'GET';
    const cleanJwt = this.cleanToken(this.jwtToken);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (cleanJwt) {
      headers['Authorization'] = `Bearer ${cleanJwt}`;
    }

    const urlObj = new URL(`${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null && value !== '') {
          urlObj.searchParams.append(key, String(value));
        }
      }
    }

    const fullUrl = urlObj.toString();

    // Isolated Mock Adapter for testing only
    if (this.mockHandler && config.nodeEnv !== 'production') {
      const mockRes = await this.mockHandler(fullUrl, { method, headers });
      if (mockRes.status >= 400) {
        throw new BackendHttpError(
          mockRes.body?.message || `Backend returned status ${mockRes.status}`,
          mockRes.status,
          mockRes.body?.errors || mockRes.body
        );
      }
      return mockRes.body?.data !== undefined ? mockRes.body.data : mockRes.body;
    }

    // Real HTTP call via native fetch
    try {
      const response = await fetch(fullUrl, {
        method,
        headers
      });

      let jsonBody: any = null;
      const text = await response.text();
      try {
        jsonBody = JSON.parse(text);
      } catch {
        jsonBody = { message: text };
      }

      if (!response.ok) {
        const errorMsg = jsonBody?.message || `Backend HTTP error ${response.status}: ${response.statusText}`;
        throw new BackendHttpError(errorMsg, response.status, jsonBody?.errors || jsonBody);
      }

      // Extract envelope standard if present
      if (jsonBody && typeof jsonBody === 'object' && 'data' in jsonBody) {
        return jsonBody.data as T;
      }

      return jsonBody as T;
    } catch (err: any) {
      if (err instanceof BackendHttpError) {
        throw err;
      }
      throw new BackendHttpError(
        `Failed to communicate with backend service at ${fullUrl}: ${err.message}`,
        503,
        { cause: err.message }
      );
    }
  }

  // 1. Search customers
  async searchCustomers(query: string, limit = 10): Promise<BackendCustomer[]> {
    const data = await this.request<{ items?: BackendCustomer[] } | BackendCustomer[]>('/customers', {
      query: { search: query, limit }
    });
    if (Array.isArray(data)) return data;
    return data?.items || [];
  }

  // 2. Get customer details
  async getCustomerDetails(customerId: string): Promise<BackendCustomer> {
    return this.request<BackendCustomer>(`/customers/${encodeURIComponent(customerId)}`);
  }

  // 3. Get customer subscriptions
  async getCustomerSubscriptions(customerId: string, status?: string): Promise<BackendSubscription[]> {
    const data = await this.request<{ items?: BackendSubscription[] } | BackendSubscription[]>('/subscriptions', {
      query: { customerId, status }
    });
    if (Array.isArray(data)) return data;
    return data?.items || [];
  }

  // 4. Get customer invoice history
  async getCustomerInvoices(customerId: string, status?: string, limit = 20): Promise<BackendInvoice[]> {
    const data = await this.request<{ items?: BackendInvoice[] } | BackendInvoice[]>('/invoices', {
      query: { customerId, status, limit }
    });
    if (Array.isArray(data)) return data;
    return data?.items || [];
  }

  // 5. Get invoice details
  async getInvoiceDetails(invoiceId: string): Promise<BackendInvoice> {
    return this.request<BackendInvoice>(`/invoices/${encodeURIComponent(invoiceId)}`);
  }

  // 6. Get customer payment history
  async getCustomerPayments(customerId: string, limit = 20): Promise<BackendPayment[]> {
    const data = await this.request<{ items?: BackendPayment[] } | BackendPayment[]>('/payments', {
      query: { customerId, limit }
    });
    if (Array.isArray(data)) return data;
    return data?.items || [];
  }

  // 7. Get authoritative customer billing summary directly from backend
  async getCustomerBillingSummary(customerId: string): Promise<any> {
    try {
      // Attempt backend dedicated summary endpoint
      const summary = await this.request<any>(`/customers/${encodeURIComponent(customerId)}/summary`);
      return summary;
    } catch (err: any) {
      if (err instanceof BackendHttpError && err.isAuthError) {
        throw err;
      }
      // If /customers/:id/summary not present, check /customers/:id profile summary stats
      try {
        const customer = await this.getCustomerDetails(customerId);
        if (customer.billingSummary || customer.summaryStats) {
          return {
            customerId: customer.id,
            companyName: customer.companyName,
            currency: customer.currency,
            summary: customer.billingSummary || customer.summaryStats
          };
        }
        return {
          customerId: customer.id,
          companyName: customer.companyName,
          currency: customer.currency,
          status: 'unavailable',
          message: 'Authoritative customer billing summary is not calculated or available from backend for this account.'
        };
      } catch (innerErr) {
        throw err;
      }
    }
  }

  // 8. Get revenue summary
  async getRevenueSummary(): Promise<BackendAnalyticsDashboard> {
    return this.request<BackendAnalyticsDashboard>('/analytics/dashboard');
  }

  // 9. Get overdue invoices
  async getOverdueInvoices(): Promise<BackendAnalyticsOverdue> {
    return this.request<BackendAnalyticsOverdue>('/analytics/overdue');
  }
}
