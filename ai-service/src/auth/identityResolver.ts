import { BackendApiClient, BackendHttpError } from '../mcp/backendClient.js';

export type UserRole = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export interface AuthIdentity {
  userId: string;
  role: UserRole;
  customerId?: string;
  email?: string;
  isAuthenticated: boolean;
}

export class IdentityVerificationError extends Error {
  public statusCode: number;
  public isAuthError: boolean;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = 'IdentityVerificationError';
    this.statusCode = statusCode;
    this.isAuthError = statusCode === 401 || statusCode === 403;
  }
}

function normalizeRole(roleStr?: string): UserRole {
  if (!roleStr) {
    throw new IdentityVerificationError('User role is missing from backend identity profile', 403);
  }
  const upper = roleStr.toUpperCase();
  if (upper === 'ADMIN' || upper === 'SUPERADMIN') return 'ADMIN';
  if (upper === 'STAFF' || upper === 'SUPPORT' || upper === 'FINANCE') return 'STAFF';
  if (upper === 'CUSTOMER' || upper === 'USER') return 'CUSTOMER';
  throw new IdentityVerificationError(`Unsupported user role '${roleStr}' returned by backend identity service`, 403);
}

/**
 * Resolves trusted user identity strictly through the authenticated backend endpoint /api/v1/auth/me.
 *
 * Security Requirements:
 * 1. Resolves trusted identity via GET /api/v1/auth/me forwarding the caller's JWT.
 * 2. If /api/v1/auth/me is unavailable, returns/throws an IdentityVerificationError (503).
 * 3. Never silently assigns a CUSTOMER role to an unauthenticated or unverified request.
 * 4. Never infers authorization from decoded but unverified JWT claims.
 * 5. Never accepts role or customer identity from prompt text or frontend context.
 * 6. Keeps backend RBAC and customer ownership checks authoritative.
 *
 * Do not implement local JWT verification unless Neeraj has explicitly provided the correct signing-key verification contract.
 */
export async function resolveAuthIdentity(
  rawToken?: string,
  backendClient?: BackendApiClient
): Promise<AuthIdentity> {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new IdentityVerificationError('Authentication required: Missing Authorization token', 401);
  }

  let cleanToken = rawToken.trim();
  if (cleanToken.toLowerCase().startsWith('bearer')) {
    cleanToken = cleanToken.slice(6).trim();
  }
  if (!cleanToken) {
    throw new IdentityVerificationError('Authentication required: Empty Authorization token', 401);
  }

  const client = backendClient || new BackendApiClient(cleanToken);

  try {
    const me = await client.getAuthMe();
    if (!me) {
      throw new IdentityVerificationError('Empty response received from backend identity service', 401);
    }

    const userData = me.data || me.user || me;
    if (!userData || typeof userData !== 'object') {
      throw new IdentityVerificationError('Malformed user profile returned from backend identity service', 401);
    }

    const role = normalizeRole(userData.role);
    const userId = userData.id || userData.userId || 'usr_authenticated';
    const customerId = userData.customerId || (role === 'CUSTOMER' ? (userData.customerId || userData.id) : undefined);

    return {
      userId,
      role,
      customerId,
      email: userData.email,
      isAuthenticated: true
    };
  } catch (err: any) {
    if (err instanceof IdentityVerificationError) {
      throw err;
    }

    if (err instanceof BackendHttpError) {
      if (err.statusCode === 401) {
        throw new IdentityVerificationError(err.message || 'Invalid or expired authentication token', 401);
      }
      if (err.statusCode === 403) {
        throw new IdentityVerificationError(err.message || 'Forbidden: Access denied by backend identity policy', 403);
      }
      // If endpoint returns 404, 500, 501, 502, 503, etc.
      throw new IdentityVerificationError(
        `Identity verification unavailable: Authoritative backend endpoint /api/v1/auth/me returned status ${err.statusCode}`,
        503
      );
    }

    // Network error / connection refused / DNS lookup error
    throw new IdentityVerificationError(
      `Identity verification unavailable: Unable to reach authoritative backend endpoint /api/v1/auth/me (${err.message})`,
      503
    );
  }
}

/**
 * List of MCP tools permitted per role
 */
export const ROLE_ALLOWED_TOOLS: Record<UserRole, string[]> = {
  ADMIN: [
    'search_customer',
    'get_customer_details',
    'get_customer_subscriptions',
    'get_customer_invoice_history',
    'get_invoice_details',
    'get_customer_payment_history',
    'get_customer_billing_summary',
    'get_revenue_summary',
    'get_overdue_invoices'
  ],
  STAFF: [
    'search_customer',
    'get_customer_details',
    'get_customer_subscriptions',
    'get_customer_invoice_history',
    'get_invoice_details',
    'get_customer_payment_history',
    'get_customer_billing_summary',
    'get_overdue_invoices'
  ],
  CUSTOMER: [
    'get_customer_details',
    'get_customer_subscriptions',
    'get_customer_invoice_history',
    'get_invoice_details',
    'get_customer_payment_history',
    'get_customer_billing_summary'
  ]
};

/**
 * Helper to verify whether an identity is authorized to execute a specific tool and target customer.
 */
export function authorizeToolExecution(
  identity: AuthIdentity,
  toolName: string,
  toolArgs: Record<string, any>
): { authorized: boolean; reason?: string; effectiveArgs: Record<string, any> } {
  const allowedTools = ROLE_ALLOWED_TOOLS[identity.role] || [];
  if (!allowedTools.includes(toolName)) {
    return {
      authorized: false,
      reason: `Access Denied: Role '${identity.role}' does not have permission to execute tool '${toolName}'.`,
      effectiveArgs: toolArgs
    };
  }

  const effectiveArgs = { ...toolArgs };

  // Strict Customer Data Isolation
  if (identity.role === 'CUSTOMER') {
    const authorizedCustomerId = identity.customerId;
    if (!authorizedCustomerId) {
      return {
        authorized: false,
        reason: 'Access Denied: Customer user does not have a linked customer identifier.',
        effectiveArgs
      };
    }

    // Tools that take customerId
    if ('customerId' in toolArgs || ['get_customer_details', 'get_customer_subscriptions', 'get_customer_invoice_history', 'get_customer_payment_history', 'get_customer_billing_summary'].includes(toolName)) {
      const requestedId = toolArgs.customerId;
      if (requestedId && requestedId !== authorizedCustomerId) {
        return {
          authorized: false,
          reason: `Access Denied: Customer accounts are strictly limited to their own account data (authorized: ${authorizedCustomerId}, requested: ${requestedId}).`,
          effectiveArgs
        };
      }
      // Guarantee effective customerId is locked to the authenticated user's ID
      effectiveArgs.customerId = authorizedCustomerId;
    }
  }

  return { authorized: true, effectiveArgs };
}
