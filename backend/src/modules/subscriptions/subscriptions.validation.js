import { z } from 'zod';
import { BILLING_CYCLES, CUSTOM_BILLING_UNITS } from '../../utils/billingCycle.js';

export const createSubscriptionSchema = z.object({
  customerId: z.string().trim().min(1, 'Customer ID is required'),
  planId: z.string().trim().min(1, 'Plan ID is required'),
  quotationId: z.string().trim().min(1).optional().nullable(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'startDate must be a valid date string'
  }).optional(),
  billingCycle: z.nativeEnum(BILLING_CYCLES).optional(),
  customDuration: z.coerce.number().int().positive().optional().nullable(),
  customDurationUnit: z.nativeEnum(CUSTOM_BILLING_UNITS).optional().nullable(),
  currency: z.string().trim().length(3).default('INR'),
  metadata: z.record(z.any()).optional(),
  quantity: z.coerce.number().int().positive().default(1)
});

export const updateSubscriptionSchema = z.object({
  metadata: z.record(z.any()).optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  notes: z.string().trim().max(500).optional().nullable()
});

export const updateSubscriptionStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'PAUSED', 'CANCELED', 'EXPIRED'], {
    errorMap: () => ({ message: 'Status must be one of: PENDING, ACTIVE, PAUSED, CANCELED, EXPIRED' })
  })
});

export const cancelSubscriptionSchema = z.object({
  immediate: z.boolean().default(false),
  cancellationReason: z.string().trim().max(500).optional().nullable()
});

export const previewMigrationSchema = z.object({
  targetPlanId: z.string().trim().min(1, 'targetPlanId is required'),
  effectiveDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'effectiveDate must be a valid date string'
  }).optional(),
  timing: z.enum(['IMMEDIATE', 'NEXT_CYCLE']).default('IMMEDIATE'),
  taxId: z.string().trim().optional().nullable(),
  discountId: z.string().trim().optional().nullable()
});

export const migratePlanSchema = z.object({
  targetPlanId: z.string().trim().min(1, 'targetPlanId is required'),
  effectiveDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'effectiveDate must be a valid date string'
  }).optional(),
  timing: z.enum(['IMMEDIATE', 'NEXT_CYCLE']).default('IMMEDIATE'),
  idempotencyKey: z.string().trim().optional(),
  taxId: z.string().trim().optional().nullable(),
  discountId: z.string().trim().optional().nullable()
});

