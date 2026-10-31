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

| MCP Tool | Backend Endpoint | Query / Path Params | Expected Output Envelope |
|---|---|---|---|
| `search_customer` | `GET /api/v1/customers` | `?search=<query>&page=1&limit=10` | `{ "items": [{ "id", "name", "email", "status" }] }` |
| `get_customer_details` | `GET /api/v1/customers/:id` | Path `:id` (e.g. `cst_123`) | Customer object with address, billing currency, timestamps |
| `get_customer_subscriptions` | `GET /api/v1/subscriptions` | `?customerId=<id>&status=<status>` | `{ "items": [{ "id", "planId", "status", "currentPeriodEnd" }] }` |
| `get_customer_invoice_history` | `GET /api/v1/invoices` | `?customerId=<id>&page=1&limit=20` | `{ "items": [{ "id", "invoiceNumber", "totalInCents", "status", "dueDate" }] }` |
| `get_invoice_details` | `GET /api/v1/invoices/:id` | Path `:id` (UUID or invoice number) | Invoice object with line items, tax, discount, total, amountPaid |
| `get_customer_payment_history` | `GET /api/v1/payments` | `?customerId=<id>` | `{ "items": [{ "id", "amountInCents", "status", "paidAt" }] }` |
| `get_customer_billing_summary` | `GET /api/v1/customers/:id/summary` or `/customers/:id` | Path `:id` | Dedicated backend-calculated summary stats (outstanding, active plans) |
| `get_revenue_summary` | `GET /api/v1/analytics/dashboard` & `GET /api/v1/analytics/revenue` | None | `{ "mrrInCents", "arrInCents", "activeSubscriptions", "currency" }` |
| `get_overdue_invoices` | `GET /api/v1/analytics/overdue` | None | Authoritative aging buckets (0-30, 31-60, 61-90, 90+) and overdue invoice list |

### Architectural Security & Financial Integrity:
- **No Direct Database Access**: The AI service strictly communicates through authenticated REST endpoints and does NOT connect directly to Neeraj's core PostgreSQL database.
- **Backend-Calculated Values**: Authoritative metrics (MRR, ARR, overdue aging, customer balance) must be calculated on the backend. The AI service will never independently calculate or sum up balances.
- **Preserve RBAC**: If a `CUSTOMER` attempts to access another customer's data or revenue analytics, the backend must return `403 Forbidden`. The AI Assistant will halt and preserve this permission boundary.
- **Currency Preservation**: Returns exact currency codes and units from the backend record without assuming USD.

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
      "reply": "According to backend records, customer cst_9f8231a4 has an outstanding balance of 12000 cents (USD).",
      "answer": "According to backend records, customer cst_9f8231a4 has an outstanding balance of 12000 cents (USD).",
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
