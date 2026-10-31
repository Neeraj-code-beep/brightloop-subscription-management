import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../utils/prisma.js';

export class CreditsService {
  get prisma() {
    return getPrismaClient();
  }

  /**
   * Format a credit transaction response
   */
  formatTransaction(tx) {
    return {
      id: tx.id,
      customerId: tx.customerId,
      subscriptionId: tx.subscriptionId || null,
      invoiceId: tx.invoiceId || null,
      migrationId: tx.migrationId || null,
      type: tx.type,
      amount: new Prisma.Decimal(tx.amount).toFixed(2),
      balanceAfter: new Prisma.Decimal(tx.balanceAfter).toFixed(2),
      currency: tx.currency,
      reason: tx.reason || null,
      idempotencyKey: tx.idempotencyKey || null,
      metadata: tx.metadata || null,
      createdAt: tx.createdAt
    };
  }

  /**
   * Get customer credit balance
   */
  async getBalance(customerId) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        customerCode: true,
        companyName: true,
        firstName: true,
        lastName: true,
        email: true,
        creditBalance: true,
        currency: true
      }
    });

    if (!customer) {
      const error = new Error('Customer not found');
      error.statusCode = 404;
      throw error;
    }

    return {
      customerId: customer.id,
      customerCode: customer.customerCode,
      customerName: customer.companyName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
      email: customer.email,
      creditBalance: new Prisma.Decimal(customer.creditBalance || 0).toFixed(2),
      currency: customer.currency || 'INR'
    };
  }

  /**
   * List credit transactions with pagination
   */
  async listTransactions(customerId, { page = 1, limit = 20, type = null } = {}) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId }
    });
    if (!customer) {
      const error = new Error('Customer not found');
      error.statusCode = 404;
      throw error;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * take;

    const where = { customerId };
    if (type) {
      where.type = type;
    }

    const [total, transactions] = await Promise.all([
      this.prisma.creditTransaction.count({ where }),
      this.prisma.creditTransaction.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: {
            select: { id: true, subscriptionNumber: true }
          },
          invoice: {
            select: { id: true, invoiceNumber: true }
          }
        }
      })
    ]);

    return {
      items: transactions.map(tx => ({
        ...this.formatTransaction(tx),
        subscriptionNumber: tx.subscription?.subscriptionNumber || null,
        invoiceNumber: tx.invoice?.invoiceNumber || null
      })),
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    };
  }

  /**
   * Issue credit to customer (positive amount)
   * Must be called within a transaction or standalone.
   */
  async issueCredit({
    customerId,
    amount,
    type = 'PRORATION_CREDIT',
    reason = null,
    subscriptionId = null,
    invoiceId = null,
    migrationId = null,
    idempotencyKey = null,
    currency = null,
    metadata = null,
    tx = null
  }) {
    const client = tx || this.prisma;
    const decimalAmount = new Prisma.Decimal(amount);

    if (decimalAmount.lte(0)) {
      const error = new Error('Credit amount to issue must be strictly positive');
      error.statusCode = 400;
      throw error;
    }

    const execute = async (db) => {
      // Check idempotency
      if (idempotencyKey) {
        const existing = await db.creditTransaction.findUnique({
          where: { idempotencyKey }
        });
        if (existing) {
          return this.formatTransaction(existing);
        }
      }

      // Concurrency lock: acquire row lock where available
      if (typeof db.$queryRaw === 'function') {
        try {
          await db.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${customerId} FOR UPDATE`;
        } catch {
          // Pass-through in mock / unsupported environments
        }
      }

      // Lock and fetch current customer balance
      const customer = await db.customer.findUnique({
        where: { id: customerId }
      });
      if (!customer) {
        const error = new Error(`Customer ${customerId} not found`);
        error.statusCode = 404;
        throw error;
      }

      // Currency consistency validation
      if (customer.currency && currency && customer.currency.toUpperCase() !== currency.toUpperCase()) {
        const error = new Error(`Currency mismatch: customer currency is ${customer.currency}, but transaction currency is ${currency}`);
        error.statusCode = 400;
        throw error;
      }

      const txCurrency = currency || customer.currency || 'USD';
      const currentBalance = new Prisma.Decimal(customer.creditBalance || 0);
      const newBalance = currentBalance.plus(decimalAmount);

      // Update customer balance
      await db.customer.update({
        where: { id: customerId },
        data: { creditBalance: newBalance }
      });

      // Insert transaction ledger record
      const transaction = await db.creditTransaction.create({
        data: {
          customerId,
          subscriptionId,
          invoiceId,
          migrationId,
          type,
          amount: decimalAmount,
          balanceAfter: newBalance,
          currency: txCurrency,
          reason,
          idempotencyKey,
          metadata: metadata || {}
        }
      });

      return this.formatTransaction(transaction);
    };

    try {
      if (tx) {
        return await execute(tx);
      }
      return await this.prisma.$transaction(async (db) => execute(db));
    } catch (err) {
      if (err.code === 'P2002' && idempotencyKey && (err.meta?.target?.includes('idempotencyKey') || String(err.message).includes('idempotencyKey'))) {
        const existing = await (tx || this.prisma).creditTransaction.findUnique({
          where: { idempotencyKey }
        });
        if (existing) {
          return this.formatTransaction(existing);
        }
      }
      throw err;
    }
  }

  /**
   * Apply credit from customer balance (negative amount recorded in ledger)
   * Ensures customer balance is sufficient (no overdraft).
   */
  async applyCredit({
    customerId,
    amount,
    invoiceId = null,
    subscriptionId = null,
    migrationId = null,
    idempotencyKey = null,
    reason = 'Credit applied to invoice',
    currency = null,
    metadata = null,
    tx = null
  }) {
    const decimalAmount = new Prisma.Decimal(amount);

    if (decimalAmount.lte(0)) {
      const error = new Error('Credit amount to apply must be strictly positive');
      error.statusCode = 400;
      throw error;
    }

    const execute = async (db) => {
      // Check idempotency
      if (idempotencyKey) {
        const existing = await db.creditTransaction.findUnique({
          where: { idempotencyKey }
        });
        if (existing) {
          return this.formatTransaction(existing);
        }
      }

      // Concurrency lock: acquire row lock where available
      if (typeof db.$queryRaw === 'function') {
        try {
          await db.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${customerId} FOR UPDATE`;
        } catch {
          // Pass-through in mock / unsupported environments
        }
      }

      // Check customer credit balance
      const customer = await db.customer.findUnique({
        where: { id: customerId }
      });
      if (!customer) {
        const error = new Error(`Customer ${customerId} not found`);
        error.statusCode = 404;
        throw error;
      }

      // Currency consistency validation
      if (customer.currency && currency && customer.currency.toUpperCase() !== currency.toUpperCase()) {
        const error = new Error(`Currency mismatch: customer currency is ${customer.currency}, but transaction currency is ${currency}`);
        error.statusCode = 400;
        throw error;
      }

      const txCurrency = currency || customer.currency || 'USD';
      const currentBalance = new Prisma.Decimal(customer.creditBalance || 0);
      if (currentBalance.lt(decimalAmount)) {
        const error = new Error(`Insufficient customer credit balance. Available: ${currentBalance.toFixed(2)}, Requested: ${decimalAmount.toFixed(2)}`);
        error.statusCode = 400;
        throw error;
      }

      const newBalance = currentBalance.minus(decimalAmount);

      // Update customer cached credit balance
      await db.customer.update({
        where: { id: customerId },
        data: { creditBalance: newBalance }
      });

      // Record negative transaction in immutable ledger
      const transaction = await db.creditTransaction.create({
        data: {
          customerId,
          subscriptionId,
          invoiceId,
          migrationId,
          type: 'INVOICE_APPLICATION',
          amount: decimalAmount.negated(),
          balanceAfter: newBalance,
          currency: txCurrency,
          reason,
          idempotencyKey,
          metadata: metadata || {}
        }
      });

      return this.formatTransaction(transaction);
    };

    try {
      if (tx) {
        return await execute(tx);
      }
      return await this.prisma.$transaction(async (db) => execute(db));
    } catch (err) {
      if (err.code === 'P2002' && idempotencyKey && (err.meta?.target?.includes('idempotencyKey') || String(err.message).includes('idempotencyKey'))) {
        const existing = await (tx || this.prisma).creditTransaction.findUnique({
          where: { idempotencyKey }
        });
        if (existing) {
          return this.formatTransaction(existing);
        }
      }
      throw err;
    }
  }

  /**
   * Admin manual adjustment (can be positive to grant or negative to deduct)
   */
  async adjustBalance({ customerId, amount, reason, idempotencyKey = null, adminUserId = null }) {
    const decimalAmount = new Prisma.Decimal(amount);

    if (decimalAmount.eq(0)) {
      const error = new Error('Adjustment amount cannot be zero');
      error.statusCode = 400;
      throw error;
    }

    return this.prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.creditTransaction.findUnique({
          where: { idempotencyKey }
        });
        if (existing) {
          return this.formatTransaction(existing);
        }
      }

      const customer = await tx.customer.findUnique({
        where: { id: customerId }
      });
      if (!customer) {
        const error = new Error('Customer not found');
        error.statusCode = 404;
        throw error;
      }

      const currentBalance = new Prisma.Decimal(customer.creditBalance || 0);
      const newBalance = currentBalance.plus(decimalAmount);

      if (newBalance.lt(0)) {
        const error = new Error(`Cannot adjust balance below zero. Current balance: ${currentBalance.toFixed(2)}, Adjustment: ${decimalAmount.toFixed(2)}`);
        error.statusCode = 400;
        throw error;
      }

      await tx.customer.update({
        where: { id: customerId },
        data: { creditBalance: newBalance }
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          customerId,
          type: 'MANUAL_ADJUSTMENT',
          amount: decimalAmount,
          balanceAfter: newBalance,
          currency: customer.currency || 'INR',
          reason: reason || (decimalAmount.gt(0) ? 'Admin credit addition' : 'Admin credit deduction'),
          idempotencyKey,
          metadata: {
            adminUserId,
            adjustedAt: new Date().toISOString()
          }
        }
      });

      return {
        customer: {
          id: customer.id,
          creditBalance: newBalance.toFixed(2),
          currency: customer.currency || 'INR'
        },
        transaction: this.formatTransaction(transaction)
      };
    });
  }
}

export const creditsService = new CreditsService();

