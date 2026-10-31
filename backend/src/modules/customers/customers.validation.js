import { z } from 'zod';

// --- Creation Schema ---
export const createCustomerSchema = z.object({
  customerType: z.enum(['INDIVIDUAL', 'COMPANY']),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  companyName: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  phone: z.string().trim().min(5).max(30).optional(),
  alternatePhone: z.string().trim().min(5).max(30).optional(),
  billingAddress: z.string().trim().max(500).optional(),
  billingCity: z.string().trim().max(100).optional(),
  billingState: z.string().trim().max(100).optional(),
  billingPostalCode: z.string().trim().max(20).optional(),
  billingCountry: z.string().trim().max(100).optional(),
  taxNumber: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(2000).optional(),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),

  // Optional linked User account provisioning
  createAccount: z.boolean().default(false),
  accountEmail: z.string().trim().email().toLowerCase().optional(),
  accountPassword: z.string().min(9)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
    .optional(),
  accountName: z.string().trim().min(2).max(100).optional()
}).refine(
  (data) => {
    if (data.customerType === 'INDIVIDUAL') {
      return !!data.firstName;
    }
    return true;
  },
  { message: 'firstName is required for INDIVIDUAL customers', path: ['firstName'] }
).refine(
  (data) => {
    if (data.customerType === 'COMPANY') {
      return !!data.companyName;
    }
    return true;
  },
  { message: 'companyName is required for COMPANY customers', path: ['companyName'] }
).refine(
  (data) => {
    if (data.createAccount && !data.accountPassword) {
      return false;
    }
    return true;
  },
  { message: 'accountPassword is required when creating a linked account', path: ['accountPassword'] }
);

// --- Admin/Staff update schema (broad field access) ---
export const updateCustomerAdminSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  companyName: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  phone: z.string().trim().min(5).max(30).optional().nullable(),
  alternatePhone: z.string().trim().min(5).max(30).optional().nullable(),
  billingAddress: z.string().trim().max(500).optional().nullable(),
  billingCity: z.string().trim().max(100).optional().nullable(),
  billingState: z.string().trim().max(100).optional().nullable(),
  billingPostalCode: z.string().trim().max(20).optional().nullable(),
  billingCountry: z.string().trim().max(100).optional().nullable(),
  taxNumber: z.string().trim().max(50).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  currency: z.string().trim().length(3).toUpperCase().optional()
}).strict();

// --- Customer self-update schema (restricted allowlisted fields) ---
export const updateCustomerSelfSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(5).max(30).optional().nullable(),
  alternatePhone: z.string().trim().min(5).max(30).optional().nullable(),
  billingAddress: z.string().trim().max(500).optional().nullable(),
  billingCity: z.string().trim().max(100).optional().nullable(),
  billingState: z.string().trim().max(100).optional().nullable(),
  billingPostalCode: z.string().trim().max(20).optional().nullable(),
  billingCountry: z.string().trim().max(100).optional().nullable()
}).strict();

// --- Status update schema (ADMIN only) ---
export const updateCustomerStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive boolean is required' })
});

