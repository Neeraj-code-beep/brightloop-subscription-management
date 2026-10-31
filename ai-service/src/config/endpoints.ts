/**
 * Centralized Backend API Endpoints Mapping
 * Defines confirmed operational paths from Neeraj's backend alongside pending endpoints.
 */

export const BACKEND_ENDPOINTS = {
  // Confirmed Customer-Scoped REST APIs
  customers: {
    list: '/customers',
    get: (id: string) => `/customers/${encodeURIComponent(id)}`,
    subscriptions: (id: string) => `/customers/${encodeURIComponent(id)}/subscriptions`,
    invoices: (id: string) => `/customers/${encodeURIComponent(id)}/invoices`,
    payments: (id: string) => `/customers/${encodeURIComponent(id)}/payments`,
    billingSummary: (id: string) => `/customers/${encodeURIComponent(id)}/billing-summary`,
    legacySummary: (id: string) => `/customers/${encodeURIComponent(id)}/summary`
  },

  // Pending verification endpoints (Fallback routes if direct root queries are enabled)
  subscriptions: {
    list: '/subscriptions',
    get: (id: string) => `/subscriptions/${encodeURIComponent(id)}`
  },
  invoices: {
    list: '/invoices',
    get: (id: string) => `/invoices/${encodeURIComponent(id)}`
  },
  payments: {
    list: '/payments',
    get: (id: string) => `/payments/${encodeURIComponent(id)}`
  },
  analytics: {
    summary: '/analytics/summary',
    dashboard: '/analytics/dashboard',
    revenue: '/analytics/revenue',
    overdue: '/analytics/overdue'
  }
} as const;
