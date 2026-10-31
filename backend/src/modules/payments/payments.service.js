import { Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../utils/prisma.js';
import { paginate, parsePaginationParams } from '../../utils/pagination.js';
import { razorpayAdapter } from './gateways/razorpay.adapter.js';

export const VALID_PAYMENT_METHODS = [
  'CASH',
  'BANK_TRANSFER',
  'UPI',
  'CARD',
  'OTHER',
  'MANUAL',
  'CREDIT_CARD',
  'ACH'
];

export const VALID_PAYMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'PARTIALLY_REFUNDED',
  'REFUNDED'
];

export class PaymentsService {
  constructor(prismaClient = defaultPrisma) {
    this.prisma = prismaClient;
  }

  /**
   * Generate sequential unique payment reference e.g. PAY-000001
   * Queries highest existing numeric paymentReference and increments.
   * Does NOT rely on counting existing payments.
   */
  async generatePaymentReference(tx) {
    const db = tx || this.prisma;
    const lastPayment = await db.payment.findFirst({
      where: {
        paymentReference: { startsWith: 'PAY-' }
      },
      orderBy: { paymentReference: 'desc' },
      select: { paymentReference: true }
    });

    let nextNumber = 1;
    if (lastPayment?.paymentReference) {
      const match = lastPayment.paymentReference.match(/^PAY-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `PAY-${String(nextNumber).padStart(6, '0')}`;
  }

  /**
   * Generate sequential unique refund reference e.g. REF-000001
   */
  async generateRefundReference(tx) {
    const db = tx || this.prisma;
    const lastRefund = await db.refund.findFirst({
      where: {
        refundReference: { startsWith: 'REF-' }
      },
      orderBy: { refundReference: 'desc' },
      select: { refundReference: true }
    });

    let nextNumber = 1;
    if (lastRefund?.refundReference) {
      const match = lastRefund.refundReference.match(/^REF-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `REF-${String(nextNumber).padStart(6, '0')}`;
  }

  /**
   * Format payment for API response: convert Decimals to strings, null-safe.
   */
  formatPaymentResponse(payment) {
    if (!payment) return null;

    const amount = new Prisma.Decimal(payment.amount || 0);

    return {
      id: payment.id,
      paymentReference: payment.paymentReference,
      customerId: payment.customerId,
      customer: payment.customer ? {
        id: payment.customer.id,
        customerCode: payment.customer.customerCode,
        companyName: payment.customer.companyName,
        firstName: payment.customer.firstName,
        lastName: payment.customer.lastName,
        email: payment.customer.email
      } : null,
      invoiceId: payment.invoiceId,
      invoice: payment.invoice ? {
        id: payment.invoice.id,
        invoiceNumber: payment.invoice.invoiceNumber,
        status: payment.invoice.status,
        totalAmount: payment.invoice.totalAmount ? new Prisma.Decimal(payment.invoice.totalAmount).toFixed(2) : '0.00',
        amountPaid: payment.invoice.amountPaid ? new Prisma.Decimal(payment.invoice.amountPaid).toFixed(2) : '0.00',
        amountDue: payment.invoice.amountDue ? new Prisma.Decimal(payment.invoice.amountDue).toFixed(2) : '0.00'
      } : null,
      paymentMethod: payment.paymentMethod,
      provider: payment.provider,
      providerTransactionId: payment.providerTransactionId || null,
      transactionReference: payment.transactionReference || null,
      amount: amount.toFixed(2),
      amountInCents: payment.amountInCents || Math.round(amount.toNumber() * 100),
      currency: payment.currency,
      status: payment.status,
      paymentDate: payment.paymentDate,
      paidAt: payment.paidAt || null,
      failureReason: payment.failureReason || null,
      idempotencyKey: payment.idempotencyKey || null,
      metadata: payment.metadata || null,
      refunds: (payment.refunds || []).map(r => this.formatRefundResponse(r)),
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    };
  }

  /**
   * Format refund for API response.
   */
  formatRefundResponse(refund) {
    if (!refund) return null;

    const amount = new Prisma.Decimal(refund.amount || 0);

    return {
      id: refund.id,
      refundReference: refund.refundReference,
      paymentId: refund.paymentId,
      amount: amount.toFixed(2),
      amountInCents: refund.amountInCents || Math.round(amount.toNumber() * 100),
      currency: refund.currency,
      reason: refund.reason || null,
      status: refund.status,
      providerRefundId: refund.providerRefundId || null,
      idempotencyKey: refund.idempotencyKey || null,
      metadata: refund.metadata || null,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt
    };
  }

  /**
   * Record a manual payment against an invoice.
   * Atomically updates invoice amountPaid, amountDue, and invoice status.
   */
  async recordManualPayment(data) {
    // 1. Idempotency Check
    if (data.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        include: {
          customer: true,
          invoice: true,
          refunds: true
        }
      });
      if (existing) {
        return {
          payment: this.formatPaymentResponse(existing),
          isDuplicate: true,
          message: 'Payment already recorded with this idempotency key.'
        };
      }
    }

    // 2. Fetch and validate invoice
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: data.invoiceId },
      include: { customer: true }
    });

    if (!invoice) {
      const error = new Error(`Invoice with ID '${data.invoiceId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const payableStatuses = ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE', 'OPEN'];
    if (!payableStatuses.includes(invoice.status)) {
      const error = new Error(`Cannot record payment for invoice with status '${invoice.status}'. Invoice must be in an issued or payable state.`);
      error.statusCode = 400;
      throw error;
    }

    const invoiceAmountDue = new Prisma.Decimal(invoice.amountDue || 0);
    if (invoiceAmountDue.lte(0)) {
      const error = new Error('Invoice is already fully paid. No outstanding balance remains.');
      error.statusCode = 400;
      throw error;
    }

    // Customer match check
    const customerId = data.customerId || invoice.customerId;
    if (customerId !== invoice.customerId) {
      const error = new Error('Customer ID does not match the invoice customer.');
      error.statusCode = 400;
      throw error;
    }

    // Currency check
    if (data.currency && data.currency !== invoice.currency) {
      const error = new Error(`Payment currency '${data.currency}' does not match invoice currency '${invoice.currency}'.`);
      error.statusCode = 400;
      throw error;
    }

    // Amount check
    const paymentAmount = new Prisma.Decimal(data.amount);
    if (paymentAmount.lte(0)) {
      const error = new Error('Payment amount must be greater than zero.');
      error.statusCode = 400;
      throw error;
    }

    if (paymentAmount.gt(invoiceAmountDue)) {
      const error = new Error(`Payment amount (${paymentAmount.toFixed(2)}) exceeds remaining invoice balance (${invoiceAmountDue.toFixed(2)}).`);
      error.statusCode = 400;
      throw error;
    }

    const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();

    // 3. Transactional update
    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const paymentReference = await this.generatePaymentReference(tx);

          // Create Payment record
          const payment = await tx.payment.create({
            data: {
              paymentReference,
              customerId,
              invoiceId: invoice.id,
              paymentMethod: data.paymentMethod || 'MANUAL',
              provider: data.provider || 'MANUAL',
              providerTransactionId: data.providerTransactionId || null,
              transactionReference: data.transactionReference || null,
              amount: paymentAmount,
              amountInCents: Math.round(paymentAmount.toNumber() * 100),
              currency: invoice.currency,
              status: 'SUCCEEDED',
              paymentDate,
              paidAt: paymentDate,
              idempotencyKey: data.idempotencyKey || null,
              metadata: data.metadata || {}
            },
            include: {
              customer: true,
              invoice: true,
              refunds: true
            }
          });

          // Calculate new invoice balance
          const currentAmountPaid = new Prisma.Decimal(invoice.amountPaid || 0);
          const newAmountPaid = currentAmountPaid.plus(paymentAmount);
          const invoiceTotal = new Prisma.Decimal(invoice.totalAmount);
          const newAmountDue = Prisma.Decimal.max(0, invoiceTotal.minus(newAmountPaid));
          const newStatus = newAmountDue.lte(0) ? 'PAID' : 'PARTIALLY_PAID';

          const invoiceUpdate = {
            amountPaid: newAmountPaid.toFixed(2),
            amountDue: newAmountDue.toFixed(2),
            amountPaidInCents: Math.round(newAmountPaid.toNumber() * 100),
            amountDueInCents: Math.round(newAmountDue.toNumber() * 100),
            status: newStatus
          };

          if (newStatus === 'PAID') {
            invoiceUpdate.paidAt = paymentDate;
          }

          const updatedInvoice = await tx.invoice.update({
            where: { id: invoice.id },
            data: invoiceUpdate
          });

          return { payment: { ...payment, invoice: updatedInvoice }, isDuplicate: false };
        });

        return {
          payment: this.formatPaymentResponse(result.payment),
          isDuplicate: false
        };
      } catch (err) {
        if (
          attempts < 5 &&
          (err.code === 'P2002' && err.message?.includes('paymentReference'))
        ) {
          continue; // Retry with next payment reference
        }
        throw err;
      }
    }
  }

  /**
   * Mark a payment as failed.
   */
  async recordFailedPayment(paymentId, data) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { customer: true, invoice: true }
    });

    if (!payment) {
      const error = new Error(`Payment with ID '${paymentId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (payment.status === 'SUCCEEDED') {
      const error = new Error('Cannot mark a succeeded payment as failed. Use refund instead.');
      error.statusCode = 400;
      throw error;
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'FAILED',
        failureReason: data.failureReason || 'Payment failed or declined'
      },
      include: { customer: true, invoice: true, refunds: true }
    });

    return this.formatPaymentResponse(updated);
  }

  /**
   * Process a full or partial refund against a succeeded payment.
   * Atomically creates Refund record and reverses invoice balances.
   */
  async processRefund(paymentId, data) {
    // 1. Idempotency Check
    if (data.idempotencyKey) {
      const existing = await this.prisma.refund.findUnique({
        where: { idempotencyKey: data.idempotencyKey }
      });
      if (existing) {
        const paymentRecord = await this.prisma.payment.findUnique({
          where: { id: paymentId },
          include: { customer: true, invoice: true, refunds: true }
        });
        return {
          refund: this.formatRefundResponse(existing),
          payment: paymentRecord ? this.formatPaymentResponse(paymentRecord) : null,
          isDuplicate: true,
          isIdempotentReplay: true,
          message: 'Refund already processed with this idempotency key.'
        };
      }
    }

    // 2. Fetch Payment and related records
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: true,
        refunds: true
      }
    });

    if (!payment) {
      const error = new Error(`Payment with ID '${paymentId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const refundableStatuses = ['SUCCEEDED', 'PARTIALLY_REFUNDED'];
    if (!refundableStatuses.includes(payment.status)) {
      const error = new Error(`Cannot refund payment with status '${payment.status}'. Only SUCCEEDED or PARTIALLY_REFUNDED payments can be refunded.`);
      error.statusCode = 400;
      throw error;
    }

    const refundAmount = new Prisma.Decimal(data.amount);
    if (refundAmount.lte(0)) {
      const error = new Error('Refund amount must be greater than zero.');
      error.statusCode = 400;
      throw error;
    }

    // Calculate sum of prior succeeded refunds
    const priorRefunded = (payment.refunds || [])
      .filter(r => r.status === 'SUCCEEDED')
      .reduce((acc, r) => acc.plus(new Prisma.Decimal(r.amount)), new Prisma.Decimal(0));

    const paymentAmount = new Prisma.Decimal(payment.amount);
    const availableToRefund = paymentAmount.minus(priorRefunded);

    if (refundAmount.gt(availableToRefund)) {
      const error = new Error(`Refund amount (${refundAmount.toFixed(2)}) exceeds available refundable balance (${availableToRefund.toFixed(2)}). Total payment was ${paymentAmount.toFixed(2)}.`);
      error.statusCode = 400;
      throw error;
    }

    // 3. Transactional update
    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const refundReference = await this.generateRefundReference(tx);

          // Create Refund record
          const refund = await tx.refund.create({
            data: {
              refundReference,
              paymentId: payment.id,
              amount: refundAmount,
              amountInCents: Math.round(refundAmount.toNumber() * 100),
              currency: payment.currency,
              reason: data.reason || 'Requested refund',
              status: 'SUCCEEDED',
              providerRefundId: data.providerRefundId || null,
              idempotencyKey: data.idempotencyKey || null,
              metadata: data.metadata || {}
            }
          });

          // Update Payment status
          const newTotalRefunded = priorRefunded.plus(refundAmount);
          const paymentStatus = newTotalRefunded.gte(paymentAmount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

          const updatedPayment = await tx.payment.update({
            where: { id: payment.id },
            data: { status: paymentStatus },
            include: { customer: true, invoice: true, refunds: true }
          });

          // Reverse Invoice balance
          const invoice = payment.invoice;
          if (invoice) {
            const currentAmountPaid = new Prisma.Decimal(invoice.amountPaid || 0);
            const newInvoiceAmountPaid = Prisma.Decimal.max(0, currentAmountPaid.minus(refundAmount));
            const invoiceTotal = new Prisma.Decimal(invoice.totalAmount);
            const newInvoiceAmountDue = invoiceTotal.minus(newInvoiceAmountPaid);

            let newInvoiceStatus;
            if (newInvoiceAmountPaid.eq(0)) {
              // Completely unpaid: check if overdue
              const isPastDue = invoice.dueDate && new Date(invoice.dueDate).getTime() < Date.now();
              newInvoiceStatus = isPastDue ? 'OVERDUE' : 'ISSUED';
            } else {
              newInvoiceStatus = 'PARTIALLY_PAID';
            }

            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                amountPaid: newInvoiceAmountPaid.toFixed(2),
                amountDue: newInvoiceAmountDue.toFixed(2),
                amountPaidInCents: Math.round(newInvoiceAmountPaid.toNumber() * 100),
                amountDueInCents: Math.round(newInvoiceAmountDue.toNumber() * 100),
                status: newInvoiceStatus
              }
            });
          }

          return { refund, payment: updatedPayment };
        });

        return {
          refund: this.formatRefundResponse(result.refund),
          payment: this.formatPaymentResponse(result.payment),
          isDuplicate: false
        };
      } catch (err) {
        if (
          attempts < 5 &&
          (err.code === 'P2002' && err.message?.includes('refundReference'))
        ) {
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * List payments with dual pagination, search, and multi-field filtering.
   */
  async listPayments(params) {
    const {
      user,
      customerId,
      invoiceId,
      status,
      paymentMethod,
      provider,
      startDate,
      endDate,
      search,
      page,
      limit,
      cursor,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = params;

    const where = {};

    // Customer role isolation
    if (user && user.role === 'CUSTOMER') {
      where.customerId = user.customerId;
    } else if (customerId) {
      where.customerId = customerId;
    }

    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    if (status) {
      where.status = status;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (provider) {
      where.provider = provider;
    }

    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { paymentReference: { contains: search, mode: 'insensitive' } },
        { transactionReference: { contains: search, mode: 'insensitive' } },
        { providerTransactionId: { contains: search, mode: 'insensitive' } }
      ];
    }

    const paginationParams = parsePaginationParams(params);

    const result = await paginate({
      modelDelegate: this.prisma.payment,
      where,
      include: {
        customer: true,
        invoice: true,
        refunds: true
      },
      paginationParams,
      sortBy,
      sortOrder
    });

    return {
      items: result.items.map(item => this.formatPaymentResponse(item)),
      pagination: result.pagination
    };
  }

  /**
   * Get payment details by ID.
   */
  async getPaymentById(id, user) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        customer: true,
        invoice: true,
        refunds: true
      }
    });

    if (!payment) {
      const error = new Error(`Payment with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (user && user.role === 'CUSTOMER' && payment.customerId !== user.customerId) {
      const error = new Error('Access denied: you do not own this payment record.');
      error.statusCode = 403;
      throw error;
    }

    return this.formatPaymentResponse(payment);
  }

  /**
   * Get payments for a specific invoice.
   */
  async getInvoicePayments(invoiceId, user) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      const error = new Error(`Invoice with ID '${invoiceId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (user && user.role === 'CUSTOMER' && invoice.customerId !== user.customerId) {
      const error = new Error('Access denied: you do not own this invoice.');
      error.statusCode = 403;
      throw error;
    }

    const payments = await this.prisma.payment.findMany({
      where: { invoiceId },
      include: { customer: true, refunds: true },
      orderBy: { createdAt: 'desc' }
    });

    return payments.map(p => this.formatPaymentResponse(p));
  }

  /**
   * Process incoming Webhook from payment provider (e.g. Razorpay).
   */
  async processWebhook(provider, rawBody, headers, parsedBody) {
    const normProvider = String(provider).toUpperCase();

    if (normProvider === 'RAZORPAY') {
      const signature = headers['x-razorpay-signature'];
      if (!signature) {
        const error = new Error('Missing x-razorpay-signature webhook header.');
        error.statusCode = 400;
        throw error;
      }

      // If webhook secret configured, verify signature
      if (razorpayAdapter.isWebhookConfigured()) {
        const isValid = razorpayAdapter.verifyWebhookSignature(rawBody, signature);
        if (!isValid) {
          const error = new Error('Invalid Razorpay webhook signature.');
          error.statusCode = 400;
          throw error;
        }
      }

      const eventPayload = parsedBody || JSON.parse(rawBody.toString('utf8'));
      const eventType = eventPayload.event;
      const eventId = eventPayload.event_id || eventPayload.id || headers['x-razorpay-event-id'] || `rzp_${Date.now()}`;

      // Idempotency check on WebhookEvent
      const existingEvent = await this.prisma.webhookEvent.findUnique({
        where: { eventId }
      });

      if (existingEvent) {
        return {
          status: 'already_processed',
          eventId,
          message: 'Webhook event was already processed (idempotent result).'
        };
      }

      // Process event
      let processingResult = { status: 'handled' };
      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        const entity = eventPayload.payload?.payment?.entity || eventPayload.payload?.order?.entity;
        const providerTxId = entity?.id;
        const notes = entity?.notes || {};
        const invoiceId = notes.invoiceId;
        const amount = entity?.amount ? (entity.amount / 100).toFixed(2) : null;

        if (invoiceId && amount) {
          await this.recordManualPayment({
            invoiceId,
            amount,
            currency: entity.currency || 'INR',
            paymentMethod: 'UPI',
            provider: 'RAZORPAY',
            providerTransactionId: providerTxId,
            idempotencyKey: `webhook_${eventId}`
          }).catch(err => {
            console.error('[Webhook] Error recording captured payment:', err.message);
          });
        }
      } else if (eventType === 'payment.failed') {
        const entity = eventPayload.payload?.payment?.entity;
        const providerTxId = entity?.id;
        const payment = await this.prisma.payment.findFirst({
          where: { providerTransactionId: providerTxId }
        });
        if (payment) {
          await this.recordFailedPayment(payment.id, {
            failureReason: entity?.error_description || 'Payment failed via gateway'
          }).catch(err => console.error('[Webhook] Error updating failed payment:', err.message));
        }
      }

      // Record processed event
      await this.prisma.webhookEvent.create({
        data: {
          provider: normProvider,
          eventId,
          eventType: eventType || 'unknown',
          status: 'PROCESSED',
          payload: eventPayload
        }
      });

      return {
        status: 'success',
        eventId,
        eventType,
        ...processingResult
      };
    }

    const error = new Error(`Unsupported payment provider '${provider}'.`);
    error.statusCode = 400;
    throw error;
  }

  /**
   * Reconciliation: Summary of system-wide payment vs invoice consistency.
   */
  async getReconciliationSummary() {
    const [payments, invoices, refunds] = await Promise.all([
      this.prisma.payment.findMany({
        select: {
          id: true,
          amount: true,
          status: true,
          invoiceId: true
        }
      }),
      this.prisma.invoice.findMany({
        select: {
          id: true,
          status: true,
          totalAmount: true,
          amountPaid: true,
          amountDue: true
        }
      }),
      this.prisma.refund.findMany({
        select: {
          id: true,
          amount: true,
          status: true
        }
      })
    ]);

    let totalRecordedPayments = new Prisma.Decimal(0);
    let totalSucceededPayments = new Prisma.Decimal(0);
    let totalFailedPayments = new Prisma.Decimal(0);
    let succeededCount = 0;
    let failedCount = 0;

    for (const p of payments) {
      const pAmt = new Prisma.Decimal(p.amount || 0);
      totalRecordedPayments = totalRecordedPayments.plus(pAmt);
      if (p.status === 'SUCCEEDED') {
        totalSucceededPayments = totalSucceededPayments.plus(pAmt);
        succeededCount++;
      } else if (p.status === 'FAILED') {
        totalFailedPayments = totalFailedPayments.plus(pAmt);
        failedCount++;
      }
    }

    let totalRefunded = new Prisma.Decimal(0);
    for (const r of refunds) {
      if (r.status === 'SUCCEEDED') {
        totalRefunded = totalRefunded.plus(new Prisma.Decimal(r.amount || 0));
      }
    }

    // Identify discrepancies across invoices
    let mismatchedInvoicesCount = 0;
    for (const inv of invoices) {
      const total = new Prisma.Decimal(inv.totalAmount || 0);
      const paid = new Prisma.Decimal(inv.amountPaid || 0);
      const due = new Prisma.Decimal(inv.amountDue || 0);

      // Rule: paid + due should equal total
      if (!paid.plus(due).eq(total)) {
        mismatchedInvoicesCount++;
      }
    }

    return {
      totalPaymentsCount: payments.length,
      succeededPaymentsCount: succeededCount,
      failedPaymentsCount: failedCount,
      totalCollected: totalSucceededPayments.toFixed(2),
      totalRecordedAmount: totalRecordedPayments.toFixed(2),
      totalSucceededAmount: totalSucceededPayments.toFixed(2),
      totalFailedAmount: totalFailedPayments.toFixed(2),
      totalRefunded: totalRefunded.toFixed(2),
      totalRefundedAmount: totalRefunded.toFixed(2),
      totalInvoicesAudited: invoices.length,
      mismatchedInvoicesCount,
      hasDiscrepancies: mismatchedInvoicesCount > 0,
      isReconciled: mismatchedInvoicesCount === 0
    };
  }

  /**
   * Reconciliation: List unmatched payments and balance inconsistencies.
   */
  async getUnmatchedPayments() {
    const payments = await this.prisma.payment.findMany({
      include: { invoice: true }
    });

    const unmatched = [];
    for (const p of payments) {
      if (!p.invoice) {
        unmatched.push({
          paymentId: p.id,
          paymentReference: p.paymentReference,
          amount: new Prisma.Decimal(p.amount).toFixed(2),
          issue: 'ORPHAN_PAYMENT_NO_INVOICE'
        });
      } else if (p.status === 'SUCCEEDED') {
        const invPaid = new Prisma.Decimal(p.invoice.amountPaid || 0);
        if (invPaid.lte(0)) {
          unmatched.push({
            paymentId: p.id,
            paymentReference: p.paymentReference,
            invoiceId: p.invoiceId,
            amount: new Prisma.Decimal(p.amount).toFixed(2),
            issue: 'SUCCEEDED_PAYMENT_NOT_REFLECTED_IN_INVOICE'
          });
        }
      }
    }

    // Also audit invoice discrepancies against payment sums
    const invoices = await this.prisma.invoice.findMany({
      include: {
        payments: {
          where: { status: 'SUCCEEDED' }
        }
      }
    });

    for (const inv of invoices) {
      const succeededSum = (inv.payments || []).reduce(
        (acc, p) => acc.plus(new Prisma.Decimal(p.amount || 0)),
        new Prisma.Decimal(0)
      );
      const paid = new Prisma.Decimal(inv.amountPaid || 0);
      const due = new Prisma.Decimal(inv.amountDue || 0);
      const total = new Prisma.Decimal(inv.totalAmount || 0);

      if (!succeededSum.eq(paid) || !paid.plus(due).eq(total)) {
        unmatched.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          recordedPaid: paid.toFixed(2),
          expectedPaid: succeededSum.toFixed(2),
          issue: 'INVOICE_BALANCE_MISMATCH'
        });
      }
    }

    return {
      unmatchedCount: unmatched.length,
      items: unmatched,
      invoiceBalanceMismatches: unmatched
    };
  }

  /**
   * Run reconciliation sweep and fix drifted balances atomically (ADMIN only).
   */
  async runReconciliation() {
    const invoices = await this.prisma.invoice.findMany({
      include: {
        payments: true
      }
    });

    let correctedCount = 0;
    const discrepancies = [];

    for (const inv of invoices) {
      const succeededPaymentsSum = (inv.payments || [])
        .filter(p => p.status === 'SUCCEEDED')
        .reduce((acc, p) => acc.plus(new Prisma.Decimal(p.amount || 0)), new Prisma.Decimal(0));

      const total = new Prisma.Decimal(inv.totalAmount || 0);
      const expectedDue = Prisma.Decimal.max(0, total.minus(succeededPaymentsSum));

      const currentPaid = new Prisma.Decimal(inv.amountPaid || 0);
      const currentDue = new Prisma.Decimal(inv.amountDue || 0);

      if (!currentPaid.eq(succeededPaymentsSum) || !currentDue.eq(expectedDue)) {
        discrepancies.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          oldPaid: currentPaid.toFixed(2),
          newPaid: succeededPaymentsSum.toFixed(2),
          oldDue: currentDue.toFixed(2),
          newDue: expectedDue.toFixed(2)
        });

        const newStatus = expectedDue.lte(0)
          ? 'PAID'
          : (succeededPaymentsSum.gt(0) ? 'PARTIALLY_PAID' : inv.status);

        await this.prisma.invoice.update({
          where: { id: inv.id },
          data: {
            amountPaid: succeededPaymentsSum.toFixed(2),
            amountDue: expectedDue.toFixed(2),
            amountPaidInCents: Math.round(succeededPaymentsSum.toNumber() * 100),
            amountDueInCents: Math.round(expectedDue.toNumber() * 100),
            status: newStatus
          }
        });

        correctedCount++;
      }
    }

    return {
      auditedInvoices: invoices.length,
      correctedCount,
      fixedCount: correctedCount,
      discrepancies
    };
  }
}

export const paymentsService = new PaymentsService();
