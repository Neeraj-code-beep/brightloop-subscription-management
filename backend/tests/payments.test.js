import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../src/app.js';
import { createMockPrisma, seedTestUser } from './testHelper.js';
import { setPrismaClient } from '../src/utils/prisma.js';

describe('Payment Management & Reconciliation Suite', () => {
  let mockPrisma;
  let adminToken, staffToken, customerAToken, customerBToken;
  let customerAId, customerBId;
  let invoiceAId, invoiceBId;

  const WEBHOOK_SECRET = 'test_razorpay_secret_xyz123';

  beforeEach(async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

    mockPrisma = createMockPrisma();
    setPrismaClient(mockPrisma);

    // 1. Seed Users & Roles
    const adminUser = await seedTestUser(mockPrisma, {
      name: 'Admin User',
      email: 'admin@subpilot.com',
      role: 'ADMIN'
    });
    adminToken = adminUser.token;

    const staffUser = await seedTestUser(mockPrisma, {
      name: 'Staff Operator',
      email: 'staff@subpilot.com',
      role: 'STAFF'
    });
    staffToken = staffUser.token;

    const custA = await seedTestUser(mockPrisma, {
      name: 'Alpha Corp',
      email: 'alpha@subpilot.com',
      role: 'CUSTOMER'
    });
    customerAToken = custA.token;
    customerAId = custA.customerId;

    const custB = await seedTestUser(mockPrisma, {
      name: 'Beta Ltd',
      email: 'beta@subpilot.com',
      role: 'CUSTOMER'
    });
    customerBToken = custB.token;
    customerBId = custB.customerId;

    // 2. Seed Invoices for Customer A & Customer B
    invoiceAId = 'inv_alpha_001';
    mockPrisma._state.invoices.push({
      id: invoiceAId,
      invoiceNumber: 'INV-000001',
      customerId: customerAId,
      status: 'ISSUED',
      currency: 'INR',
      subtotal: '1000.00',
      discountAmount: '0.00',
      taxAmount: '180.00',
      totalAmount: '1180.00',
      amountPaid: '0.00',
      amountDue: '1180.00',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 86400000),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    invoiceBId = 'inv_beta_002';
    mockPrisma._state.invoices.push({
      id: invoiceBId,
      invoiceNumber: 'INV-000002',
      customerId: customerBId,
      status: 'ISSUED',
      currency: 'INR',
      subtotal: '500.00',
      discountAmount: '0.00',
      taxAmount: '90.00',
      totalAmount: '590.00',
      amountPaid: '0.00',
      amountDue: '590.00',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 86400000),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  describe('1. Manual Payment Recording & Balance Calculations', () => {
    it('STAFF can record a partial payment against an ISSUED invoice', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          invoiceId: invoiceAId,
          amount: 500.00,
          paymentMethod: 'BANK_TRANSFER',
          paymentDate: '2026-02-02T10:00:00Z',
          notes: 'Partial payment wire received'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentReference).toMatch(/^PAY-\d{6}$/);
      expect(res.body.data.amount).toBe('500.00');
      expect(res.body.data.status).toBe('SUCCEEDED');

      // Check invoice balances updated
      const invoice = mockPrisma._state.invoices.find(i => i.id === invoiceAId);
      expect(invoice.status).toBe('PARTIALLY_PAID');
      expect(invoice.amountPaid).toBe('500.00');
      expect(invoice.amountDue).toBe('680.00');
    });

    it('Completing full payment transitions invoice to PAID and amountDue to 0', async () => {
      // 1st payment: 500
      await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          invoiceId: invoiceAId,
          amount: 500.00,
          paymentMethod: 'CARD'
        });

      // 2nd payment: remaining 680
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          invoiceId: invoiceAId,
          amount: 680.00,
          paymentMethod: 'UPI'
        });

      expect(res.status).toBe(201);
      const invoice = mockPrisma._state.invoices.find(i => i.id === invoiceAId);
      expect(invoice.status).toBe('PAID');
      expect(invoice.amountPaid).toBe('1180.00');
      expect(invoice.amountDue).toBe('0.00');
    });

    it('Rejects payment amount exceeding current invoice balance (400)', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          invoiceId: invoiceAId,
          amount: 1500.00,
          paymentMethod: 'CASH'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/exceeds remaining invoice balance/i);
    });

    it('Rejects payment against DRAFT, CANCELLED, or VOID invoices (400)', async () => {
      const draftInv = {
        id: 'inv_draft_999',
        invoiceNumber: 'INV-DRAFT',
        customerId: customerAId,
        status: 'DRAFT',
        currency: 'INR',
        totalAmount: '100.00',
        amountPaid: '0.00',
        amountDue: '100.00'
      };
      mockPrisma._state.invoices.push(draftInv);

      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          invoiceId: draftInv.id,
          amount: 100.00,
          paymentMethod: 'CASH'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot record payment for invoice with status 'DRAFT'/i);
    });

    it('Rejects payment with zero or negative amount (400/422)', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          invoiceId: invoiceAId,
          amount: -50.00,
          paymentMethod: 'CASH'
        });

      expect([400, 422]).toContain(res.status);
    });

    it('Rejects payment when explicitly supplied customerId mismatches invoice customerId', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          invoiceId: invoiceAId,
          customerId: customerBId, // Mismatch
          amount: 100.00,
          paymentMethod: 'CASH'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/match.*invoice.*customer/i);
    });

    it('Deduplicates duplicate submission via idempotencyKey', async () => {
      const idempotencyKey = 'idem_pay_unique_123';

      const res1 = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          invoiceId: invoiceAId,
          amount: 200.00,
          paymentMethod: 'CASH',
          idempotencyKey
        });

      expect(res1.status).toBe(201);
      const payRef1 = res1.body.data.paymentReference;

      const res2 = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          invoiceId: invoiceAId,
          amount: 200.00,
          paymentMethod: 'CASH',
          idempotencyKey
        });

      expect(res2.status).toBe(200);
      expect(res2.body.data.paymentReference).toBe(payRef1);
      expect(res2.body.data.isIdempotentReplay).toBe(true);

      // Verify invoice was not billed twice
      const invoice = mockPrisma._state.invoices.find(i => i.id === invoiceAId);
      expect(invoice.amountPaid).toBe('200.00');
    });
  });

  describe('2. Payment Retrieval & Sub-Resource Routes', () => {
    let paymentA1Id;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoiceId: invoiceAId,
          amount: 300.00,
          paymentMethod: 'CARD',
          provider: 'STRIPE',
          providerTransactionId: 'ch_stripe_12345'
        });
      paymentA1Id = res.body.data.id;
    });

    it('Can fetch payment details by ID with populated invoice and customer', async () => {
      const res = await request(app)
        .get(`/api/v1/payments/${paymentA1Id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(paymentA1Id);
      expect(res.body.data.amount).toBe('300.00');
      expect(res.body.data.invoice).toBeDefined();
      expect(res.body.data.customer).toBeDefined();
      expect(res.body.data.refunds).toBeInstanceOf(Array);
    });

    it('GET /api/v1/invoices/:id/payments lists payments for the given invoice', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${invoiceAId}/payments`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].id).toBe(paymentA1Id);
    });

    it('GET /api/v1/customers/:id/payments lists payments for the given customer', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerAId}/payments`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].id).toBe(paymentA1Id);
    });
  });

  describe('3. Payment Lifecycle & Failure Handling', () => {
    it('Can mark a pending payment as FAILED with a failure reason', async () => {
      // Seed a pending payment
      const pendingPayment = {
        id: 'pay_pending_01',
        paymentReference: 'PAY-000099',
        customerId: customerAId,
        invoiceId: invoiceAId,
        amount: '100.00',
        currency: 'INR',
        paymentMethod: 'UPI',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockPrisma._state.payments.push(pendingPayment);

      const res = await request(app)
        .post(`/api/v1/payments/${pendingPayment.id}/mark-failed`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          failureReason: 'UPI gateway timeout on payer app'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('FAILED');
      expect(res.body.data.failureReason).toBe('UPI gateway timeout on payer app');
    });

    it('Rejects marking an already SUCCEEDED payment as FAILED (400)', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoiceId: invoiceAId,
          amount: 150.00,
          paymentMethod: 'CASH'
        });
      const paymentId = res.body.data.id;

      const failRes = await request(app)
        .post(`/api/v1/payments/${paymentId}/mark-failed`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          failureReason: 'Fraud suspected'
        });

      expect(failRes.status).toBe(400);
      expect(failRes.body.message).toMatch(/cannot mark a succeeded payment as failed/i);
    });
  });

  describe('4. Full and Partial Refunds & Invoice Reversals', () => {
    let paymentId;

    beforeEach(async () => {
      // Create payment of 1000.00 on invoiceA (total 1180.00)
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoiceId: invoiceAId,
          amount: 1000.00,
          paymentMethod: 'CARD'
        });
      paymentId = res.body.data.id;
    });

    it('Partial refund creates a Refund record and updates payment status to PARTIALLY_REFUNDED', async () => {
      const res = await request(app)
        .post(`/api/v1/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 300.00,
          reason: 'Customer requested 30% partial refund for downtime'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.refund.refundReference).toMatch(/^REF-\d{6}$/);
      expect(res.body.data.refund.amount).toBe('300.00');
      expect(res.body.data.refund.status).toBe('SUCCEEDED');
      expect(res.body.data.payment.status).toBe('PARTIALLY_REFUNDED');

      // Invoice balance reversed: amountPaid decreases by 300 (1000 -> 700), amountDue increases (180 -> 480)
      const invoice = mockPrisma._state.invoices.find(i => i.id === invoiceAId);
      expect(invoice.amountPaid).toBe('700.00');
      expect(invoice.amountDue).toBe('480.00');
      expect(invoice.status).toBe('PARTIALLY_PAID');
    });

    it('Full refund marks payment as REFUNDED and restores original invoice balance', async () => {
      // First refund: 300
      await request(app)
        .post(`/api/v1/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 300.00, reason: 'First refund' });

      // Second refund: remaining 700
      const res = await request(app)
        .post(`/api/v1/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 700.00, reason: 'Second refund' });

      expect(res.status).toBe(201);
      expect(res.body.data.payment.status).toBe('REFUNDED');

      // Invoice balance completely restored
      const invoice = mockPrisma._state.invoices.find(i => i.id === invoiceAId);
      expect(invoice.amountPaid).toBe('0.00');
      expect(invoice.amountDue).toBe('1180.00');
      expect(invoice.status).toBe('ISSUED');
    });

    it('Rejects refund exceeding remaining refundable balance (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 1200.00, // Payment was 1000
          reason: 'Too much refund'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/exceeds available refundable balance/i);
    });

    it('Deduplicates refund via idempotencyKey', async () => {
      const idemKey = 'refund_idem_001';

      const res1 = await request(app)
        .post(`/api/v1/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 100.00,
          reason: 'Test refund',
          idempotencyKey: idemKey
        });

      expect(res1.status).toBe(201);

      const res2 = await request(app)
        .post(`/api/v1/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 100.00,
          reason: 'Test refund',
          idempotencyKey: idemKey
        });

      expect(res2.status).toBe(200);
      expect(res2.body.data.isIdempotentReplay).toBe(true);

      // Verify invoice only deducted 100 once
      const invoice = mockPrisma._state.invoices.find(i => i.id === invoiceAId);
      expect(invoice.amountPaid).toBe('900.00');
    });
  });

  describe('5. Razorpay Webhook & Signature Verification', () => {
    it('Rejects webhook without x-razorpay-signature (400)', async () => {
      const res = await request(app)
        .post('/api/v1/payments/webhooks/razorpay')
        .send({ event: 'payment.captured' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Missing x-razorpay-signature/i);
    });

    it('Rejects webhook with invalid HMAC signature (400)', async () => {
      const payload = { event: 'payment.captured' };
      const res = await request(app)
        .post('/api/v1/payments/webhooks/razorpay')
        .set('x-razorpay-signature', 'invalid_signature_hex')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid Razorpay webhook signature/i);
    });

    it('Processes valid payment.captured webhook and updates invoice', async () => {
      const payload = {
        event: 'payment.captured',
        event_id: 'evt_rzp_capture_001',
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_mock_12345',
              amount: 50000, // 500.00 in subunits
              currency: 'INR',
              status: 'captured',
              notes: {
                invoiceId: invoiceAId
              }
            }
          }
        }
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      const res = await request(app)
        .post('/api/v1/payments/webhooks/razorpay')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify invoice updated
      const invoice = mockPrisma._state.invoices.find(i => i.id === invoiceAId);
      expect(invoice.amountPaid).toBe('500.00');
      expect(invoice.amountDue).toBe('680.00');
    });

    it('Webhook deduplication: Ignores duplicate event without reprocessing (200)', async () => {
      const payload = {
        event: 'payment.captured',
        event_id: 'evt_rzp_duplicate_001',
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_mock_99999',
              amount: 20000, // 200.00
              currency: 'INR',
              notes: { invoiceId: invoiceAId }
            }
          }
        }
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      // First webhook
      const res1 = await request(app)
        .post('/api/v1/payments/webhooks/razorpay')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);
      expect(res1.status).toBe(200);

      // Replay identical webhook
      const res2 = await request(app)
        .post('/api/v1/payments/webhooks/razorpay')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);
      expect(res2.status).toBe(200);
      expect(res2.body.data.status).toBe('already_processed');
    });
  });

  describe('6. RBAC & Customer Ownership', () => {
    let paymentAId, paymentBId;

    beforeEach(async () => {
      // Payment for Customer A
      const resA = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoiceId: invoiceAId,
          amount: 250.00,
          paymentMethod: 'UPI'
        });
      paymentAId = resA.body.data.id;

      // Payment for Customer B
      const resB = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoiceId: invoiceBId,
          amount: 290.00,
          paymentMethod: 'CARD'
        });
      paymentBId = resB.body.data.id;
    });

    it('Customer A can view their own payment details', async () => {
      const res = await request(app)
        .get(`/api/v1/payments/${paymentAId}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(paymentAId);
    });

    it('Customer B CANNOT view Customer A payment (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/payments/${paymentAId}`)
        .set('Authorization', `Bearer ${customerBToken}`);

      expect(res.status).toBe(403);
    });

    it('CUSTOMER cannot record payments directly or issue refunds (403 Forbidden)', async () => {
      const recordRes = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          invoiceId: invoiceAId,
          amount: 100.00,
          paymentMethod: 'CASH'
        });
      expect(recordRes.status).toBe(403);

      const refundRes = await request(app)
        .post(`/api/v1/payments/${paymentAId}/refund`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          amount: 50.00,
          reason: 'Customer refund'
        });
      expect(refundRes.status).toBe(403);
    });

    it('CUSTOMER listing /payments is automatically scoped to their own payments', async () => {
      const res = await request(app)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].id).toBe(paymentAId);
    });
  });

  describe('7. Reconciliation Endpoints', () => {
    it('GET /api/v1/payments/reconciliation/summary returns financial balances', async () => {
      // Record a payment
      await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoiceId: invoiceAId,
          amount: 600.00,
          paymentMethod: 'BANK_TRANSFER'
        });

      const res = await request(app)
        .get('/api/v1/payments/reconciliation/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalCollected).toBe('600.00');
      expect(res.body.data.totalRefunded).toBe('0.00');
      expect(res.body.data.hasDiscrepancies).toBeDefined();
    });

    it('POST /api/v1/payments/reconciliation/run sweeps and corrects invoice balances', async () => {
      // Record a payment of 500
      await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoiceId: invoiceAId,
          amount: 500.00,
          paymentMethod: 'BANK_TRANSFER'
        });

      // Artificially drift the invoice balance to simulate drift/discrepancy
      const inv = mockPrisma._state.invoices.find(i => i.id === invoiceAId);
      inv.amountPaid = '100.00'; // Desynced! Should be 500.00
      inv.amountDue = '1080.00'; // Desynced! Should be 680.00

      // Verify unmatched endpoint detects it
      const unmatchedRes = await request(app)
        .get('/api/v1/payments/reconciliation/unmatched')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(unmatchedRes.status).toBe(200);
      expect(unmatchedRes.body.data.invoiceBalanceMismatches.length).toBeGreaterThan(0);

      // Run reconciliation
      const runRes = await request(app)
        .post('/api/v1/payments/reconciliation/run')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(runRes.status).toBe(200);
      expect(runRes.body.data.fixedCount).toBeGreaterThanOrEqual(1);

      // Check invoice balances repaired
      const repairedInv = mockPrisma._state.invoices.find(i => i.id === invoiceAId);
      expect(repairedInv.amountPaid).toBe('500.00');
      expect(repairedInv.amountDue).toBe('680.00');
      expect(repairedInv.status).toBe('PARTIALLY_PAID');
    });

    it('STAFF cannot run reconciliation (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/payments/reconciliation/run')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('8. Dual Pagination for Payments', () => {
    beforeEach(async () => {
      // Seed 5 payments
      for (let i = 1; i <= 5; i++) {
        mockPrisma._state.payments.push({
          id: `pay_page_${i}`,
          paymentReference: `PAY-${String(i).padStart(6, '0')}`,
          customerId: customerAId,
          invoiceId: invoiceAId,
          amount: '100.00',
          currency: 'INR',
          paymentMethod: 'CARD',
          status: 'SUCCEEDED',
          createdAt: new Date(`2026-02-0${i}T00:00:00Z`),
          updatedAt: new Date(`2026-02-0${i}T00:00:00Z`)
        });
      }
    });

    it('Offset pagination returns standard pagination metadata', async () => {
      const res = await request(app)
        .get('/api/v1/payments?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.total).toBe(5);
      expect(res.body.data.pagination.totalPages).toBe(3);
    });

    it('Cursor pagination returns nextCursor and fetches subsequent records', async () => {
      const res1 = await request(app)
        .get('/api/v1/payments?limit=2&cursor=')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res1.status).toBe(200);
      expect(res1.body.data.items.length).toBe(2);
      expect(res1.body.data.pagination.nextCursor).toBeDefined();

      const nextCursor = res1.body.data.pagination.nextCursor;
      const res2 = await request(app)
        .get(`/api/v1/payments?limit=2&cursor=${nextCursor}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.data.items.length).toBe(2);
      expect(res2.body.data.items[0].id).not.toBe(res1.body.data.items[0].id);
    });
  });
});
