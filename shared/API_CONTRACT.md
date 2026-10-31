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

### 5.4 Products & Variants (`/api/v1/products`)
- `POST   /api/v1/products` - Create a product.
  - Access: `ADMIN`, `STAFF`
  - Body:
    - `name`: `string` (required, 1-200 chars)
    - `slug`: `string?` (optional, auto-generated from name if omitted)
    - `description`: `string?`
    - `type`: `'SOFTWARE' | 'SERVICE' | 'SUBSCRIPTION' | 'ADD_ON'` (default `'SOFTWARE'`)
    - `basePrice`: `number | string` (non-negative Decimal, e.g. `5000.00`, required)
    - `costPrice`: `number | string | null` (optional non-negative Decimal)
    - `isActive`: `boolean?` (default `true`)
  - Response: Created product object
- `GET    /api/v1/products` - List products with dual pagination (offset or cursor mode), search by name, filtering by `type` and `isActive`, and sorting.
  - Access: `ADMIN`, `STAFF`
  - Query parameters: `page`, `limit`, `cursor`, `search`, `type`, `isActive`, `sortBy`, `sortOrder`
  - Response: `{ items: Product[], pagination }`
- `GET    /api/v1/products/:id` - Fetch single product details with all active/inactive variants.
  - Access: `ADMIN`, `STAFF`
  - Response: Full product object with `variants: ProductVariant[]`
- `PATCH  /api/v1/products/:id` - Update product fields.
  - Access: `ADMIN`, `STAFF`
  - Body: Allowlisted fields (`name`, `slug`, `description`, `type`, `basePrice`, `costPrice`, `isActive`)
  - Response: Updated product object
- `PATCH  /api/v1/products/:id/status` - Activate or deactivate product.
  - Access: `ADMIN`, `STAFF`
  - Body: `{ "isActive": boolean }`
  - Response: Updated product object
- `POST   /api/v1/products/:id/calculate-price` (alias `/price`) - Calculate final price on backend.
  - Access: `ADMIN`, `STAFF`
  - Formula: `Final Price = Base Product Price + Selected Active Variant Prices`
  - Body: `{ "variantIds": string[] }`
  - Validates: All variant IDs belong to the specified product, are active, and contains no duplicates.
  - Response: `{ productId, productName, productActive, basePrice, selectedVariants, finalPrice }`
- `POST   /api/v1/products/:id/variants` - Create variant for product.
  - Access: `ADMIN`, `STAFF`
  - Body:
    - `name`: `string` (required, unique per product)
    - `sku`: `string?` (unique, auto-generated if omitted)
    - `description`: `string?`
    - `additionalPrice`: `number | string` (non-negative Decimal, default `0.00`)
    - `unit`: `string?` (default `'seat'`)
    - `isActive`: `boolean?` (default `true`)
  - Response: Created `ProductVariant`
- `GET    /api/v1/products/:id/variants` - List variants for product with dual pagination.
  - Access: `ADMIN`, `STAFF`
  - Query parameters: `page`, `limit`, `cursor`, `search`, `isActive`, `sortBy`, `sortOrder`
  - Response: `{ items: ProductVariant[], pagination }`
- `PATCH  /api/v1/products/:id/variants/:variantId` - Update variant fields.
  - Access: `ADMIN`, `STAFF`
  - Validates: Variant belongs to requested product.
  - Response: Updated `ProductVariant`
- `PATCH  /api/v1/products/:id/variants/:variantId/status` - Activate or deactivate variant.
  - Access: `ADMIN`, `STAFF`
  - Body: `{ "isActive": boolean }`
  - Response: Updated `ProductVariant`

### 5.5 Plans & Billing Cycles (`/api/v1/plans`)
- `POST   /api/v1/plans` - Create a plan tied to a product and selected variants.
  - Access: `ADMIN`, `STAFF`
  - Body:
    - `name`: `string` (required, 1-100 chars)
    - `description`: `string?` (max 500 chars)
    - `productId`: `string` (required, must belong to active product)
    - `billingCycle`: `MONTHLY | QUARTERLY | HALF_YEARLY | YEARLY | CUSTOM` (required)
    - `customDuration`: `number?` (positive integer, required if cycle is `CUSTOM`)
    - `customDurationUnit`: `DAYS | WEEKS | MONTHS | YEARS` (required if cycle is `CUSTOM`)
    - `price`: `number | string` (optional; if supplied, must match authoritative backend total: product basePrice + active variant additionalPrices)
    - `setupFee`: `number | string` (optional non-negative Decimal, default: `0.00`)
    - `currency`: `string` (default: `'INR'`)
    - `variantIds`: `string[]` (optional, all variants must be active and belong to `productId`)
    - `isActive`: `boolean` (default: `true`)
  - Validates: Product and variants exist and are active; variants belong to the plan's product; no duplicate variants; unique plan name per product and cycle.
  - Response: Created Plan with `pricingBreakdown`, `product`, `variants`, and `nextBillingDatePreview`
- `GET    /api/v1/plans` - List plans with dual pagination (offset and cursor modes).
  - Access: `ADMIN`, `STAFF`
  - Query parameters: `page`, `limit`, `cursor`, `search`, `productId`, `billingCycle`, `isActive`, `sortBy`, `sortOrder`
  - Response: `{ items: Plan[], pagination: { mode, limit, ... } }`
- `GET    /api/v1/plans/:id` - Get complete plan details with product, variants, and pricing breakdown.
  - Access: `ADMIN`, `STAFF`
  - Response: Plan object
- `PATCH  /api/v1/plans/:id` - Update plan details, configuration, or associated variants.
  - Access: `ADMIN`, `STAFF`
  - Body: Allowlisted fields (`name`, `description`, `billingCycle`, `customDuration`, `customDurationUnit`, `price`, `setupFee`, `currency`, `variantIds`, `isActive`)
  - Response: Updated Plan object
- `PATCH  /api/v1/plans/:id/status` - Activate or deactivate plan.
  - Access: `ADMIN`, `STAFF`
  - Body: `{ "isActive": boolean }`
  - Response: Updated Plan object

### 5.6 Quotation Management (`/api/v1/quotations`)
- `POST   /api/v1/quotations` - Create a quotation with line items and authoritative server-calculated pricing.
  - Access: `ADMIN`, `STAFF`
  - Body:
    - `customerId`: `string` (required)
    - `quotationDate`: `string (ISO date)?` (default: now)
    - `validUntil`: `string (ISO date)` (required, must be in future)
    - `currency`: `string?` (default: `'INR'`)
    - `notes`: `string?`
    - `termsAndConditions`: `string?`
    - `items`: `array` (required, non-empty)
      - `productId`: `string` (required, active product)
      - `planId`: `string?` (optional, active plan belonging to product)
      - `quantity`: `integer` (min: 1, default: 1)
      - `unitPrice`: `number | string?` (optional override; defaults to plan or product base price)
      - `setupFee`: `number | string?` (optional snapshot)
      - `discountId`: `string?` (optional valid active discount)
      - `taxId`: `string?` (optional valid active tax)
      - `selectedVariants`: `array?` (optional list of variant objects `{ id, name, additionalPrice }`)
  - State Transitions: Created with status `DRAFT`.
  - Response: Created quotation with line items, subtotal, discountAmount, taxAmount, and grandTotal.
- `GET    /api/v1/quotations` - List quotations with dual pagination (offset and cursor modes).
  - Access: `ADMIN`, `STAFF`, `CUSTOMER` (automatically filtered to caller's `customerId`)
  - Query parameters: `page`, `limit`, `cursor`, `customerId` (Admin/Staff only), `status`, `sortBy`, `sortOrder`
  - Response: `{ items: Quotation[], pagination }`
- `GET    /api/v1/quotations/:id` - Fetch quotation details with line items and linked subscription.
  - Access: `ADMIN`, `STAFF`, `CUSTOMER` (strictly own record verified against authenticated `user.customerId`)
  - Response: Full quotation object with items, customer, and subscription.
- `PATCH  /api/v1/quotations/:id` - Update quotation details and line items (DRAFT only).
  - Access: `ADMIN`, `STAFF`
  - Validates: Quotation must be in `DRAFT` status; recalculates line items and totals if items are updated.
  - Response: Updated quotation object.
- `PATCH  /api/v1/quotations/:id/status` - Transition quotation status according to strict state machine.
  - Access: `ADMIN`, `STAFF`
  - Valid transitions: `DRAFT -> SENT`, `SENT -> ACCEPTED | REJECTED | EXPIRED`, `ACCEPTED -> CONVERTED`.
  - Body: `{ "status": "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CONVERTED" }`
  - Response: Updated quotation object.
- `POST   /api/v1/quotations/:id/send` - Mark quotation as sent to client.
  - Access: `ADMIN`, `STAFF`
  - Validates: Quotation must be in `DRAFT` status and not expired. Transitions to `SENT`.
  - Response: Updated quotation object.
- `POST   /api/v1/quotations/:id/convert` - Convert accepted quotation into a subscription.
  - Access: `ADMIN`, `STAFF` (Customers forbidden)
  - Validates: Quotation must exist, be `ACCEPTED`, and not expired.
  - Idempotency: If already converted or linked subscription exists, returns existing subscription.
  - Execution: Transactional copy of plan, pricing snapshots, customer link, and quotation status update to `CONVERTED`.
  - Response: `{ quotation, subscription }`

### 5.7 Subscription Lifecycle (`/api/v1/subscriptions`)
- `POST   /api/v1/subscriptions` - Create new subscription.
  - Access: `ADMIN`, `STAFF` (Customers forbidden)
  - Body:
    - `customerId`: `string` (required)
    - `planId`: `string` (required, active plan)
    - `quotationId`: `string?` (optional linked quotation)
    - `startDate`: `string (ISO date)?` (default: now)
    - `billingCycle`: `MONTHLY | QUARTERLY | HALF_YEARLY | YEARLY | CUSTOM?` (defaults to plan cycle)
    - `recurringPrice`: `number | string?` (defaults to plan price snapshot)
    - `setupFee`: `number | string?` (defaults to plan setupFee snapshot)
    - `currency`: `string?` (defaults to plan currency)
    - `metadata`: `object?`
  - Auto-calculates: `currentPeriodStart`, `currentPeriodEnd`, `nextBillingDate` using billing-cycle utility.
  - Response: Created subscription.
- `GET    /api/v1/subscriptions` - List subscriptions with dual pagination (offset and cursor modes).
  - Access: `ADMIN`, `STAFF`, `CUSTOMER` (automatically filtered to caller's `customerId`)
  - Query parameters: `page`, `limit`, `cursor`, `customerId` (Admin/Staff only), `planId`, `status`, `sortBy`, `sortOrder`
  - Response: `{ items: Subscription[], pagination }`
- `GET    /api/v1/subscriptions/:id` - Get subscription details with plan, items, and customer.
  - Access: `ADMIN`, `STAFF`, `CUSTOMER` (strictly own record verified against authenticated `user.customerId`)
  - Response: Full subscription object.
- `PATCH  /api/v1/subscriptions/:id` - Update permitted subscription fields.
  - Access: `ADMIN`, `STAFF`
  - Body: `{ cancelAtPeriodEnd?: boolean, metadata?: object }`
  - Response: Updated subscription object.
- `PATCH  /api/v1/subscriptions/:id/status` - Transition subscription status.
  - Access: `ADMIN`, `STAFF`
  - Valid transitions: `PENDING -> ACTIVE | CANCELED`, `ACTIVE -> PAUSED | CANCELED | EXPIRED`, `PAUSED -> ACTIVE | CANCELED`.
  - Body: `{ "status": "ACTIVE" | "PAUSED" | "CANCELED" | "EXPIRED" }`
  - Response: Updated subscription object.
- `POST   /api/v1/subscriptions/:id/pause` - Pause active subscription.
  - Access: `ADMIN`, `STAFF`
  - Validates: Subscription must be `ACTIVE`. Sets status to `PAUSED` and updates `pausedAt`.
  - Response: Updated subscription object.
- `POST   /api/v1/subscriptions/:id/resume` - Resume paused subscription.
  - Access: `ADMIN`, `STAFF`
  - Validates: Subscription must be `PAUSED`. Sets status to `ACTIVE` and updates `resumedAt`.
  - Response: Updated subscription object.
- `POST   /api/v1/subscriptions/:id/cancel` - Cancel subscription.
  - Access: `ADMIN`, `STAFF`
  - Body: `{ immediately?: boolean, cancellationReason?: string }` (default `immediately: true`)
  - Behavior: If `immediately: true`, transitions status to `CANCELED`, sets `canceledAt` and `endDate`. If `false`, flags `cancelAtPeriodEnd: true`.
  - Response: Updated subscription object.
- `GET    /api/v1/customers/:id/subscriptions` - List customer's subscriptions.
  - Access: `ADMIN`, `STAFF`, `CUSTOMER` (own customer ID only)
  - Query parameters: `page`, `limit`, `cursor`, `status`
  - Response: `{ items: Subscription[], pagination }`

### 5.8 Invoices (`/api/v1/invoices`)
- `GET    /api/v1/invoices` - List invoices (filterable by status: `DRAFT`, `OPEN`, `PAID`, `VOID`, `UNCOLLECTIBLE`).
- `POST   /api/v1/invoices` - Manually create one-off or ad-hoc invoice.
- `GET    /api/v1/invoices/:id` - Get invoice details, line items, taxes, discounts, and payments.
- `POST   /api/v1/invoices/:id/finalize` - Finalize draft invoice and post to customer.
- `POST   /api/v1/invoices/:id/void` - Void an open/uncollectible invoice.
- `GET    /api/v1/invoices/:id/pdf` - Download invoice PDF.

### 5.9 Payments (`/api/v1/payments`)
- `GET    /api/v1/payments` - List payments and transactions.
- `POST   /api/v1/payments` - Record payment against invoice.
- `GET    /api/v1/payments/:id` - Payment transaction details.
- `POST   /api/v1/payments/:id/refund` - Process full or partial refund.

### 5.10 Analytics & Dashboard (`/api/v1/analytics`)
- `GET    /api/v1/analytics/dashboard` - Executive metrics: MRR, ARR, active subscriptions, churn rate, outstanding dues.
- `GET    /api/v1/analytics/revenue` - Historical revenue series by month/quarter.
- `GET    /api/v1/analytics/overdue` - Overdue invoice Aging report (0-30, 31-60, 61-90, 90+ days).

### 5.11 AI Service Endpoints (`/api/v1/ai`)
- `POST   /api/v1/ai/chat` - Natural language query to billing assistant via Gemini & MCP tools.
  - Body: `{ "prompt": string, "conversationId"?: string, "context"?: object }`
- `POST   /api/v1/ai/rag/query` - Semantic retrieval of company policies, product sheets, and billing guidelines.
  - Body: `{ "query": string, "topK"?: number }`
- `GET    /api/v1/ai/health` - AI Service health & Gemini connectivity status.

