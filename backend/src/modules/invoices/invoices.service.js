import { Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../utils/prisma.js';
import { paginate, parsePaginationParams } from '../../utils/pagination.js';

export const VALID_INVOICE_STATUSES = [
  'DRAFT',
  'ISSUED',
  'OPEN',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'UNCOLLECTIBLE',
  'VOID'
];

export const PAYMENT_TERMS_DAYS = {
  IMMEDIATE: 0,
  NET_7: 7,
  NET_15: 15,
  NET_30: 30
};

export class InvoicesService {
  constructor(prismaClient = defaultPrisma) {
    this.prisma = prismaClient;
  }

  /**
   * Calculate due date based on invoiceDate and payment terms or custom days.
   */
  calculateDueDate(invoiceDate, paymentTerms = 'NET_15') {
    const baseDate = new Date(invoiceDate || Date.now());
    const days = typeof paymentTerms === 'number'
      ? paymentTerms
      : (PAYMENT_TERMS_DAYS[paymentTerms] !== undefined ? PAYMENT_TERMS_DAYS[paymentTerms] : 15);
    const dueDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    return dueDate;
  }

  /**
   * Generate sequential unique invoice number e.g. INV-000001
   * Queries highest existing numeric invoiceNumber and increments.
   * Does NOT rely on counting existing invoices.
   */
  async generateInvoiceNumber(tx) {
    const db = tx || this.prisma;
    const candidates = await db.invoice.findMany({
      where: {
        invoiceNumber: { startsWith: 'INV-' }
      },
      select: { invoiceNumber: true }
    });

    let maxNumber = 0;
    for (const inv of candidates) {
      const match = inv.invoiceNumber?.match(/^INV-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }

    let nextNumber = maxNumber + 1;
    while (true) {
      const candidateStr = `INV-${String(nextNumber).padStart(6, '0')}`;
      const exists = await db.invoice.findUnique({
        where: { invoiceNumber: candidateStr },
        select: { id: true }
      });
      if (!exists) {
        return candidateStr;
      }
      nextNumber++;
    }
  }

  /**
   * Format invoice for API response: convert Decimals to strings, null-safe.
   */
  formatInvoiceResponse(invoice) {
    if (!invoice) return null;

    const subtotal = new Prisma.Decimal(invoice.subtotal || 0);
    const discountAmount = new Prisma.Decimal(invoice.discountAmount || 0);
    const taxAmount = new Prisma.Decimal(invoice.taxAmount || 0);
    const totalAmount = new Prisma.Decimal(invoice.totalAmount || 0);
    const amountPaid = new Prisma.Decimal(invoice.amountPaid || 0);
    const amountDue = new Prisma.Decimal(invoice.amountDue !== undefined ? invoice.amountDue : totalAmount.minus(amountPaid));

    const isOverdue = invoice.status === 'OVERDUE' || (
      ['ISSUED', 'PARTIALLY_PAID', 'OPEN'].includes(invoice.status) &&
      invoice.dueDate &&
      new Date(invoice.dueDate).getTime() < Date.now() &&
      amountDue.gt(0)
    );

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customer: invoice.customer ? {
        id: invoice.customer.id,
        customerCode: invoice.customer.customerCode,
        companyName: invoice.customer.companyName,
        firstName: invoice.customer.firstName,
        lastName: invoice.customer.lastName,
        email: invoice.customer.email,
        customerType: invoice.customer.customerType
      } : null,
      subscriptionId: invoice.subscriptionId || null,
      subscription: invoice.subscription ? {
        id: invoice.subscription.id,
        subscriptionNumber: invoice.subscription.subscriptionNumber,
        status: invoice.subscription.status,
        billingCycle: invoice.subscription.billingCycle
      } : null,
      status: invoice.status,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      periodStart: invoice.periodStart || null,
      periodEnd: invoice.periodEnd || null,
      currency: invoice.currency,
      subtotal: subtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      amountDue: amountDue.toFixed(2),
      subtotalInCents: invoice.subtotalInCents || Math.round(subtotal.toNumber() * 100),
      discountInCents: invoice.discountInCents || Math.round(discountAmount.toNumber() * 100),
      taxInCents: invoice.taxInCents || Math.round(taxAmount.toNumber() * 100),
      totalInCents: invoice.totalInCents || Math.round(totalAmount.toNumber() * 100),
      amountPaidInCents: invoice.amountPaidInCents || Math.round(amountPaid.toNumber() * 100),
      amountDueInCents: invoice.amountDueInCents || Math.round(amountDue.toNumber() * 100),
      notes: invoice.notes || null,
      termsAndConditions: invoice.termsAndConditions || null,
      issuedAt: invoice.issuedAt || null,
      voidedAt: invoice.voidedAt || null,
      paidAt: invoice.paidAt || null,
      pdfUrl: invoice.pdfUrl || null,
      metadata: invoice.metadata || null,
      isOverdue,
      items: (invoice.items || []).map(item => {
        const itemUnitPrice = new Prisma.Decimal(item.unitPrice || 0);
        const itemDiscount = new Prisma.Decimal(item.discountAmount || 0);
        const itemTaxRate = new Prisma.Decimal(item.taxRate || 0);
        const itemTaxAmount = new Prisma.Decimal(item.taxAmount || 0);
        const itemLineSubtotal = new Prisma.Decimal(item.lineSubtotal || itemUnitPrice.mul(item.quantity || 1));
        const itemLineTotal = new Prisma.Decimal(item.lineTotal || itemLineSubtotal.minus(itemDiscount).plus(itemTaxAmount));

        return {
          id: item.id,
          invoiceId: item.invoiceId,
          productId: item.productId || null,
          product: item.product ? {
            id: item.product.id,
            name: item.product.name,
            slug: item.product.slug
          } : null,
          planId: item.planId || null,
          plan: item.plan ? {
            id: item.plan.id,
            name: item.plan.name,
            billingCycle: item.plan.billingCycle
          } : null,
          subscriptionItemId: item.subscriptionItemId || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: itemUnitPrice.toFixed(2),
          discountAmount: itemDiscount.toFixed(2),
          taxRate: itemTaxRate.toFixed(2),
          taxAmount: itemTaxAmount.toFixed(2),
          lineSubtotal: itemLineSubtotal.toFixed(2),
          lineTotal: itemLineTotal.toFixed(2),
          taxId: item.taxId || null,
          unitPriceInCents: item.unitPriceInCents || Math.round(itemUnitPrice.toNumber() * 100),
          totalInCents: item.totalInCents || Math.round(itemLineTotal.toNumber() * 100),
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        };
      }),
      payments: invoice.payments || [],
      creditTransactions: (invoice.creditTransactions || []).map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: new Prisma.Decimal(tx.amount || 0).toFixed(2),
        balanceAfter: new Prisma.Decimal(tx.balanceAfter || 0).toFixed(2),
        currency: tx.currency,
        reason: tx.reason || null,
        createdAt: tx.createdAt
      })),
      creditsApplied: (invoice.creditTransactions || [])
        .filter(c => c.type === 'INVOICE_APPLICATION')
        .reduce((acc, c) => acc.plus(new Prisma.Decimal(c.amount || 0).abs()), new Prisma.Decimal(0))
        .toFixed(2),
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt
    };
  }

  /**
   * Process and calculate line items with authoritative server logic.
   */
  async processInvoiceItems(items) {
    if (!items || items.length === 0) {
      const error = new Error('Invoice must have at least one line item.');
      error.statusCode = 400;
      throw error;
    }

    let subtotal = new Prisma.Decimal(0);
    let totalDiscount = new Prisma.Decimal(0);
    let totalTax = new Prisma.Decimal(0);
    let grandTotal = new Prisma.Decimal(0);
    const processedItems = [];

    for (const item of items) {
      const qty = parseInt(item.quantity, 10) || 1;
      if (qty <= 0) {
        const error = new Error('Item quantity must be a positive integer.');
        error.statusCode = 400;
        throw error;
      }

      const unitPrice = new Prisma.Decimal(item.unitPrice || 0);
      if (unitPrice.isNegative()) {
        const error = new Error('Unit price cannot be negative.');
        error.statusCode = 400;
        throw error;
      }

      // Check product relationship if provided
      if (item.productId) {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId }
        });
        if (!product) {
          const error = new Error(`Product with ID '${item.productId}' not found.`);
          error.statusCode = 404;
          throw error;
        }
      }

      // Check plan relationship if provided
      if (item.planId) {
        const plan = await this.prisma.plan.findUnique({
          where: { id: item.planId }
        });
        if (!plan) {
          const error = new Error(`Plan with ID '${item.planId}' not found.`);
          error.statusCode = 404;
          throw error;
        }
        if (item.productId && plan.productId !== item.productId) {
          const error = new Error(`Plan '${plan.name}' does not belong to product ID '${item.productId}'.`);
          error.statusCode = 400;
          throw error;
        }
      }

      // Calculate line subtotal
      const lineSubtotal = unitPrice.mul(qty);

      // Calculate discount
      let itemDiscount = new Prisma.Decimal(item.discountAmount || 0);
      if (item.discountId) {
        const discount = await this.prisma.discount.findUnique({
          where: { id: item.discountId }
        });
        if (discount && discount.isActive) {
          const valDec = new Prisma.Decimal(discount.value);
          if (discount.type === 'PERCENTAGE') {
            const rate = valDec.gt(100) ? valDec.div(10000) : valDec.div(100);
            itemDiscount = lineSubtotal.mul(rate);
          } else {
            itemDiscount = valDec;
          }
          if (discount.maxDiscountAmount) {
            const maxDisc = new Prisma.Decimal(discount.maxDiscountAmount);
            itemDiscount = Prisma.Decimal.min(itemDiscount, maxDisc);
          }
        }
      }
      if (itemDiscount.isNegative()) {
        itemDiscount = new Prisma.Decimal(0);
      }
      if (itemDiscount.gt(lineSubtotal)) {
        itemDiscount = lineSubtotal;
      }

      // Calculate tax
      let taxRate = new Prisma.Decimal(item.taxRate || 0);
      if (item.taxId) {
        const tax = await this.prisma.tax.findUnique({
          where: { id: item.taxId }
        });
        if (tax && tax.isActive) {
          const rateVal = tax.rate !== undefined && tax.rate !== null ? tax.rate : tax.percentage;
          taxRate = new Prisma.Decimal(rateVal);
        }
      }

      const taxableAmount = Prisma.Decimal.max(0, lineSubtotal.minus(itemDiscount));
      const itemTax = taxableAmount.mul(taxRate).div(100);

      const lineTotal = lineSubtotal.minus(itemDiscount).plus(itemTax);

      subtotal = subtotal.plus(lineSubtotal);
      totalDiscount = totalDiscount.plus(itemDiscount);
      totalTax = totalTax.plus(itemTax);
      grandTotal = grandTotal.plus(lineTotal);

      processedItems.push({
        productId: item.productId || null,
        planId: item.planId || null,
        subscriptionItemId: item.subscriptionItemId || null,
        description: item.description,
        quantity: qty,
        unitPrice,
        discountAmount: itemDiscount,
        taxRate,
        taxAmount: itemTax,
        lineSubtotal,
        lineTotal,
        taxId: item.taxId || null,
        unitPriceInCents: Math.round(unitPrice.toNumber() * 100),
        totalInCents: Math.round(lineTotal.toNumber() * 100)
      });
    }

    return {
      subtotal,
      totalDiscount,
      totalTax,
      totalAmount: grandTotal,
      processedItems
    };
  }

  /**
   * Create a manual invoice in DRAFT status.
   */
  async createInvoice(data) {
    // 1. Verify Customer exists and is active
    const customer = await this.prisma.customer.findUnique({
      where: { id: data.customerId }
    });

    if (!customer) {
      const error = new Error(`Customer with ID '${data.customerId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (!customer.isActive) {
      const error = new Error(`Cannot create invoice for inactive customer '${customer.customerCode}'.`);
      error.statusCode = 400;
      throw error;
    }

    // 2. Verify subscription relationship if supplied
    if (data.subscriptionId) {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: data.subscriptionId }
      });
      if (!subscription) {
        const error = new Error(`Subscription with ID '${data.subscriptionId}' not found.`);
        error.statusCode = 404;
        throw error;
      }
      if (subscription.customerId !== data.customerId) {
        const error = new Error('Subscription does not belong to the specified customer.');
        error.statusCode = 400;
        throw error;
      }
    }

    // 3. Process line items authoritatively
    const { subtotal, totalDiscount, totalTax, totalAmount, processedItems } =
      await this.processInvoiceItems(data.items);

    // 4. Calculate invoiceDate and dueDate
    const invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : new Date();
    const dueDate = data.dueDate
      ? new Date(data.dueDate)
      : this.calculateDueDate(invoiceDate, data.paymentTerms || 'NET_15');

    // 5. Attempt creation with retry loop for invoiceNumber uniqueness
    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      try {
        const invoice = await this.prisma.$transaction(async (tx) => {
          const invoiceNumber = await this.generateInvoiceNumber(tx);

          return await tx.invoice.create({
            data: {
              invoiceNumber,
              customerId: data.customerId,
              subscriptionId: data.subscriptionId || null,
              status: 'DRAFT',
              invoiceDate,
              dueDate,
              periodStart: data.periodStart ? new Date(data.periodStart) : null,
              periodEnd: data.periodEnd ? new Date(data.periodEnd) : null,
              currency: data.currency || customer.currency || 'INR',
              subtotal,
              discountAmount: totalDiscount,
              taxAmount: totalTax,
              totalAmount,
              amountPaid: new Prisma.Decimal(0),
              amountDue: totalAmount,
              subtotalInCents: Math.round(subtotal.toNumber() * 100),
              discountInCents: Math.round(totalDiscount.toNumber() * 100),
              taxInCents: Math.round(totalTax.toNumber() * 100),
              totalInCents: Math.round(totalAmount.toNumber() * 100),
              amountPaidInCents: 0,
              amountDueInCents: Math.round(totalAmount.toNumber() * 100),
              notes: data.notes || null,
              termsAndConditions: data.termsAndConditions || null,
              metadata: data.metadata || {},
              items: {
                create: processedItems
              }
            },
            include: {
              customer: true,
              subscription: true,
              items: {
                include: {
                  product: true,
                  plan: true
                }
              }
            }
          });
        });

        return this.formatInvoiceResponse(invoice);
      } catch (err) {
        if (
          attempts < 5 &&
          (err.code === 'P2002' || err.message?.includes('invoiceNumber') || err.message?.includes('Unique constraint'))
        ) {
          // Retry on concurrent invoiceNumber collision
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * List invoices with dual pagination, search, and filters.
   */
  async listInvoices(params) {
    const {
      user,
      customerId,
      subscriptionId,
      status,
      startDate,
      endDate,
      dueDateStart,
      dueDateEnd,
      isOverdue,
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

    if (subscriptionId) {
      where.subscriptionId = subscriptionId;
    }

    if (status) {
      where.status = status;
    }

    if (isOverdue === 'true' || isOverdue === true) {
      where.OR = [
        { status: 'OVERDUE' },
        {
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OPEN'] },
          dueDate: { lt: new Date() },
          amountDue: { gt: 0 }
        }
      ];
    }

    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = new Date(startDate);
      if (endDate) where.invoiceDate.lte = new Date(endDate);
    }

    if (dueDateStart || dueDateEnd) {
      where.dueDate = {};
      if (dueDateStart) where.dueDate.gte = new Date(dueDateStart);
      if (dueDateEnd) where.dueDate.lte = new Date(dueDateEnd);
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customer: { companyName: { contains: search, mode: 'insensitive' } } },
        { customer: { firstName: { contains: search, mode: 'insensitive' } } },
        { customer: { lastName: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const paginationParams = parsePaginationParams(params);

    const result = await paginate({
      modelDelegate: this.prisma.invoice,
      where,
      include: {
        customer: true,
        subscription: true,
        items: true
      },
      paginationParams,
      sortBy,
      sortOrder
    });

    return {
      items: result.items.map(item => this.formatInvoiceResponse(item)),
      pagination: result.pagination
    };
  }

  /**
   * Get invoice by ID.
   */
  async getInvoiceById(id, user) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        subscription: true,
        items: {
          include: {
            product: true,
            plan: true
          }
        },
        payments: true,
        creditTransactions: true
      }
    });

    if (!invoice) {
      const error = new Error(`Invoice with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // Role-based customer isolation check
    if (user && user.role === 'CUSTOMER' && invoice.customerId !== user.customerId) {
      const error = new Error('Access denied: you do not own this invoice.');
      error.statusCode = 403;
      throw error;
    }

    return this.formatInvoiceResponse(invoice);
  }

  /**
   * Update draft invoice (only permitted when status is DRAFT).
   */
  async updateInvoice(id, data) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!existing) {
      const error = new Error(`Invoice with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (existing.status !== 'DRAFT') {
      const error = new Error(`Cannot modify invoice with status '${existing.status}'. Only DRAFT invoices can be updated.`);
      error.statusCode = 400;
      throw error;
    }

    let calculationResult = null;
    if (data.items && data.items.length > 0) {
      calculationResult = await this.processInvoiceItems(data.items);
    }

    const updatePayload = {};
    if (data.notes !== undefined) updatePayload.notes = data.notes;
    if (data.termsAndConditions !== undefined) updatePayload.termsAndConditions = data.termsAndConditions;
    if (data.metadata !== undefined) updatePayload.metadata = data.metadata;
    if (data.invoiceDate) updatePayload.invoiceDate = new Date(data.invoiceDate);

    if (data.dueDate) {
      updatePayload.dueDate = new Date(data.dueDate);
    } else if (data.paymentTerms) {
      updatePayload.dueDate = this.calculateDueDate(updatePayload.invoiceDate || existing.invoiceDate, data.paymentTerms);
    }

    if (calculationResult) {
      updatePayload.subtotal = calculationResult.subtotal;
      updatePayload.discountAmount = calculationResult.totalDiscount;
      updatePayload.taxAmount = calculationResult.totalTax;
      updatePayload.totalAmount = calculationResult.totalAmount;
      updatePayload.amountDue = calculationResult.totalAmount;
      updatePayload.subtotalInCents = Math.round(calculationResult.subtotal.toNumber() * 100);
      updatePayload.discountInCents = Math.round(calculationResult.totalDiscount.toNumber() * 100);
      updatePayload.taxInCents = Math.round(calculationResult.totalTax.toNumber() * 100);
      updatePayload.totalInCents = Math.round(calculationResult.totalAmount.toNumber() * 100);
      updatePayload.amountDueInCents = Math.round(calculationResult.totalAmount.toNumber() * 100);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (calculationResult) {
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: id }
        });
        await tx.invoiceItem.createMany({
          data: calculationResult.processedItems.map(item => ({
            ...item,
            invoiceId: id
          }))
        });
      }

      return await tx.invoice.update({
        where: { id },
        data: updatePayload,
        include: {
          customer: true,
          subscription: true,
          items: {
            include: {
              product: true,
              plan: true
            }
          }
        }
      });
    });

    return this.formatInvoiceResponse(updated);
  }

  /**
   * Issue a draft invoice (locks items, permanent invoice number, status -> ISSUED).
   */
  async issueInvoice(id, options = {}) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { items: true, customer: true, subscription: true }
    });

    if (!invoice) {
      const error = new Error(`Invoice with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (invoice.status !== 'DRAFT') {
      const error = new Error(`Cannot issue invoice with status '${invoice.status}'. Only DRAFT invoices can be issued.`);
      error.statusCode = 400;
      throw error;
    }

    if (!invoice.items || invoice.items.length === 0) {
      const error = new Error('Cannot issue an empty invoice without line items.');
      error.statusCode = 400;
      throw error;
    }

    const issuedAt = new Date();
    let dueDate = invoice.dueDate;
    if (options.dueDate) {
      dueDate = new Date(options.dueDate);
    } else if (options.paymentTerms) {
      dueDate = this.calculateDueDate(issuedAt, options.paymentTerms);
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'ISSUED',
        issuedAt,
        dueDate
      },
      include: {
        customer: true,
        subscription: true,
        items: true
      }
    });

    return this.formatInvoiceResponse(updated);
  }

  /**
   * Void an invoice (only permitted when DRAFT, ISSUED, OVERDUE, or PARTIALLY_PAID).
   */
  async voidInvoice(id, options = {}) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id }
    });

    if (!invoice) {
      const error = new Error(`Invoice with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (invoice.status === 'PAID') {
      const error = new Error('Cannot void a paid invoice.');
      error.statusCode = 400;
      throw error;
    }

    if (invoice.status === 'VOID') {
      const error = new Error('Invoice is already voided.');
      error.statusCode = 400;
      throw error;
    }

    const voidedAt = new Date();
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'VOID',
        voidedAt,
        amountDue: new Prisma.Decimal(0),
        amountDueInCents: 0,
        notes: options.reason
          ? `${invoice.notes ? invoice.notes + '\n' : ''}[Voided: ${options.reason}]`
          : invoice.notes
      },
      include: {
        customer: true,
        subscription: true,
        items: true
      }
    });

    return this.formatInvoiceResponse(updated);
  }
}

export const invoicesService = new InvoicesService();
