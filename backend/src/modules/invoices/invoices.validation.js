import { z } from 'zod';

export const createInvoiceItemSchema = z.object({
  productId: z.string().optional().nullable(),
  planId: z.string().optional().nullable(),
  subscriptionItemId: z.string().optional().nullable(),
  description: z.string().min(1, 'Description is required').max(500),
  quantity: z.coerce.number().int().positive().default(1),
  unitPrice: z.union([
    z.number().nonnegative(),
    z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid non-negative decimal amount')
  ]),
  discountAmount: z.union([
    z.number().nonnegative(),
    z.string().regex(/^\d+(\.\d{1,2})?$/)
  ]).optional().default(0),
  taxId: z.string().optional().nullable(),
  taxRate: z.union([
    z.number().min(0).max(100),
    z.string()
  ]).optional().default(0)
});

export const createInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  subscriptionId: z.string().optional().nullable(),
  invoiceDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  paymentTerms: z.enum(['IMMEDIATE', 'NET_7', 'NET_15', 'NET_30']).optional().nullable(),
  periodStart: z.string().datetime().optional().nullable(),
  periodEnd: z.string().datetime().optional().nullable(),
  currency: z.string().min(3).max(3).default('INR'),
  notes: z.string().max(1000).optional().nullable(),
  termsAndConditions: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
  items: z.array(createInvoiceItemSchema).min(1, 'At least one line item is required')
});

export const updateInvoiceSchema = z.object({
  invoiceDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  paymentTerms: z.enum(['IMMEDIATE', 'NET_7', 'NET_15', 'NET_30']).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  termsAndConditions: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
  items: z.array(createInvoiceItemSchema).min(1).optional()
});

export const issueInvoiceSchema = z.object({
  dueDate: z.string().datetime().optional().nullable(),
  paymentTerms: z.enum(['IMMEDIATE', 'NET_7', 'NET_15', 'NET_30']).optional().nullable()
}).optional().default({});

export const voidInvoiceSchema = z.object({
  reason: z.string().max(500).optional().nullable()
}).optional().default({});
