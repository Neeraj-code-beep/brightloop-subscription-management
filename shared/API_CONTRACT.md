# API Contract & Conventions

This document establishes the standardized API architecture, payload structures, and conventions for the **Brightloop Software Subscription Management System (SMS)**. All developers (Frontend, Backend, AI Service) must adhere strictly to this contract.

---

## 1. General Principles

1. **Protocol & Versioning**: All API endpoints are served over HTTPS and versioned with prefix `/api/v1`.
2. **Payload Encoding**: Request and response bodies use `application/json; charset=utf-8`.
3. **Idempotency**: `GET`, `PUT`, `DELETE` operations must be idempotent.
4. **Case Conventions**:
   - URL paths: lowercase kebab-case (e.g., `/api/v1/subscription-plans`)
   - Query parameters: camelCase (e.g., `page`, `pageSize`, `sortBy`, `sortOrder`)
   - JSON keys: camelCase (e.g., `customerId`, `subscriptionStatus`, `createdAt`)
   - Database column mappings: handled by Prisma, camelCase in API layer.

---

## 2. Authentication & Authorization

### Header Format
All protected endpoints require an `Authorization` header containing a valid JSON Web Token (JWT):

```http
Authorization: Bearer <access_token>
```

### Roles & Access Control
- `ADMIN`: Full system access across configuration, finance, user management, and analytics.
- `STAFF`: Day-to-day operations (manage customers, subscriptions, invoices, quotations).
- `CUSTOMER`: Self-service portal access (view own subscriptions, invoices, payment methods).

---

## 3. Standard Response Formats

### 3.1 Standard Success Response
Every successful API response must return the following JSON envelope:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

#### Example: Single Entity
```json
{
  "success": true,
  "message": "Customer retrieved successfully",
  "data": {
    "id": "cst_9f8231a4",
    "name": "Acme Corporation",
    "email": "billing@acme.com",
    "status": "ACTIVE",
    "createdAt": "2026-10-31T09:30:00.000Z",
    "updatedAt": "2026-10-31T09:30:00.000Z"
  }
}
```

### 3.2 Standard Error Response
Every error response must use the standard error envelope with appropriate HTTP status codes:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address"
    }
  ]
}
```

---

## 4. Conventions

### 4.1 Dates & Timestamps
- All timestamps must follow **ISO 8601** format in **UTC**: `YYYY-MM-DDTHH:mm:ss.sssZ` (e.g., `2026-10-31T09:30:00.000Z`).
- Date-only fields (e.g., billing cycle date): `YYYY-MM-DD`.

### 4.2 Money Representation
To prevent floating-point rounding errors in financial and billing calculations:
- Monetary amounts are represented as **integers in minor currency units (cents)**.
  - Example: `$49.99` is represented as `4999`.
- Every monetary field must specify its corresponding 3-letter uppercase **ISO 4217 currency code** (e.g., `USD`, `EUR`, `GBP`).
- Standard field names: `amountInCents`, `unitPriceInCents`, `taxInCents`, `discountInCents`, `totalInCents`.

### 4.3 Pagination Conventions
Endpoints returning collections support cursor or page-based pagination using the following query parameters:
- `page`: 1-based index (default: `1`)
- `limit`: items per page (default: `20`, max: `100`)
- `sortBy`: property name to sort by (default: `createdAt`)
- `sortOrder`: `asc` or `desc` (default: `desc`)

#### Paginated Response Envelope:
```json
{
  "success": true,
  "message": "Customers retrieved successfully",
  "data": {
    "items": [
      { "id": "cst_01", "name": "Acme Corp" }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 150,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### 4.4 HTTP Status Codes
| Status Code | Meaning | Usage |
|---|---|---|
| `200 OK` | Success | Successful `GET`, `PATCH`, `PUT` or action |
| `201 Created` | Created | Successful `POST` creating a resource |
| `204 No Content`| No Content | Successful `DELETE` |
| `400 Bad Request`| Client Error | Malformed JSON or invalid syntax |
| `401 Unauthorized`| Authentication Required | Missing, invalid, or expired JWT |
| `403 Forbidden` | Access Denied | Insufficient permissions for user role |
| `404 Not Found` | Not Found | Resource does not exist |
| `409 Conflict` | Conflict | Duplicate entry (e.g. existing email, invoice number) |
| `422 Unprocessable Entity` | Validation Error | Zod schema validation errors on payload |
| `429 Too Many Requests` | Rate Limited | Exceeded rate limits |
| `500 Internal Server Error` | Server Error | Unhandled backend exception |

---

## 5. Core Endpoints Reference

### 5.1 Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/register` - Public customer registration (name, email, password). Always assigns `CUSTOMER` role. Returns access & refresh tokens.
- `POST /api/v1/auth/login` - Authenticate with email/password; returns access token, rotated refresh token & safe user profile.
- `POST /api/v1/auth/refresh` - Issue new access token and rotate refresh token. Invalidates old refresh token.
- `POST /api/v1/auth/logout` - Invalidate current session & revoke refresh token.
- `POST /api/v1/auth/forgot-password` - Request cryptographically secure password reset token (returns generic message to prevent email enumeration).
- `POST /api/v1/auth/reset-password` - Reset password with valid token. Automatically revokes existing sessions for security.
- `GET  /api/v1/auth/me` - Retrieve current authenticated user profile & permissions.

### 5.2 User & Staff Management (`/api/v1/users`)
- `POST  /api/v1/users/staff` - Admin only: Provision new `STAFF` account (name, email, password).
- `GET   /api/v1/users` - Admin only: List all user accounts with pagination & filtering (`role`, `status`, `search`).
- `GET   /api/v1/users/:id` - Admin or self: Retrieve specific user profile details.
- `PATCH /api/v1/users/:id` - Admin or self: Update user details (prevents self-promotion for non-admins).
- `PATCH /api/v1/users/:id/status` - Admin only: Activate or deactivate account (revokes active sessions on deactivation).

### 5.3 Customers (`/api/v1/customers`)
- `POST   /api/v1/customers` - Create customer record and optionally provision a linked customer login account.
  - Access: `ADMIN`, `STAFF`
  - Body:
    - `customerType`: `'INDIVIDUAL' | 'COMPANY'` (required)
    - `firstName`: `string` (required if `INDIVIDUAL`)
    - `lastName`: `string?`
    - `companyName`: `string` (required if `COMPANY`)
    - `email`: `string` (unique, contact email, required)
    - `phone`: `string?`
    - `alternatePhone`: `string?`
    - `billingAddress`: `string?`
    - `billingCity`: `string?`
    - `billingState`: `string?`
    - `billingPostalCode`: `string?`
    - `billingCountry`: `string?`
    - `taxNumber`: `string?`
    - `notes`: `string?`
    - `currency`: `string?` (default `'USD'`)
    - `createAccount`: `boolean?` (default `false`)
    - `accountEmail`: `string?` (login email for user account)
    - `accountPassword`: `string?` (minimum 9 chars, mixed case, number, special char; required if `createAccount` is true)
    - `accountName`: `string?`
  - Response: `{ customer, accountCreated, accountEmail? }` (role strictly forced to `CUSTOMER`, password hashes omitted)
- `GET    /api/v1/customers` - List customers with pagination, search, filtering, and sorting.
  - Access: `ADMIN`, `STAFF` (Customers forbidden from listing all customers)
  - Query parameters:
    - `page`: `number` (default `1`)
    - `limit`: `number` (default `20`, max `100`)
    - `search`: `string` (matches across `firstName`, `lastName`, `companyName`, `email`, `customerCode`)
    - `customerType`: `'INDIVIDUAL' | 'COMPANY'`
    - `isActive`: `boolean`
    - `sortBy`: `'createdAt' | 'updatedAt' | 'email' | 'customerCode' | 'firstName' | 'companyName'`
    - `sortOrder`: `'asc' | 'desc'`
  - Response: `{ items: Customer[], pagination: { page, limit, totalItems, totalPages, hasNextPage, hasPrevPage } }`
- `GET    /api/v1/customers/:id` - Fetch single customer record.
  - Access: `ADMIN`, `STAFF`, `CUSTOMER` (strictly own record verified against authenticated `user.customerId`)
  - Response: Full safe `Customer` object
- `PATCH  /api/v1/customers/:id` - Update customer fields.
  - Access: `ADMIN`, `STAFF` (operational fields), `CUSTOMER` (own permitted profile fields only)
  - Customer self-update allowlist: `firstName`, `lastName`, `phone`, `alternatePhone`, `billingAddress`, `billingCity`, `billingState`, `billingPostalCode`, `billingCountry`
  - Admin/Staff allowlist adds: `companyName`, `email`, `taxNumber`, `notes`, `currency`
  - Protected fields rejected/immutable: `customerCode`, `id`, `userId`, `isActive`, `status`
  - Response: Updated safe `Customer` object
- `PATCH  /api/v1/customers/:id/status` - Activate or deactivate customer business status.
  - Access: `ADMIN` only (`STAFF` and `CUSTOMER` forbidden)
  - Body: `{ "isActive": boolean }`
  - Response: Updated safe `Customer` object with synchronized `isActive` and `status` (`ACTIVE` / `SUSPENDED`)
- `GET    /api/v1/customers/:id/subscriptions` - List customer's paginated subscriptions.
  - Access: `ADMIN`, `STAFF`, `CUSTOMER` (own record only)
  - Query parameters: `page`, `limit`
  - Response: `{ items: SubscriptionSummary[], pagination }`
- `GET    /api/v1/customers/:id/invoices` - List customer's paginated invoices.
  - Access: `ADMIN`, `STAFF`, `CUSTOMER` (own record only)
  - Query parameters: `page`, `limit`
  - Response: `{ items: InvoiceSummary[], pagination }`
- `GET    /api/v1/customers/:id/payments` - List customer's paginated payments.
  - Access: `ADMIN`, `STAFF`, `CUSTOMER` (own record only)
  - Query parameters: `page`, `limit`
  - Response: `{ items: PaymentSummary[], pagination }`

### 5.3 Products & Plans (`/api/v1/products`, `/api/v1/plans`)
- `GET    /api/v1/products` - List products & associated variants.
- `POST   /api/v1/products` - Create product.
- `GET    /api/v1/products/:id` - Product details with pricing tiers.
- `PATCH  /api/v1/products/:id` - Update product details.
- `GET    /api/v1/plans` - List subscription plans (monthly, yearly, custom).
- `POST   /api/v1/plans` - Create subscription plan.
- `GET    /api/v1/plans/:id` - Fetch plan details.
- `PATCH  /api/v1/plans/:id` - Update plan status/pricing.

### 5.4 Subscriptions & Quotations (`/api/v1/subscriptions`, `/api/v1/quotations`)
- `GET    /api/v1/quotations` - List quotations.
- `POST   /api/v1/quotations` - Create quotation for customer.
- `POST   /api/v1/quotations/:id/convert` - Convert accepted quotation into active subscription.
- `GET    /api/v1/subscriptions` - List subscriptions with filters (status: `ACTIVE`, `PAST_DUE`, `CANCELED`, etc.).
- `POST   /api/v1/subscriptions` - Create new subscription.
- `GET    /api/v1/subscriptions/:id` - Get subscription details with active items, plan, and next billing date.
- `PATCH  /api/v1/subscriptions/:id` - Update subscription (plan change / quantity adjustment).
- `POST   /api/v1/subscriptions/:id/cancel` - Cancel subscription (immediately or at period end).
- `POST   /api/v1/subscriptions/:id/pause` - Pause subscription.

### 5.5 Invoices (`/api/v1/invoices`)
- `GET    /api/v1/invoices` - List invoices (filterable by status: `DRAFT`, `OPEN`, `PAID`, `VOID`, `UNCOLLECTIBLE`).
- `POST   /api/v1/invoices` - Manually create one-off or ad-hoc invoice.
- `GET    /api/v1/invoices/:id` - Get invoice details, line items, taxes, discounts, and payments.
- `POST   /api/v1/invoices/:id/finalize` - Finalize draft invoice and post to customer.
- `POST   /api/v1/invoices/:id/void` - Void an open/uncollectible invoice.
- `GET    /api/v1/invoices/:id/pdf` - Download invoice PDF.

### 5.6 Payments (`/api/v1/payments`)
- `GET    /api/v1/payments` - List payments and transactions.
- `POST   /api/v1/payments` - Record payment against invoice.
- `GET    /api/v1/payments/:id` - Payment transaction details.
- `POST   /api/v1/payments/:id/refund` - Process full or partial refund.

### 5.7 Analytics & Dashboard (`/api/v1/analytics`)
- `GET    /api/v1/analytics/dashboard` - Executive metrics: MRR, ARR, active subscriptions, churn rate, outstanding dues.
- `GET    /api/v1/analytics/revenue` - Historical revenue series by month/quarter.
- `GET    /api/v1/analytics/overdue` - Overdue invoice Aging report (0-30, 31-60, 61-90, 90+ days).

### 5.8 AI Service Endpoints (`/api/v1/ai`)
- `POST   /api/v1/ai/chat` - Natural language query to billing assistant via Gemini & MCP tools.
  - Body: `{ "prompt": string, "conversationId"?: string, "context"?: object }`
- `POST   /api/v1/ai/rag/query` - Semantic retrieval of company policies, product sheets, and billing guidelines.
  - Body: `{ "query": string, "topK"?: number }`
- `GET    /api/v1/ai/health` - AI Service health & Gemini connectivity status.

