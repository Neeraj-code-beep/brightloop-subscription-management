import { z } from 'zod';

export const createTaxSchema = z.object({
  name: z.string().trim().min(2, 'Tax name must be at least 2 characters').max(100),
  code: z.string().trim().min(2, 'Tax code must be at least 2 characters').max(50).toUpperCase().optional(),
  rate: z.union([z.number(), z.string()]).optional(),
  percentage: z.union([z.number(), z.string()]).optional(),
  type: z.enum(['VAT', 'GST', 'SALES_TAX', 'CUSTOMS', 'EXCISE', 'OTHER']).default('SALES_TAX'),
  jurisdiction: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(255).optional().nullable(),
  validFrom: z.string().datetime({ offset: true }).or(z.string().date()).optional().nullable(),
  validTo: z.string().datetime({ offset: true }).or(z.string().date()).optional().nullable(),
  isCompound: z.boolean().default(false),
  priority: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true)
}).refine(data => data.rate !== undefined || data.percentage !== undefined, {
  message: 'Either tax rate or percentage must be specified',
  path: ['rate']
});

export const updateTaxSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  code: z.string().trim().min(2).max(50).toUpperCase().optional(),
  rate: z.union([z.number(), z.string()]).optional(),
  percentage: z.union([z.number(), z.string()]).optional(),
  type: z.enum(['VAT', 'GST', 'SALES_TAX', 'CUSTOMS', 'EXCISE', 'OTHER']).optional(),
  jurisdiction: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(255).optional().nullable(),
  validFrom: z.string().datetime({ offset: true }).or(z.string().date()).optional().nullable(),
  validTo: z.string().datetime({ offset: true }).or(z.string().date()).optional().nullable(),
  isCompound: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional()
});

export const updateTaxStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status is required' })
});

