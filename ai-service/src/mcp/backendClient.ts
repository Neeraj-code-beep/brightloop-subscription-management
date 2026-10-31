import { config } from '../config/index.js';
import { BACKEND_ENDPOINTS } from '../config/endpoints.js';

export interface PaginationMetadata {
  page?: number;
  limit?: number;
  totalItems?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  nextCursor?: string;
  previousCursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination?: PaginationMetadata;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

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
  billingSummary?: BackendBillingSummaryData;
  summaryStats?: BackendBillingSummaryData;
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
  price?: string; // Decimal string (e.g. "4999.00")
  items?: Array<{
    id: string;
    planId: string;
    quantity: number;
    unitPrice?: string; // Decimal string (e.g. "4999.00")
    plan?: { name: string; billingInterval: string };
  }>;
}

export interface BackendInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  subscriptionId?: string;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'UNCOLLECTIBLE' | 'VOID';
  subtotal?: string; // Decimal string (e.g. "45000.00")
  tax?: string;
  discount?: string;
  total: string; // Decimal string (e.g. "45000.00")
  amountPaid: string; // Decimal string (e.g. "35000.00")
  amountDue: string; // Decimal string (e.g. "10000.00")
  currency: string;
  dueDate: string;
  paidAt?: string;
  items?: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: string;
    total: string;
  }>;
}

export interface BackendPayment {
  id: string;
  invoiceId: string;
  paymentMethod: string;
  transactionReference?: string;
  amount: string; // Decimal string (e.g. "35000.00")
  currency: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  paidAt?: string;
  createdAt: string;
}

export interface BackendBillingSummaryData {
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalInvoices: number;
  paidInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  totalInvoiced: string; // Decimal string (e.g. "45000.00")
  totalPaid: string; // Decimal string (e.g. "35000.00")
  totalOutstanding: string; // Decimal string (e.g. "10000.00")
  totalOverdue: string; // Decimal string (e.g. "4000.00")
}

export interface BackendCustomerBillingSummary {
  customerId: string;
  currency: string;
  summary: BackendBillingSummaryData;
}

export interface BackendAnalyticsDashboard {
  mrr: string; // Decimal string
  arr: string; // Decimal string
  activeSubscriptions: number;
  outstandingInvoicesCount: number;
  totalOutstanding: string; // Decimal string
  currency: string;
}

export interface BackendAnalyticsOverdue {
  agingBuckets: {
    days0To30: string; // Decimal string
    days31To60: string;
    days61To90: string;
    days90Plus: string;
  };
  totalOverdue: string; // Decimal string
  overdueInvoicesCount: number;
  currency: string;
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
  private readonly jwtToken?: string;
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

  // 1. Search customers with offset or cursor pagination
  async searchCustomers(
    query: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResult<BackendCustomer>> {
    const raw = await this.request<any>(BACKEND_ENDPOINTS.customers.list, {
      query: {
        search: query,
        page: pagination.page,
        limit: pagination.limit || 10,
        cursor: pagination.cursor,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder
      }
    });

    if (Array.isArray(raw)) {
      return { items: raw };
    }
    return {
      items: raw?.items || [],
      pagination: raw?.pagination
    };
  }

  // 2. Get customer details
  async getCustomerDetails(customerId: string): Promise<BackendCustomer> {
    return this.request<BackendCustomer>(BACKEND_ENDPOINTS.customers.get(customerId));
  }

  // 3. Get customer subscriptions via confirmed customer-scoped API
  async getCustomerSubscriptions(
    customerId: string,
    options: { status?: string } & PaginationParams = {}
  ): Promise<PaginatedResult<BackendSubscription>> {
    try {
      // Confirmed path: /customers/:id/subscriptions
      const raw = await this.request<any>(BACKEND_ENDPOINTS.customers.subscriptions(customerId), {
        query: {
          status: options.status,
          page: options.page,
          limit: options.limit || 20,
          cursor: options.cursor
        }
      });
      if (Array.isArray(raw)) return { items: raw };
      return { items: raw?.items || [], pagination: raw?.pagination };
    } catch (err: any) {
      if (err instanceof BackendHttpError && err.isAuthError) throw err;
      // Fallback path if root /subscriptions is mounted
      try {
        const fallback = await this.request<any>(BACKEND_ENDPOINTS.subscriptions.list, {
          query: {
            customerId,
            status: options.status,
            page: options.page,
            limit: options.limit || 20,
            cursor: options.cursor
          }
        });
        if (Array.isArray(fallback)) return { items: fallback };
        return { items: fallback?.items || [], pagination: fallback?.pagination };
      } catch {
        throw err;
      }
    }
  }

  // 4. Get customer invoices via confirmed customer-scoped API
  async getCustomerInvoices(
    customerId: string,
    options: { status?: string } & PaginationParams = {}
  ): Promise<PaginatedResult<BackendInvoice>> {
    try {
      // Confirmed path: /customers/:id/invoices
      const raw = await this.request<any>(BACKEND_ENDPOINTS.customers.invoices(customerId), {
        query: {
          status: options.status,
          page: options.page,
          limit: options.limit || 20,
          cursor: options.cursor
        }
      });
      if (Array.isArray(raw)) return { items: raw };
      return { items: raw?.items || [], pagination: raw?.pagination };
    } catch (err: any) {
      if (err instanceof BackendHttpError && err.isAuthError) throw err;
      // Fallback path if root /invoices is mounted
      try {
        const fallback = await this.request<any>(BACKEND_ENDPOINTS.invoices.list, {
          query: {
            customerId,
            status: options.status,
            page: options.page,
            limit: options.limit || 20,
            cursor: options.cursor
          }
        });
        if (Array.isArray(fallback)) return { items: fallback };
        return { items: fallback?.items || [], pagination: fallback?.pagination };
      } catch {
        throw err;
      }
    }
  }

  // 5. Get invoice details
  async getInvoiceDetails(invoiceId: string): Promise<BackendInvoice> {
    return this.request<BackendInvoice>(BACKEND_ENDPOINTS.invoices.get(invoiceId));
  }

  // 6. Get customer payments via confirmed customer-scoped API
  async getCustomerPayments(
    customerId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResult<BackendPayment>> {
    try {
      // Confirmed path: /customers/:id/payments
      const raw = await this.request<any>(BACKEND_ENDPOINTS.customers.payments(customerId), {
        query: {
          page: pagination.page,
          limit: pagination.limit || 20,
          cursor: pagination.cursor
        }
      });
      if (Array.isArray(raw)) return { items: raw };
      return { items: raw?.items || [], pagination: raw?.pagination };
    } catch (err: any) {
      if (err instanceof BackendHttpError && err.isAuthError) throw err;
      // Fallback path if root /payments is mounted
      try {
        const fallback = await this.request<any>(BACKEND_ENDPOINTS.payments.list, {
          query: {
            customerId,
            page: pagination.page,
            limit: pagination.limit || 20,
            cursor: pagination.cursor
          }
        });
        if (Array.isArray(fallback)) return { items: fallback };
        return { items: fallback?.items || [], pagination: fallback?.pagination };
      } catch {
        throw err;
      }
    }
  }

  // 7. Get authoritative customer billing summary directly from backend
  async getCustomerBillingSummary(customerId: string): Promise<any> {
    // 1. Primary path: /customers/:id/billing-summary
    try {
      const summary = await this.request<any>(BACKEND_ENDPOINTS.customers.billingSummary(customerId));
      return summary;
    } catch (err: any) {
      if (err instanceof BackendHttpError && err.isAuthError) throw err;
      // 2. Secondary path: /customers/:id/summary
      try {
        const legacySummary = await this.request<any>(BACKEND_ENDPOINTS.customers.legacySummary(customerId));
        return legacySummary;
      } catch (legacyErr: any) {
        if (legacyErr instanceof BackendHttpError && legacyErr.isAuthError) throw legacyErr;
        // 3. Fallback: check profile summary stats
        try {
          const customer = await this.getCustomerDetails(customerId);
          if (customer.billingSummary || customer.summaryStats) {
            return {
              customerId: customer.id,
              companyName: customer.companyName,
              currency: customer.currency || 'INR',
              summary: customer.billingSummary || customer.summaryStats
            };
          }
          return {
            customerId: customer.id,
            companyName: customer.companyName,
            currency: customer.currency || 'INR',
            status: 'unavailable',
            message: 'Authoritative customer billing summary is not calculated or available from backend for this account.'
          };
        } catch {
          throw err;
        }
      }
    }
  }

  // 8. Get revenue summary
  async getRevenueSummary(): Promise<BackendAnalyticsDashboard> {
    try {
      return await this.request<BackendAnalyticsDashboard>(BACKEND_ENDPOINTS.analytics.summary);
    } catch (err: any) {
      if (err instanceof BackendHttpError && err.isAuthError) throw err;
      return await this.request<BackendAnalyticsDashboard>(BACKEND_ENDPOINTS.analytics.dashboard);
    }
  }

  // 9. Get overdue invoices
  async getOverdueInvoices(): Promise<BackendAnalyticsOverdue> {
    return this.request<BackendAnalyticsOverdue>(BACKEND_ENDPOINTS.analytics.overdue);
  }
}
