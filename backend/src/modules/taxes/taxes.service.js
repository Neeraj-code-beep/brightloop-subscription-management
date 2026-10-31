import { Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../utils/prisma.js';
import { parsePaginationParams, paginate } from '../../utils/pagination.js';

export class TaxesService {
  constructor(prismaClient = defaultPrisma) {
    this.prisma = prismaClient;
  }

  formatTaxResponse(tax) {
    if (!tax) return null;
    const rateVal = tax.rate !== undefined && tax.rate !== null ? tax.rate : tax.percentage;
    const rateDecimal = new Prisma.Decimal(rateVal || 0);

    return {
      id: tax.id,
      code: tax.code || null,
      name: tax.name,
      rate: rateDecimal.toFixed(2),
      percentage: rateDecimal.toFixed(2),
      type: tax.type || 'SALES_TAX',
      jurisdiction: tax.jurisdiction || null,
      description: tax.description || null,
      validFrom: tax.validFrom ? new Date(tax.validFrom).toISOString() : null,
      validTo: tax.validTo ? new Date(tax.validTo).toISOString() : null,
      isCompound: Boolean(tax.isCompound),
      priority: tax.priority !== undefined ? tax.priority : 0,
      isActive: Boolean(tax.isActive),
      createdAt: tax.createdAt,
      updatedAt: tax.updatedAt
    };
  }

  /**
   * Create a new Tax rule (ADMIN)
   */
  async createTax(data) {
    const rateInput = data.rate !== undefined ? data.rate : data.percentage;
    const rateDecimal = new Prisma.Decimal(rateInput);

    if (rateDecimal.isNegative() || rateDecimal.greaterThan(100)) {
      const error = new Error('Tax rate must be between 0.00 and 100.00 percent.');
      error.statusCode = 400;
      throw error;
    }

    // Generate or format code
    let code = data.code ? String(data.code).trim().toUpperCase() : null;
    if (!code) {
      code = `TAX-${data.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
    }

    // Code uniqueness check
    const existing = await this.prisma.tax.findFirst({
      where: { code }
    });
    if (existing) {
      const error = new Error(`Tax with code '${code}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    // Validate date logic
    if (data.validFrom && data.validTo) {
      if (new Date(data.validTo) < new Date(data.validFrom)) {
        const error = new Error('Tax validTo date cannot be earlier than validFrom date.');
        error.statusCode = 400;
        throw error;
      }
    }

    const newTax = await this.prisma.tax.create({
      data: {
        name: data.name,
        code,
        rate: rateDecimal,
        percentage: rateDecimal,
        type: data.type || 'SALES_TAX',
        jurisdiction: data.jurisdiction || null,
        description: data.description || null,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validTo: data.validTo ? new Date(data.validTo) : null,
        isCompound: Boolean(data.isCompound),
        priority: data.priority !== undefined ? Number(data.priority) : 0,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true
      }
    });

    return this.formatTaxResponse(newTax);
  }

  /**
   * Get tax details by ID
   */
  async getTaxById(id) {
    const tax = await this.prisma.tax.findUnique({
      where: { id }
    });
    if (!tax) {
      const error = new Error(`Tax not found with ID '${id}'.`);
      error.statusCode = 404;
      throw error;
    }
    return this.formatTaxResponse(tax);
  }

  /**
   * List taxes with dual pagination and filtering
   */
  async listTaxes(queryParams = {}) {
    const {
      isActive,
      type,
      jurisdiction,
      search,
      page,
      limit,
      cursor,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryParams;

    const where = {};

    if (isActive !== undefined && isActive !== '') {
      where.isActive = String(isActive) === 'true';
    }

    if (type) {
      where.type = String(type).toUpperCase();
    }

    if (jurisdiction) {
      where.jurisdiction = { contains: String(jurisdiction), mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { code: { contains: String(search), mode: 'insensitive' } },
        { jurisdiction: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    const paginationParams = parsePaginationParams(queryParams);
    const result = await paginate({
      modelDelegate: this.prisma.tax,
      paginationParams,
      where,
      sortBy,
      sortOrder
    });

    return {
      items: result.items.map(t => this.formatTaxResponse(t)),
      pagination: result.pagination
    };
  }

  /**
   * Update tax details (ADMIN)
   */
  async updateTax(id, data) {
    const existing = await this.prisma.tax.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Tax not found with ID '${id}'.`);
      error.statusCode = 404;
      throw error;
    }

    const updateData = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.jurisdiction !== undefined) updateData.jurisdiction = data.jurisdiction;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isCompound !== undefined) updateData.isCompound = Boolean(data.isCompound);
    if (data.priority !== undefined) updateData.priority = Number(data.priority);
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    if (data.code !== undefined) {
      const code = String(data.code).trim().toUpperCase();
      const codeCheck = await this.prisma.tax.findFirst({
        where: { code, NOT: { id } }
      });
      if (codeCheck) {
        const error = new Error(`Tax with code '${code}' already exists.`);
        error.statusCode = 409;
        throw error;
      }
      updateData.code = code;
    }

    if (data.rate !== undefined || data.percentage !== undefined) {
      const rateInput = data.rate !== undefined ? data.rate : data.percentage;
      const rateDecimal = new Prisma.Decimal(rateInput);
      if (rateDecimal.isNegative() || rateDecimal.greaterThan(100)) {
        const error = new Error('Tax rate must be between 0.00 and 100.00 percent.');
        error.statusCode = 400;
        throw error;
      }
      updateData.rate = rateDecimal;
      updateData.percentage = rateDecimal;
    }

    const validFrom = data.validFrom !== undefined ? (data.validFrom ? new Date(data.validFrom) : null) : existing.validFrom;
    const validTo = data.validTo !== undefined ? (data.validTo ? new Date(data.validTo) : null) : existing.validTo;

    if (validFrom && validTo && validTo < validFrom) {
      const error = new Error('Tax validTo date cannot be earlier than validFrom date.');
      error.statusCode = 400;
      throw error;
    }

    if (data.validFrom !== undefined) updateData.validFrom = validFrom;
    if (data.validTo !== undefined) updateData.validTo = validTo;

    const updated = await this.prisma.tax.update({
      where: { id },
      data: updateData
    });

    return this.formatTaxResponse(updated);
  }

  /**
   * Update tax active status (ADMIN)
   */
  async updateTaxStatus(id, isActive) {
    const existing = await this.prisma.tax.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Tax not found with ID '${id}'.`);
      error.statusCode = 404;
      throw error;
    }

    const updated = await this.prisma.tax.update({
      where: { id },
      data: { isActive: Boolean(isActive) }
    });

    return this.formatTaxResponse(updated);
  }

  /**
   * Calculate multiple taxes across line items supporting compound ordering
   */
  calculateMultipleTaxes(taxableAmount, taxes = []) {
    const base = new Prisma.Decimal(taxableAmount || 0);
    if (base.lte(0) || !taxes.length) {
      return {
        totalTax: new Prisma.Decimal(0),
        taxBreakdown: []
      };
    }

    // Sort by priority ASC
    const sorted = [...taxes].sort((a, b) => (a.priority || 0) - (b.priority || 0));

    let accumulatedBase = base;
    let totalTax = new Prisma.Decimal(0);
    const taxBreakdown = [];

    for (const tax of sorted) {
      const rateVal = tax.rate !== undefined ? tax.rate : tax.percentage;
      const rate = new Prisma.Decimal(rateVal || 0);
      const applyBase = tax.isCompound ? accumulatedBase : base;
      const taxAmount = applyBase.mul(rate).div(100);

      totalTax = totalTax.plus(taxAmount);
      accumulatedBase = accumulatedBase.plus(taxAmount);

      taxBreakdown.push({
        taxId: tax.id,
        code: tax.code,
        name: tax.name,
        rate: rate.toFixed(2),
        isCompound: Boolean(tax.isCompound),
        amount: taxAmount.toFixed(2)
      });
    }

    return {
      totalTax,
      taxBreakdown
    };
  }
}

export const taxesService = new TaxesService();

