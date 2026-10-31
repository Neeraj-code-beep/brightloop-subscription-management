import { z } from 'zod';

export const createDiscountSchema = z.object({
  code: z.string().trim().min(3, 'Discount code must be at least 3 characters').max(50).toUpperCase(),
  name: z.string().trim().min(2).max(100).optional().nullable(),
  description: z.string().trim().max(255).optional().nullable(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).default('PERCENTAGE'),
  value: z.union([z.number(), z.string()]).refine(val => {
    const num = Number(val);
    return !isNaN(num) && num > 0;
  }, { message: 'Discount value must be a positive number' }),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
  minPurchaseAmount: z.union([z.number(), z.string()]).optional().nullable(),
  maxDiscountAmount: z.union([z.number(), z.string()]).optional().nullable(),
  validFrom: z.string().datetime({ offset: true }).or(z.string().date()).optional().nullable(),
  validTo: z.string().datetime({ offset: true }).or(z.string().date()).optional().nullable(),
  maxRedemptions: z.number().int().min(1).optional().nullable(),
  maxRedemptionsPerCustomer: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true)
});

export const updateDiscountSchema = z.object({
  code: z.string().trim().min(3).max(50).toUpperCase().optional(),
  name: z.string().trim().min(2).max(100).optional().nullable(),
  description: z.string().trim().max(255).optional().nullable(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  value: z.union([z.number(), z.string()]).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  minPurchaseAmount: z.union([z.number(), z.string()]).optional().nullable(),
  maxDiscountAmount: z.union([z.number(), z.string()]).optional().nullable(),
  validFrom: z.string().datetime({ offset: true }).or(z.string().date()).optional().nullable(),
  validTo: z.string().datetime({ offset: true }).or(z.string().date()).optional().nullable(),
  maxRedemptions: z.number().int().min(1).optional().nullable(),
  maxRedemptionsPerCustomer: z.number().int().min(1).optional(),
  isActive: z.boolean().optional()
});

export const updateDiscountStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status is required' })
});

export const validateDiscountSchema = z.object({
  code: z.string().trim().min(1, 'Discount code is required').toUpperCase(),
  customerId: z.string().trim().optional(),
  purchaseAmount: z.union([z.number(), z.string()]).optional().default(0),
  currency: z.string().trim().length(3).toUpperCase().optional()
});

