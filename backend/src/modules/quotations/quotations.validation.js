import { z } from 'zod';

const quotationItemInputSchema = z.object({
  productId: z.string().trim().min(1, 'Product ID is required'),
  planId: z.string().trim().min(1).optional().nullable(),
  variantIds: z.array(z.string().trim().min(1)).default([]),
  description: z.string().trim().max(500).optional().nullable(),
  quantity: z.coerce.number().int().positive('Quantity must be at least 1').default(1),
  taxId: z.string().trim().min(1).optional().nullable(),
  discountId: z.string().trim().min(1).optional().nullable()
});

export const createQuotationSchema = z.object({
  customerId: z.string().trim().min(1, 'Customer ID is required'),
  validUntil: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'validUntil must be a valid date string'
  }).refine((val) => new Date(val).getTime() > Date.now(), {
    message: 'validUntil date must be in the future'
  }),
  currency: z.string().trim().length(3).default('INR'),
  notes: z.string().trim().max(1000).optional().nullable(),
  termsAndConditions: z.string().trim().max(2000).optional().nullable(),
  items: z.array(quotationItemInputSchema).min(1, 'Quotation must include at least one line item')
});

export const updateQuotationSchema = z.object({
  validUntil: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'validUntil must be a valid date string'
  }).optional(),
  currency: z.string().trim().length(3).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  termsAndConditions: z.string().trim().max(2000).optional().nullable(),
  items: z.array(quotationItemInputSchema).min(1).optional()
});

export const updateQuotationStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'], {
    errorMap: () => ({ message: 'Status must be one of: DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, CONVERTED' })
  })
});

export const convertQuotationSchema = z.object({
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'startDate must be a valid date string'
  }).optional(),
  metadata: z.record(z.any()).optional()
}).optional().default({});

