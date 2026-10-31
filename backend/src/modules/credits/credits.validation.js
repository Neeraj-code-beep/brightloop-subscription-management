import { z } from 'zod';

export const adjustCreditSchema = z.object({
  amount: z.union([z.number(), z.string()]).refine((val) => {
    const num = Number(val);
    return !isNaN(num) && num !== 0;
  }, {
    message: 'amount must be a valid non-zero number or decimal string'
  }),
  reason: z.string().min(3, 'Reason must be at least 3 characters long').max(500),
  idempotencyKey: z.string().optional()
});

export const listCreditTransactionsQuerySchema = z.object({
  page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 20)),
  type: z.enum(['PRORATION_CREDIT', 'MANUAL_ADJUSTMENT', 'INVOICE_APPLICATION', 'REFUND']).optional()
});

