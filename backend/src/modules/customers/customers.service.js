import { prisma } from '../../utils/prisma.js';
import { hashPassword } from '../../utils/crypto.js';

// Deterministic select for safe customer responses
const CUSTOMER_SELECT = {
  id: true,
  customerCode: true,
  customerType: true,
  firstName: true,
  lastName: true,
  companyName: true,
  email: true,
  phone: true,
  alternatePhone: true,
  billingAddress: true,
  billingCity: true,
  billingState: true,
  billingPostalCode: true,
  billingCountry: true,
  taxNumber: true,
  notes: true,
  currency: true,
  isActive: true,
  status: true,
  userId: true,
  createdAt: true,
  updatedAt: true
};

/**
 * Generate a unique, human-readable customer code.
 * Format: CUST-XXXXXXXX (8 alphanumeric characters derived from timestamp + random)
 */
function generateCustomerCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CUST-${ts}${rand}`.substring(0, 14);
}

export class CustomersService {
  /**
   * Create a customer, optionally provisioning a linked User login account.
   * Uses a Prisma transaction for atomicity of User+Customer creation.
   */
  async createCustomer(data, creatorUser) {
    const customerCode = generateCustomerCode();

    // Check for duplicate customer email
    const existingCustomer = await prisma.customer.findUnique({
      where: { email: data.email }
    });
    if (existingCustomer) {
      const error = new Error('A customer with this email already exists');
      error.statusCode = 409;
      throw error;
    }

    // If provisioning a linked account, validate the account email
    if (data.createAccount) {
      const accountEmail = data.accountEmail || data.email;
      const existingUser = await prisma.user.findUnique({
        where: { email: accountEmail }
      });
      if (existingUser) {
        const error = new Error('A user account with this email already exists');
        error.statusCode = 409;
        throw error;
      }

      // Hash the password before the transaction
      const passwordHash = await hashPassword(data.accountPassword);
      const accountName = data.accountName || [data.firstName, data.lastName].filter(Boolean).join(' ') || data.companyName || 'Customer';

      // Atomic transaction: create User + Customer together
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: accountName,
            email: accountEmail,
            passwordHash,
            role: 'CUSTOMER', // Strictly enforced — never accept from client
            isActive: true,
            createdById: creatorUser.id
          }
        });

        const customer = await tx.customer.create({
          data: {
            userId: user.id,
            customerCode,
            customerType: data.customerType,
            firstName: data.firstName || null,
            lastName: data.lastName || null,
            companyName: data.companyName || null,
            email: data.email,
            phone: data.phone || null,
            alternatePhone: data.alternatePhone || null,
            billingAddress: data.billingAddress || null,
            billingCity: data.billingCity || null,
            billingState: data.billingState || null,
            billingPostalCode: data.billingPostalCode || null,
            billingCountry: data.billingCountry || null,
            taxNumber: data.taxNumber || null,
            notes: data.notes || null,
            currency: data.currency || 'USD',
            isActive: true,
            status: 'ACTIVE'
          },
          select: CUSTOMER_SELECT
        });

        return { customer, accountCreated: true, accountEmail };
      });

      return result;
    }

    // Create customer without linked account
    const customer = await prisma.customer.create({
      data: {
        customerCode,
        customerType: data.customerType,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        companyName: data.companyName || null,
        email: data.email,
        phone: data.phone || null,
        alternatePhone: data.alternatePhone || null,
        billingAddress: data.billingAddress || null,
        billingCity: data.billingCity || null,
        billingState: data.billingState || null,
        billingPostalCode: data.billingPostalCode || null,
        billingCountry: data.billingCountry || null,
        taxNumber: data.taxNumber || null,
        notes: data.notes || null,
        currency: data.currency || 'USD',
        isActive: true,
        status: 'ACTIVE'
      },
      select: CUSTOMER_SELECT
    });

    return { customer, accountCreated: false };
  }

  /**
   * List customers with pagination, search, filtering, and sorting.
   * Database-level pagination using skip/take for efficient queries.
   */
  async listCustomers({ page = 1, limit = 20, search, customerType, isActive, sortBy = 'createdAt', sortOrder = 'desc' }) {
    const skip = (page - 1) * limit;
    const where = {};

    if (customerType) {
      where.customerType = customerType;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === true || isActive === 'true';
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { customerCode: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Validate sortBy to prevent injection
    const allowedSortFields = ['createdAt', 'updatedAt', 'email', 'customerCode', 'firstName', 'companyName'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, totalItems] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [safeSortBy]: safeSortOrder },
        select: CUSTOMER_SELECT
      }),
      prisma.customer.count({ where })
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      items,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Get a single customer by ID with safe selection.
   */
  async getCustomerById(id) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: CUSTOMER_SELECT
    });

    if (!customer) {
      const error = new Error('Customer not found');
      error.statusCode = 404;
      throw error;
    }

    return customer;
  }

  /**
   * Update customer fields. Accepts pre-validated and role-allowlisted data.
   */
  async updateCustomer(id, updateData) {
    const customer = await prisma.customer.findUnique({
      where: { id }
    });

    if (!customer) {
      const error = new Error('Customer not found');
      error.statusCode = 404;
      throw error;
    }

    // Check email uniqueness if changed
    if (updateData.email && updateData.email !== customer.email) {
      const existing = await prisma.customer.findUnique({
        where: { email: updateData.email }
      });
      if (existing) {
        const error = new Error('A customer with this email already exists');
        error.statusCode = 409;
        throw error;
      }
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: updateData,
      select: CUSTOMER_SELECT
    });

    return updated;
  }

  /**
   * Activate or deactivate a customer (ADMIN only).
   * Updates customer business status independently of User account status.
   */
  async updateCustomerStatus(id, isActive) {
    const customer = await prisma.customer.findUnique({
      where: { id }
    });

    if (!customer) {
      const error = new Error('Customer not found');
      error.statusCode = 404;
      throw error;
    }

    const newStatus = isActive ? 'ACTIVE' : 'SUSPENDED';

    const updated = await prisma.customer.update({
      where: { id },
      data: { isActive, status: newStatus },
      select: CUSTOMER_SELECT
    });

    return updated;
  }

  /**
   * Get paginated subscription summaries for a customer.
   */
  async getCustomerSubscriptions(customerId, { page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      prisma.subscription.findMany({
        where: { customerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          currency: true,
          cancelAtPeriodEnd: true,
          createdAt: true
        }
      }),
      prisma.subscription.count({ where: { customerId } })
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;
    return {
      items,
      pagination: { page, limit, totalItems, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
    };
  }

  /**
   * Get paginated invoice summaries for a customer.
   */
  async getCustomerInvoices(customerId, { page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      prisma.invoice.findMany({
        where: { customerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          totalInCents: true,
          amountDueInCents: true,
          currency: true,
          dueDate: true,
          paidAt: true,
          createdAt: true
        }
      }),
      prisma.invoice.count({ where: { customerId } })
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;
    return {
      items,
      pagination: { page, limit, totalItems, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
    };
  }

  /**
   * Get paginated payment summaries for a customer.
   * Payments are linked to the customer through invoices.
   */
  async getCustomerPayments(customerId, { page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const paymentWhere = {
      invoice: { customerId }
    };

    const [items, totalItems] = await Promise.all([
      prisma.payment.findMany({
        where: paymentWhere,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amountInCents: true,
          currency: true,
          status: true,
          paymentMethod: true,
          paidAt: true,
          createdAt: true,
          invoice: {
            select: {
              id: true,
              invoiceNumber: true
            }
          }
        }
      }),
      prisma.payment.count({ where: paymentWhere })
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;
    return {
      items,
      pagination: { page, limit, totalItems, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
    };
  }
}

export const customersService = new CustomersService();

