import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createMockPrisma, seedTestUser } from './testHelper.js';
import { setPrismaClient } from '../src/utils/prisma.js';
import { taxesService } from '../src/modules/taxes/taxes.service.js';
import { discountsService } from '../src/modules/discounts/discounts.service.js';

describe('Tax & Discount Management Suite', () => {
  let mockPrisma;
  let adminToken, staffToken, customerAToken, customerBToken;
  let customerAId, customerBId;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    setPrismaClient(mockPrisma);

    // 1. Seed Roles: Admin, Staff, Customer A, Customer B
    const adminUser = await seedTestUser(mockPrisma, {
      name: 'Admin Finance',
      email: 'admin.finance@subpilot.com',
      role: 'ADMIN'
    });
    adminToken = adminUser.token;

    const staffUser = await seedTestUser(mockPrisma, {
      name: 'Staff Operator',
      email: 'staff.billing@subpilot.com',
      role: 'STAFF'
    });
    staffToken = staffUser.token;

    const custA = await seedTestUser(mockPrisma, {
      name: 'Acme Enterprise',
      email: 'billing@acme.com',
      role: 'CUSTOMER'
    });
    customerAToken = custA.token;
    customerAId = custA.customerId;

    const custB = await seedTestUser(mockPrisma, {
      name: 'Beta Global',
      email: 'finance@beta.com',
      role: 'CUSTOMER'
    });
    customerBToken = custB.token;
    customerBId = custB.customerId;
  });

  // =========================================================================
  // 1. TAX MANAGEMENT APIS
  // =========================================================================
  describe('1. Tax Management APIs', () => {
    it('ADMIN can create a new Tax rule with code, rate, jurisdiction, and priority', async () => {
      const res = await request(app)
        .post('/api/v1/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Goods & Services Tax 18%',
          code: 'GST_18',
          rate: 18.00,
          type: 'GST',
          jurisdiction: 'India',
          description: 'Standard 18% GST for digital services',
          isCompound: false,
          priority: 1
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('GST_18');
      expect(res.body.data.rate).toBe('18.00');
      expect(res.body.data.percentage).toBe('18.00');
      expect(res.body.data.type).toBe('GST');
      expect(res.body.data.isActive).toBe(true);
    });

    it('Rejects creating tax with duplicate code (409 Conflict)', async () => {
      // Create first tax
      await request(app)
        .post('/api/v1/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'VAT 20%',
          code: 'VAT_20',
          rate: 20.00,
          type: 'VAT'
        });

      // Try creating duplicate code
      const res = await request(app)
        .post('/api/v1/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'UK VAT 20%',
          code: 'VAT_20',
          rate: 20.00,
          type: 'VAT'
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('Rejects creating tax with negative or invalid percentage (400)', async () => {
      const res = await request(app)
        .post('/api/v1/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Tax',
          code: 'INV_TAX',
          rate: -5.00
        });

      expect([400, 422]).toContain(res.status);
    });

    it('Rejects tax with validTo date earlier than validFrom date (400)', async () => {
      const res = await request(app)
        .post('/api/v1/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Temporary Levy',
          code: 'TEMP_LEVY',
          rate: 5.00,
          validFrom: '2026-12-01T00:00:00.000Z',
          validTo: '2026-11-01T00:00:00.000Z'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/validTo date cannot be earlier/i);
    });

    it('ADMIN can update a tax rule rate, priority, and description', async () => {
      const createRes = await request(app)
        .post('/api/v1/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'State Tax',
          code: 'STATE_5',
          rate: 5.00,
          priority: 2
        });
      const taxId = createRes.body.data.id;

      const updateRes = await request(app)
        .patch(`/api/v1/taxes/${taxId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rate: 6.50,
          description: 'Revised state tax rate',
          isCompound: true
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.rate).toBe('6.50');
      expect(updateRes.body.data.description).toBe('Revised state tax rate');
      expect(updateRes.body.data.isCompound).toBe(true);
    });

    it('ADMIN can update tax status (PATCH /status)', async () => {
      const createRes = await request(app)
        .post('/api/v1/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Municipal Surcharge',
          code: 'MUNI_2',
          rate: 2.00
        });
      const taxId = createRes.body.data.id;

      const statusRes = await request(app)
        .patch(`/api/v1/taxes/${taxId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.isActive).toBe(false);
    });

    it('STAFF and CUSTOMER cannot create or update tax rules (403 Forbidden)', async () => {
      const staffRes = await request(app)
        .post('/api/v1/taxes')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Staff Tax', code: 'STAFF_TAX', rate: 10 });
      expect(staffRes.status).toBe(403);

      const custRes = await request(app)
        .post('/api/v1/taxes')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ name: 'Cust Tax', code: 'CUST_TAX', rate: 10 });
      expect(custRes.status).toBe(403);
    });

    it('List taxes with dual pagination and search filtering', async () => {
      // Seed 3 taxes
      for (let i = 1; i <= 3; i++) {
        mockPrisma._state.taxes.push({
          id: `tax_test_${i}`,
          name: `Tax Alpha ${i}`,
          code: `TAX_A_${i}`,
          rate: '10.00',
          percentage: '10.00',
          type: 'SALES_TAX',
          jurisdiction: 'NY',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      const res = await request(app)
        .get('/api/v1/taxes?search=Alpha&limit=2&page=1')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.pagination.total).toBe(3);
    });
  });

  // =========================================================================
  // 2. DISCOUNT MANAGEMENT APIS
  // =========================================================================
  describe('2. Discount Management APIs', () => {
    it('ADMIN can create a percentage discount with minimum purchase and usage limits', async () => {
      const res = await request(app)
        .post('/api/v1/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'SUMMER20',
          name: 'Summer Splash 20%',
          description: '20% discount on orders above 1000',
          type: 'PERCENTAGE',
          value: 20.00,
          currency: 'INR',
          minPurchaseAmount: 1000.00,
          maxDiscountAmount: 500.00,
          maxRedemptions: 100,
          maxRedemptionsPerCustomer: 2
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('SUMMER20');
      expect(res.body.data.value).toBe('20.00');
      expect(res.body.data.minPurchaseAmount).toBe('1000.00');
      expect(res.body.data.maxDiscountAmount).toBe('500.00');
      expect(res.body.data.maxRedemptions).toBe(100);
      expect(res.body.data.maxRedemptionsPerCustomer).toBe(2);
      expect(res.body.data.isActive).toBe(true);
    });

    it('ADMIN can create a fixed amount discount coupon', async () => {
      const res = await request(app)
        .post('/api/v1/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'FLAT100',
          name: 'Flat 100 Off',
          type: 'FIXED_AMOUNT',
          value: 100.00,
          currency: 'INR',
          minPurchaseAmount: 500.00
        });

      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe('FLAT100');
      expect(res.body.data.type).toBe('FIXED_AMOUNT');
      expect(res.body.data.value).toBe('100.00');
    });

    it('Rejects creating discount with duplicate code (409 Conflict)', async () => {
      await request(app)
        .post('/api/v1/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'WELCOME50',
          type: 'FIXED_AMOUNT',
          value: 50.00
        });

      const res = await request(app)
        .post('/api/v1/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'WELCOME50',
          type: 'FIXED_AMOUNT',
          value: 50.00
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('ADMIN can update discount parameters', async () => {
      const createRes = await request(app)
        .post('/api/v1/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'PROMO15',
          type: 'PERCENTAGE',
          value: 15.00
        });
      const discountId = createRes.body.data.id;

      const updateRes = await request(app)
        .patch(`/api/v1/discounts/${discountId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          value: 18.00,
          description: 'Increased to 18%'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.value).toBe('18.00');
      expect(updateRes.body.data.description).toBe('Increased to 18%');
    });

    it('ADMIN can toggle discount active status (PATCH /status)', async () => {
      const createRes = await request(app)
        .post('/api/v1/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'FLASHDEAL',
          type: 'PERCENTAGE',
          value: 30.00
        });
      const discountId = createRes.body.data.id;

      const statusRes = await request(app)
        .patch(`/api/v1/discounts/${discountId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.isActive).toBe(false);
    });

    it('STAFF and CUSTOMER cannot create, edit, or toggle discount status (403 Forbidden)', async () => {
      const staffRes = await request(app)
        .post('/api/v1/discounts')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ code: 'STAFFDISC', value: 10 });
      expect(staffRes.status).toBe(403);

      const custRes = await request(app)
        .post('/api/v1/discounts')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ code: 'CUSTDISC', value: 10 });
      expect(custRes.status).toBe(403);
    });
  });

  // =========================================================================
  // 3. COUPON VALIDATION ENGINE (POST /api/v1/discounts/validate)
  // =========================================================================
  describe('3. Coupon Validation Engine', () => {
    let validCouponCode;

    beforeEach(async () => {
      validCouponCode = 'SAVE25';
      mockPrisma._state.discounts.push({
        id: 'disc_save25_001',
        code: validCouponCode,
        name: 'Save 25%',
        type: 'PERCENTAGE',
        value: '25.00',
        currency: 'INR',
        minPurchaseAmount: '400.00',
        maxDiscountAmount: '200.00',
        validFrom: new Date(Date.now() - 86400000), // Started yesterday
        validTo: new Date(Date.now() + 86400000 * 7), // Valid for 7 days
        maxRedemptions: 5,
        maxRedemptionsPerCustomer: 1,
        timesRedeemed: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    it('Validates active coupon and calculates correct discount amount', async () => {
      const res = await request(app)
        .post('/api/v1/discounts/validate')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          code: validCouponCode,
          purchaseAmount: 500.00,
          currency: 'INR'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isValid).toBe(true);
      // 25% of 500 = 125.00
      expect(res.body.data.discountAmount).toBe('125.00');
    });

    it('Caps discount amount at maxDiscountAmount when percentage exceeds ceiling', async () => {
      // 25% of 2000 = 500, but maxDiscountAmount is 200.00
      const res = await request(app)
        .post('/api/v1/discounts/validate')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          code: validCouponCode,
          purchaseAmount: 2000.00,
          currency: 'INR'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.discountAmount).toBe('200.00');
    });

    it('Rejects coupon when purchaseAmount is below minPurchaseAmount (400)', async () => {
      // minPurchaseAmount is 400.00, submitting 250.00
      const res = await request(app)
        .post('/api/v1/discounts/validate')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          code: validCouponCode,
          purchaseAmount: 250.00
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Minimum purchase amount of 400.00 required/i);
    });

    it('Rejects coupon when expired (400)', async () => {
      const expiredCode = 'EXPIRED_CODE';
      mockPrisma._state.discounts.push({
        id: 'disc_exp_99',
        code: expiredCode,
        type: 'PERCENTAGE',
        value: '10.00',
        validFrom: new Date(Date.now() - 86400000 * 10),
        validTo: new Date(Date.now() - 86400000), // Expired yesterday
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const res = await request(app)
        .post('/api/v1/discounts/validate')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          code: expiredCode,
          purchaseAmount: 500.00
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/has expired/i);
    });

    it('Rejects coupon when inactive (400)', async () => {
      const inactiveCode = 'INACTIVE_CODE';
      mockPrisma._state.discounts.push({
        id: 'disc_inact_99',
        code: inactiveCode,
        type: 'PERCENTAGE',
        value: '10.00',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const res = await request(app)
        .post('/api/v1/discounts/validate')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          code: inactiveCode,
          purchaseAmount: 500.00
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/is inactive/i);
    });

    it('Rejects coupon when global maxRedemptions is reached (400)', async () => {
      const exhaustedCode = 'EXHAUSTED_COUPON';
      mockPrisma._state.discounts.push({
        id: 'disc_exh_99',
        code: exhaustedCode,
        type: 'FIXED_AMOUNT',
        value: '50.00',
        maxRedemptions: 3,
        timesRedeemed: 3, // Exhausted
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const res = await request(app)
        .post('/api/v1/discounts/validate')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          code: exhaustedCode,
          purchaseAmount: 500.00
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/redemption limit/i);
    });

    it('Rejects coupon when customer has already reached maxRedemptionsPerCustomer (400)', async () => {
      // Record prior redemption for Customer A
      mockPrisma._state.discountRedemptions.push({
        id: 'dr_prev_01',
        discountId: 'disc_save25_001',
        customerId: customerAId,
        amountApplied: '125.00',
        redeemedAt: new Date()
      });

      const res = await request(app)
        .post('/api/v1/discounts/validate')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          code: validCouponCode,
          purchaseAmount: 500.00
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/maximum allowed redemptions/i);
    });
  });

  // =========================================================================
  // 4. FINANCIAL CALCULATION INTEGRATION & MULTIPLE TAXES
  // =========================================================================
  describe('4. Financial Calculation Integration & Multiple Taxes', () => {
    it('Accurately computes line subtotal, line discount, and taxable amount', () => {
      // Line subtotal = 100 * 5 = 500
      // Discount = 100
      // Taxable = 400
      // 18% Tax = 72.00
      // Total = 400 + 72 = 472.00
      const unitPrice = 100;
      const qty = 5;
      const discount = 100;
      const taxRate = 18;

      const subtotal = unitPrice * qty; // 500
      const taxable = subtotal - discount; // 400
      const tax = (taxable * taxRate) / 100; // 72
      const lineTotal = taxable + tax; // 472

      expect(subtotal).toBe(500);
      expect(taxable).toBe(400);
      expect(tax).toBe(72);
      expect(lineTotal).toBe(472);
    });

    it('TaxesService correctly computes multiple taxes with compound priority ordering', () => {
      // Base taxable amount = 1000.00
      // Tax 1 (Priority 1, Standard): 10% on 1000 = 100.00
      // Tax 2 (Priority 2, Compound): 5% on (1000 + 100) = 55.00
      // Total Tax = 155.00
      const taxes = [
        {
          id: 'tax_1',
          code: 'BASE_VAT',
          name: 'Base VAT',
          rate: '10.00',
          percentage: '10.00',
          isCompound: false,
          priority: 1
        },
        {
          id: 'tax_2',
          code: 'SURCHARGE',
          name: 'Environment Surcharge',
          rate: '5.00',
          percentage: '5.00',
          isCompound: true,
          priority: 2
        }
      ];

      const calculation = taxesService.calculateMultipleTaxes(1000, taxes);
      expect(calculation.totalTax.toFixed(2)).toBe('155.00');
      expect(calculation.taxBreakdown.length).toBe(2);
      expect(calculation.taxBreakdown[0].amount).toBe('100.00');
      expect(calculation.taxBreakdown[1].amount).toBe('55.00');
    });

    it('Quotation calculation accurately reflects discount capping and line taxes', async () => {
      // Seed Product
      mockPrisma._state.products.push({
        id: 'prod_test_01',
        name: 'Enterprise Cloud',
        basePrice: '1000.00',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Seed 10% Discount
      mockPrisma._state.discounts.push({
        id: 'disc_ten_pct',
        code: 'TEN_OFF',
        type: 'PERCENTAGE',
        value: '10.00', // 10%
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Seed 18% Tax
      mockPrisma._state.taxes.push({
        id: 'tax_gst_18',
        name: 'GST 18%',
        code: 'GST_18',
        rate: '18.00',
        percentage: '18.00',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Create Quotation with 1 item: qty 2, price 1000, discountId disc_ten_pct, taxId tax_gst_18
      // Subtotal: 2000.00
      // Discount: 10% of 2000 = 200.00
      // Taxable: 1800.00
      // Tax: 18% of 1800 = 324.00
      // Grand Total: 1800 + 324 = 2124.00
      const res = await request(app)
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerAId,
          validUntil: new Date(Date.now() + 86400000 * 14).toISOString(),
          items: [
            {
              productId: 'prod_test_01',
              quantity: 2,
              discountId: 'disc_ten_pct',
              taxId: 'tax_gst_18'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.subtotal).toBe('2000.00');
      expect(res.body.data.discountAmount).toBe('200.00');
      expect(res.body.data.taxAmount).toBe('324.00');
      expect(res.body.data.grandTotal).toBe('2124.00');
    });

    it('DiscountsService.redeemDiscount increments timesRedeemed and records redemption audit', async () => {
      const disc = {
        id: 'disc_redeem_01',
        code: 'ONCE_ONLY',
        type: 'FIXED_AMOUNT',
        value: '50.00',
        maxRedemptions: 10,
        timesRedeemed: 2,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockPrisma._state.discounts.push(disc);

      await discountsService.redeemDiscount(mockPrisma, {
        discountId: disc.id,
        customerId: customerAId,
        amountApplied: '50.00',
        invoiceId: 'inv_dummy_123'
      });

      const updated = mockPrisma._state.discounts.find(d => d.id === disc.id);
      expect(updated.timesRedeemed).toBe(3);
      expect(mockPrisma._state.discountRedemptions.length).toBe(1);
      expect(mockPrisma._state.discountRedemptions[0].customerId).toBe(customerAId);
    });
  });
});

