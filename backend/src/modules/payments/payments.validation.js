import { z } from 'zod';

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  customerId: z.string().optional().nullable(),
  amount: z.union([
    z.number().positive('Payment amount must be greater than zero'),
    z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid positive decimal amount')
  ]),
  currency: z.string().min(3).max(3).default('INR'),
  paymentMethod: z.enum([
    'CASH',
    'BANK_TRANSFER',
    'UPI',
    'CARD',
    'OTHER',
    'MANUAL',
    'CREDIT_CARD',
    'ACH'
  ]).default('MANUAL'),
  provider: z.string().default('MANUAL'),
  providerTransactionId: z.string().max(255).optional().nullable(),
  transactionReference: z.string().max(255).optional().nullable(),
  paymentDate: z.string().datetime().optional().nullable(),
  idempotencyKey: z.string().max(255).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable()
});

export const recordRefundSchema = z.object({
  amount: z.union([
    z.number().positive('Refund amount must be greater than zero'),
    z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid positive decimal amount')
  ]),
  reason: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().max(255).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable()
});

export const markFailedSchema = z.object({
  failureReason: z.string().min(1, 'Failure reason is required').max(500)
});

