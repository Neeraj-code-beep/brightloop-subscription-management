import { z } from 'zod';
import { BILLING_CYCLES, CUSTOM_BILLING_UNITS } from '../../utils/billingCycle.js';

const decimalPriceValidator = z
  .union([z.number(), z.string()])
  .refine(
    (val) => {
      const num = Number(val);
      return !isNaN(num) && num >= 0;
    },
    { message: 'Price must be a valid non-negative number.' }
  )
  .transform((val) => Number(val).toFixed(2));

export const createPlanSchema = z
  .object({
    name: z.string().trim().min(1, 'Plan name is required').max(100, 'Plan name cannot exceed 100 characters'),
    description: z.string().trim().max(500).optional().nullable(),
    productId: z.string().trim().min(1, 'Product ID is required'),
    billingCycle: z.nativeEnum(BILLING_CYCLES, {
      errorMap: () => ({ message: `billingCycle must be one of: ${Object.values(BILLING_CYCLES).join(', ')}` })
    }),
    customDuration: z.coerce.number().int().positive('customDuration must be a positive integer').optional().nullable(),
    customDurationUnit: z.nativeEnum(CUSTOM_BILLING_UNITS).optional().nullable(),
    price: decimalPriceValidator.optional(),
    setupFee: decimalPriceValidator.optional().default('0.00'),
    currency: z.string().trim().length(3, 'Currency must be a 3-letter ISO code').default('INR'),
    variantIds: z.array(z.string().trim().min(1)).default([]),
    isActive: z.boolean().optional().default(true)
  })
  .superRefine((data, ctx) => {
    if (data.billingCycle === BILLING_CYCLES.CUSTOM) {
      if (!data.customDuration) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customDuration'],
          message: "customDuration is required when billingCycle is 'CUSTOM'."
        });
      }
      if (!data.customDurationUnit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customDurationUnit'],
          message: "customDurationUnit is required when billingCycle is 'CUSTOM'."
        });
      }
    } else {
      if (data.customDuration !== undefined && data.customDuration !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customDuration'],
          message: "customDuration cannot be provided for standard billing cycles."
        });
      }
      if (data.customDurationUnit !== undefined && data.customDurationUnit !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customDurationUnit'],
          message: "customDurationUnit cannot be provided for standard billing cycles."
        });
      }
    }
  });

export const updatePlanSchema = z
  .object({
    name: z.string().trim().min(1, 'Plan name cannot be empty').max(100).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    billingCycle: z.nativeEnum(BILLING_CYCLES).optional(),
    customDuration: z.coerce.number().int().positive('customDuration must be a positive integer').optional().nullable(),
    customDurationUnit: z.nativeEnum(CUSTOM_BILLING_UNITS).optional().nullable(),
    price: decimalPriceValidator.optional(),
    setupFee: decimalPriceValidator.optional(),
    currency: z.string().trim().length(3).optional(),
    variantIds: z.array(z.string().trim().min(1)).optional(),
    isActive: z.boolean().optional()
  })
  .superRefine((data, ctx) => {
    if (data.billingCycle === BILLING_CYCLES.CUSTOM) {
      if (!data.customDuration) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customDuration'],
          message: "customDuration is required when updating billingCycle to 'CUSTOM'."
        });
      }
      if (!data.customDurationUnit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customDurationUnit'],
          message: "customDurationUnit is required when updating billingCycle to 'CUSTOM'."
        });
      }
    }
  });

export const updatePlanStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status boolean is required.' })
});

