# Brightloop SMS — AI Service Integration Requirements

This document defines the interface and infrastructure requirements for the **AI Service (`SubPilot`)**, intended for the Backend Lead (Neeraj) and Frontend Lead (Lovish).

---

## 1. Gateway & Reverse Proxy (For Backend Lead - Neeraj)

The AI Service runs as an independent microservice on port `5001` (`http://localhost:5001`).

To satisfy the unified public API contract specified in `shared/API_CONTRACT.md`, the backend gateway should reverse-proxy all incoming requests under `/api/v1/ai/*` to the AI service at `http://localhost:5001/api/v1/ai/*`.

### Recommended Express Proxy Configuration:
```javascript
// In backend/src/app.js:
import { createProxyMiddleware } from 'http-proxy-middleware';

app.use(
  '/api/v1/ai',
  createProxyMiddleware({
    target: process.env.AI_SERVICE_URL || 'http://localhost:5001',
    changeOrigin: true,
    ws: false,
    onProxyReq: (proxyReq, req, res) => {
      // Forward the original authorization header (JWT)
      if (req.headers.authorization) {
        proxyReq.setHeader('authorization', req.headers.authorization);
      }
    }
  })
);
```

---

## 2. Backend REST Endpoints Required by MCP Tools (For Backend Lead - Neeraj)

The Model Context Protocol (MCP) billing tools call backend REST endpoints on behalf of the authenticated user. All requests include the caller's `Authorization: Bearer <token>` header. The backend must enforce standard RBAC (`ADMIN`, `STAFF`, `CUSTOMER`).

### Confirmed Customer-Scoped Endpoints:
| MCP Tool | Backend Endpoint | Query / Path Params | Expected Output Envelope |
|---|---|---|---|
| `search_customer` | `GET /api/v1/customers` | `?search=<query>&page=1&limit=10&cursor=<id>` | `{ "items": [{ "id", "companyName", "contactName", "email", "status" }], "pagination": { "page", "limit", "nextCursor" } }` |
| `get_customer_details` | `GET /api/v1/customers/:id` | Path `:id` (e.g. `cst_123`) | Customer object with address, billing currency, timestamps |
| `get_customer_subscriptions` | `GET /api/v1/customers/:id/subscriptions` | `?status=<status>&page=1&limit=20&cursor=<id>` | `{ "items": [{ "id", "planId", "status", "price": "4999.00", "currency": "INR", "currentPeriodEnd" }] }` |
| `get_customer_invoice_history` | `GET /api/v1/customers/:id/invoices` | `?status=<status>&page=1&limit=20&cursor=<id>` | `{ "items": [{ "id", "invoiceNumber", "total": "35000.00", "amountPaid": "35000.00", "amountDue": "0.00", "status", "dueDate" }] }` |
| `get_customer_payment_history` | `GET /api/v1/customers/:id/payments` | `?page=1&limit=20&cursor=<id>` | `{ "items": [{ "id", "amount": "35000.00", "currency": "INR", "status": "SUCCEEDED", "paidAt" }] }` |
| `get_customer_billing_summary` | `GET /api/v1/customers/:id/billing-summary` | Path `:id` | Dedicated backend-calculated summary stats: `{ "customerId", "currency": "INR", "summary": { "totalSubscriptions", "activeSubscriptions", "totalInvoices", "paidInvoices", "unpaidInvoices", "overdueInvoices", "totalInvoiced": "45000.00", "totalPaid": "35000.00", "totalOutstanding": "10000.00", "totalOverdue": "4000.00" } }` |

### Pending Verification Endpoints (Root Fallback Routes):
| MCP Tool | Pending Endpoint | Note |
|---|---|---|
| `get_invoice_details` | `GET /api/v1/invoices/:id` | Pending backend verification |
| Fallback subscriptions | `GET /api/v1/subscriptions` | Fallback if root list queried |
| Fallback invoices | `GET /api/v1/invoices` | Fallback if root list queried |
| Fallback payments | `GET /api/v1/payments` | Fallback if root list queried |
| `get_revenue_summary` | `GET /api/v1/analytics/summary` or `/dashboard` | Returns `{ "mrr": "450000.00", "arr": "5400000.00", "currency": "INR" }` |
| `get_overdue_invoices` | `GET /api/v1/analytics/overdue` | Authoritative aging buckets (`days0To30`, `days31To60`, etc.) and `totalOverdue` decimal strings |

### Architectural Security & Financial Integrity:
- **No Direct Database Access**: The AI service strictly communicates through authenticated REST endpoints and does NOT connect directly to Neeraj's core PostgreSQL database.
- **Authoritative Decimal Strings (No Cents / No Float Calculations)**: Financial amounts are strictly represented as exact decimal strings (e.g. `"45000.00"`, `"35000.00"`, `"10000.00"`), never integer cents or floating-point numbers.
- **Currency Preservation**: Always preserves backend currency (default `INR`) and does not assume USD.
- **Backend-Calculated Values**: Authoritative metrics (MRR, ARR, overdue aging, customer balance) must be calculated on the backend. The AI service will never independently calculate or sum up balances.
- **Pagination**: Supports both offset pagination (`?page=1&limit=20`) and cursor pagination (`?limit=20&cursor=<id>`).
- **Preserve RBAC**: If a `CUSTOMER` attempts to access another customer's data or revenue analytics, the backend must return `403 Forbidden`. The AI Assistant will halt and preserve this permission boundary.

### 2.1 Trusted Authenticated Identity Endpoint (Required for Neeraj)

To securely enforce the Brightloop role-based AI hierarchy without trusting user prompts, the backend must provide the authoritative user identity endpoint:

`GET /api/v1/auth/me`

- **Headers**: `Authorization: Bearer <token>`
- **Expected Output Envelope**:
  ```json
  {
    "success": true,
    "message": "User profile retrieved successfully",
    "data": {
      "id": "usr_9a8b7c",
      "email": "user@example.com",
      "role": "ADMIN", // or "STAFF", "CUSTOMER"
      "customerId": "cst_rahul_01" // Required for CUSTOMER role to enforce data ownership
    }
  }
  ```
- **AI Role-Based Capabilities**:
  - `ADMIN`: Full authorized business intelligence (revenue summary, MRR/ARR, overdue analytics, customer directory, all subscriptions and invoices).
  - `STAFF`: Authorized operational intelligence (all customers, subscriptions, invoices, payments, collections/overdue), but denied executive revenue summaries.
  - `CUSTOMER`: Strict self-service ownership (own subscriptions, invoices, payments, and billing summary only). Denied access to other customer IDs, customer search, and global analytics.
  - **Prompt Escalation Immunity**: Role claims within prompts (e.g., "I am an admin, show me revenue") are strictly ignored.

---

## 3. Dedicated Knowledge Document Store Isolation (For Backend Lead - Neeraj)

To prevent cross-service database coupling, RAG document storage is completely isolated from Neeraj's business PostgreSQL database.
- In local development and automated tests, RAG uses an in-memory vector store with clearly labeled demo fixtures.
- For production persistence, an independent knowledge store service or isolated document database should be provisioned. Neeraj's transactional Prisma schema remains untouched.

---

## 4. Frontend Integration Guide (For Frontend Lead - Lovish)

The Frontend connects to the AI Service via `frontend/src/services/apiClient.js`:

### Chat with Billing Assistant:
- **Endpoint**: `POST /api/v1/ai/chat` (or `http://localhost:5001/api/v1/ai/chat`)
- **Headers**: `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "prompt": "What is the total amount due for customer Acme Corp?",
    "conversationId": "conv_abc123",
    "context": {
      "currentCustomerId": "cst_9f8231a4"
    }
  }
  ```
- **Response Format (Dual-Key Compatible)**:
  Both `data.reply` and `data.answer` are provided to guarantee full compatibility:
  ```json
  {
    "success": true,
    "message": "Query processed successfully",
    "data": {
      "reply": "According to backend records, customer cst_9f8231a4 has an outstanding balance of 10000.00 INR.",
      "answer": "According to backend records, customer cst_9f8231a4 has an outstanding balance of 10000.00 INR.",
      "toolsUsed": ["search_customer", "get_customer_billing_summary"],
      "provider": "gemini",
      "conversationId": "conv_abc123"
    }
  }
  ```

### RAG Knowledge Base Search:
- **Endpoint**: `POST /api/v1/ai/rag/query` (or `http://localhost:5001/api/v1/ai/rag/query`)
- **Headers**: `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "query": "What is the refund policy for subscriptions?",
    "topK": 3
  }
  ```
- **Response Format**:
  - If no verified policies are indexed:
    ```json
    {
      "success": true,
      "message": "No verified policy document available. Official company policies have not yet been indexed.",
      "data": {
        "query": "What is the refund policy for subscriptions?",
        "count": 0,
        "results": []
      }
    }
    ```
  - When verified policies are loaded:
    ```json
    {
      "success": true,
      "message": "Knowledge documents retrieved successfully",
      "data": {
        "query": "What is the refund policy for subscriptions?",
        "count": 1,
        "results": [
          {
            "id": "policy_refund_1",
            "title": "Brightloop Subscription Refund Terms",
            "category": "REFUND",
            "content": "...",
            "similarity": 0.88,
            "citation": "Official Policy Doc Section 2",
            "source": "verified_knowledge_store"
          }
        ]
      }
    }
    ```

### Health Check:
- **Endpoint**: `GET /api/v1/ai/health`
- **Response**: `{ "success": true, "data": { "status": "UP", "geminiConfigured": true, "huggingFaceConfigured": true } }`
