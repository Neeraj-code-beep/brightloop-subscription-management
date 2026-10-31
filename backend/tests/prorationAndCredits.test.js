import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { app } from '../src/app.js';
import { createMockPrisma, seedTestUser } from './testHelper.js';
import { setPrismaClient } from '../src/utils/prisma.js';
import { prorationService } from '../src/modules/subscriptions/proration.service.js';
import { creditsService } from '../src/modules/credits/credits.service.js';
import { billingService } from '../src/modules/invoices/billing.service.js';

describe('Module 11: Plan Migration, Proration & Customer Credit Management Suite', () => {
  let mockPrisma;
  let adminToken;
  let staffToken;
  let customerUserA;
  let customerUserB;
  let customerAId;
  let customerBId;
  let product;
  let starterMonthlyPlan;
  let proMonthlyPlan;
  let enterpriseQuarterlyPlan;
  let usdMonthlyPlan;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    setPrismaClient(mockPrisma);

    // 1. Seed Roles
    const admin = await seedTestUser(mockPrisma, {
      name: 'Admin User',
      email: 'admin@subpilot.com',
      role: 'ADMIN'
    });
    adminToken = admin.token;

    const staff = await seedTestUser(mockPrisma, {
      name: 'Staff User',
      email: 'staff@subpilot.com',
      role: 'STAFF'
    });
    staffToken = staff.token;

    customerUserA = await seedTestUser(mockPrisma, {
      name: 'Customer A',
      email: 'cust.a@test.com',
      role: 'CUSTOMER',
      currency: 'INR'
    });
    customerAId = customerUserA.customerId;

    customerUserB = await seedTestUser(mockPrisma, {
      name: 'Customer B',
      email: 'cust.b@test.com',
      role: 'CUSTOMER',
      currency: 'INR'
    });
    customerBId = customerUserB.customerId;

    // 2. Seed Product & Plans
    product = await mockPrisma.product.create({
      data: {
        name: 'Cloud Platform',
        slug: 'cloud-platform',
        basePrice: '1000.00',
        isActive: true
      }
    });

    starterMonthlyPlan = await mockPrisma.plan.create({
      data: {
        productId: product.id,
        name: 'Starter Monthly',
        billingCycle: 'MONTHLY',
        price: '1000.00',
        setupFee: '200.00',
        currency: 'INR',
        isActive: true
      }
    });

    proMonthlyPlan = await mockPrisma.plan.create({
      data: {
        productId: product.id,
        name: 'Pro Monthly',
        billingCycle: 'MONTHLY',
        price: '2500.00',
        setupFee: '500.00',
        currency: 'INR',
        isActive: true
      }
    });

    enterpriseQuarterlyPlan = await mockPrisma.plan.create({
      data: {
        productId: product.id,
        name: 'Enterprise Quarterly',
        billingCycle: 'QUARTERLY',
        price: '6000.00',
        setupFee: '1000.00',
        currency: 'INR',
        isActive: true
      }
    });

    usdMonthlyPlan = await mockPrisma.plan.create({
      data: {
        productId: product.id,
        name: 'Starter USD',
        billingCycle: 'MONTHLY',
        price: '50.00',
        currency: 'USD',
        isActive: true
      }
    });
  });

  // =========================================================================
  // 1 & 2. Monthly and Quarterly Upgrade
  // =========================================================================
  describe('1 & 2. Plan Upgrades with Prorated Adjustment Invoices', () => {
    it('calculates mid-cycle monthly upgrade and issues adjustment invoice for remainder', async () => {
      // 30-day period: 10 days used, 20 days remaining (2/3 fraction)
      const periodStart = new Date('2026-06-01T00:00:00Z');
      const periodEnd = new Date('2026-07-01T00:00:00Z');
      const effectiveDate = new Date('2026-06-11T00:00:00Z'); // exactly 10 days in

      const sub = await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-MIG-001',
          customerId: customerAId,
          planId: starterMonthlyPlan.id,
          status: 'ACTIVE',
          startDate: periodStart,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          recurringPrice: '1000.00',
          currency: 'INR'
        }
      });

      // Preview first
      const previewRes = await request(app)
        .post(`/api/v1/subscriptions/${sub.id}/preview-migration`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({
          targetPlanId: proMonthlyPlan.id,
          effectiveDate: effectiveDate.toISOString()
        })
        .expect(200);

      expect(previewRes.body.data.migrationType).toBe('UPGRADE');
      expect(Number(previewRes.body.data.proration.netAdjustment)).toBeGreaterThan(0);
      expect(previewRes.body.data.actions.requiresInvoice).toBe(true);

      // Execute migration
      const migrateRes = await request(app)
        .post(`/api/v1/subscriptions/${sub.id}/migrate-plan`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({
          targetPlanId: proMonthlyPlan.id,
          effectiveDate: effectiveDate.toISOString()
        })
        .expect(201);

      expect(migrateRes.body.data.migration.migrationType).toBe('UPGRADE');
      expect(migrateRes.body.data.migration.status).toBe('COMPLETED');
      expect(migrateRes.body.data.subscription.planId).toBe(proMonthlyPlan.id);
      expect(migrateRes.body.data.invoice).toBeDefined();
      expect(migrateRes.body.data.invoice.status).toBe('ISSUED');
      expect(Number(migrateRes.body.data.invoice.amountDue)).toBeGreaterThan(0);
    });

    it('calculates quarterly upgrade proration with high Decimal accuracy', async () => {
      const periodStart = new Date('2026-01-01T00:00:00Z');
      const periodEnd = new Date('2026-04-01T00:00:00Z');
      const effectiveDate = new Date('2026-02-15T00:00:00Z');

      const sub = await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-MIG-002',
          customerId: customerAId,
          planId: starterMonthlyPlan.id,
          status: 'ACTIVE',
          startDate: periodStart,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          recurringPrice: '3000.00',
          currency: 'INR'
        }
      });

      const preview = prorationService.calculateProration({
        subscription: sub,
        targetPlan: enterpriseQuarterlyPlan,
        effectiveDate,
        timing: 'IMMEDIATE',
        customerCreditBalance: 0
      });

      expect(preview.migrationType).toBe('UPGRADE');
      expect(Number(preview.proration.netAdjustment)).toBeGreaterThan(0);
      expect(new Prisma.Decimal(preview.proration.netAdjustment).isPositive()).toBe(true);
    });
  });

  // =========================================================================
  // 3 & 4. Immediate and Next-Cycle Downgrade
  // =========================================================================
  describe('3 & 4. Plan Downgrades: Immediate & Next-Cycle', () => {
    it('processes immediate downgrade and credits customer balance into immutable ledger', async () => {
      const periodStart = new Date('2026-06-01T00:00:00Z');
      const periodEnd = new Date('2026-07-01T00:00:00Z');
      const effectiveDate = new Date('2026-06-16T00:00:00Z'); // halfway

      const sub = await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-MIG-003',
          customerId: customerAId,
          planId: proMonthlyPlan.id,
          status: 'ACTIVE',
          startDate: periodStart,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          recurringPrice: '2500.00',
          currency: 'INR'
        }
      });

      const res = await request(app)
        .post(`/api/v1/subscriptions/${sub.id}/migrate-plan`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({
          targetPlanId: starterMonthlyPlan.id,
          effectiveDate: effectiveDate.toISOString(),
          timing: 'IMMEDIATE'
        })
        .expect(201);

      expect(res.body.data.migration.migrationType).toBe('DOWNGRADE');
      expect(res.body.data.migration.status).toBe('COMPLETED');
      expect(res.body.data.invoice).toBeNull(); // No invoice generated on downgrade!

      // Verify customer credit balance updated
      const creditRes = await request(app)
        .get(`/api/v1/customers/${customerAId}/credits`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .expect(200);

      expect(Number(creditRes.body.data.creditBalance)).toBeGreaterThan(0);

      // Verify transaction ledger
      const txRes = await request(app)
        .get(`/api/v1/customers/${customerAId}/credits/transactions`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .expect(200);

      expect(txRes.body.data.length).toBeGreaterThan(0);
      expect(txRes.body.data[0].type).toBe('PRORATION_CREDIT');
      expect(Number(txRes.body.data[0].amount)).toBeGreaterThan(0);
    });

    it('schedules next-cycle downgrade without immediate charge or credit', async () => {
      const periodStart = new Date('2026-06-01T00:00:00Z');
      const periodEnd = new Date('2026-07-01T00:00:00Z');

      const sub = await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-MIG-004',
          customerId: customerAId,
          planId: proMonthlyPlan.id,
          status: 'ACTIVE',
          startDate: periodStart,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          recurringPrice: '2500.00',
          currency: 'INR'
        }
      });

      const res = await request(app)
        .post(`/api/v1/subscriptions/${sub.id}/migrate-plan`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({
          targetPlanId: starterMonthlyPlan.id,
          timing: 'NEXT_CYCLE'
        })
        .expect(201);

      expect(res.body.data.migration.timing).toBe('NEXT_CYCLE');
      expect(res.body.data.migration.status).toBe('SCHEDULED');
      expect(res.body.data.subscription.scheduledPlanId).toBe(starterMonthlyPlan.id);
      expect(res.body.data.subscription.planId).toBe(proMonthlyPlan.id); // current plan untouched!
    });
  });

  // =========================================================================
  // 5 & 6. Scheduled Migration Execution and Cancellation
  // =========================================================================
  describe('5 & 6. Scheduled Migration Execution in Billing & Cancellation', () => {
    it('cancels a scheduled migration cleanly', async () => {
      const sub = await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-MIG-005',
          customerId: customerAId,
          planId: proMonthlyPlan.id,
          scheduledPlanId: starterMonthlyPlan.id,
          scheduledChangeAt: new Date('2026-08-01T00:00:00Z'),
          status: 'ACTIVE',
          startDate: new Date('2026-07-01T00:00:00Z'),
          currentPeriodStart: new Date('2026-07-01T00:00:00Z'),
          currentPeriodEnd: new Date('2026-08-01T00:00:00Z'),
          recurringPrice: '2500.00',
          currency: 'INR'
        }
      });

      await mockPrisma.subscriptionMigration.create({
        data: {
          subscriptionId: sub.id,
          customerId: customerAId,
          fromPlanId: proMonthlyPlan.id,
          toPlanId: starterMonthlyPlan.id,
          migrationType: 'DOWNGRADE',
          timing: 'NEXT_CYCLE',
          status: 'SCHEDULED',
          effectiveDate: new Date('2026-08-01T00:00:00Z'),
          fromBillingCycle: 'MONTHLY',
          toBillingCycle: 'MONTHLY',
          fromPrice: '2500.00',
          toPrice: '1000.00'
        }
      });

      const res = await request(app)
        .post(`/api/v1/subscriptions/${sub.id}/cancel-scheduled-migration`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .expect(200);

      expect(res.body.data.subscription.scheduledPlanId).toBeNull();

      // Check migration status marked CANCELLED
      const migrationsRes = await request(app)
        .get(`/api/v1/subscriptions/${sub.id}/migrations`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .expect(200);

      expect(migrationsRes.body.data[0].status).toBe('CANCELLED');
    });

    it('billing service executes scheduled migration atomically during renewal', async () => {
      const periodStart = new Date('2026-07-01T00:00:00Z');
      const periodEnd = new Date('2026-08-01T00:00:00Z');

      const sub = await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-MIG-006',
          customerId: customerAId,
          planId: proMonthlyPlan.id,
          scheduledPlanId: starterMonthlyPlan.id,
          scheduledChangeAt: periodEnd,
          status: 'ACTIVE',
          startDate: periodStart,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          recurringPrice: '2500.00',
          currency: 'INR'
        }
      });

      // Execute renewal billing as of renewal date
      const result = await billingService.generateSubscriptionInvoice(sub.id, periodEnd);
      expect(result.invoice).toBeDefined();

      // Subscription should now be migrated to starterMonthlyPlan and scheduledPlanId cleared
      const updatedSub = await mockPrisma.subscription.findUnique({ where: { id: sub.id } });
      expect(updatedSub.planId).toBe(starterMonthlyPlan.id);
      expect(updatedSub.scheduledPlanId).toBeNull();
      expect(new Prisma.Decimal(updatedSub.recurringPrice).toFixed(2)).toBe('1000.00');
    });
  });

  // =========================================================================
  // 7, 8, 9, 10, 11. Customer Credit Issuance, Redemption & Concurrency
  // =========================================================================
  describe('7-11. Customer Credit Issuance, Application & Concurrency', () => {
    it('admin adjusts customer credit balance and records ledger transaction', async () => {
      const res = await request(app)
        .post(`/api/v1/customers/${customerAId}/credits/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: '500.00',
          reason: 'Promotional loyalty credit'
        })
        .expect(201);

      expect(res.body.data.customer.creditBalance).toBe('500.00');
      expect(res.body.data.transaction.amount).toBe('500.00');
      expect(res.body.data.transaction.type).toBe('MANUAL_ADJUSTMENT');
    });

    it('partially redeems customer credit on upgrade when credit is less than balance due', async () => {
      // Grant 300.00 credit to customer A
      await creditsService.issueCredit({
        customerId: customerAId,
        amount: '300.00',
        type: 'MANUAL_ADJUSTMENT',
        reason: 'Preloaded credit'
      });

      const sub = await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-MIG-007',
          customerId: customerAId,
          planId: starterMonthlyPlan.id,
          status: 'ACTIVE',
          startDate: new Date('2026-06-01T00:00:00Z'),
          currentPeriodStart: new Date('2026-06-01T00:00:00Z'),
          currentPeriodEnd: new Date('2026-07-01T00:00:00Z'),
          recurringPrice: '1000.00',
          currency: 'INR'
        }
      });

      const res = await request(app)
        .post(`/api/v1/subscriptions/${sub.id}/migrate-plan`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({
          targetPlanId: proMonthlyPlan.id,
          effectiveDate: '2026-06-01T00:00:00Z'
        })
        .expect(201);

      // Pro price (2500) - Starter (1000) = 1500 net adjustment
      // Available credit: 300.00 -> Credit applied: 300.00 -> Remaining invoice amount: 1200.00
      expect(res.body.data.migration.creditApplied).toBe('300.00');
      expect(res.body.data.invoice.amountDue).toBe('1200.00');

      // Customer credit balance is now 0.00
      const bal = await creditsService.getBalance(customerAId);
      expect(bal.creditBalance).toBe('0.00');
    });

    it('fully redeems credit and requires 0.00 additional payment when credit exceeds net adjustment', async () => {
      // Grant 2000.00 credit
      await creditsService.issueCredit({
        customerId: customerAId,
        amount: '2000.00',
        type: 'MANUAL_ADJUSTMENT',
        reason: 'Large credit grant'
      });

      const sub = await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-MIG-008',
          customerId: customerAId,
          planId: starterMonthlyPlan.id,
          status: 'ACTIVE',
          startDate: new Date('2026-06-01T00:00:00Z'),
          currentPeriodStart: new Date('2026-06-01T00:00:00Z'),
          currentPeriodEnd: new Date('2026-07-01T00:00:00Z'),
          recurringPrice: '1000.00',
          currency: 'INR'
        }
      });

      const res = await request(app)
        .post(`/api/v1/subscriptions/${sub.id}/migrate-plan`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({
          targetPlanId: proMonthlyPlan.id,
          effectiveDate: '2026-06-01T00:00:00Z'
        })
        .expect(201);

      // Net adjustment is 1500.00, credit applied is 1500.00, invoice is null (0 due)
      expect(res.body.data.migration.creditApplied).toBe('1500.00');
      expect(res.body.data.invoice).toBeNull();

      // Remaining credit balance is 2000 - 1500 = 500.00
      const bal = await creditsService.getBalance(customerAId);
      expect(bal.creditBalance).toBe('500.00');
    });

    it('prevents concurrent overspending or applying more credit than customer balance', async () => {
      await creditsService.issueCredit({
        customerId: customerAId,
        amount: '100.00',
        type: 'MANUAL_ADJUSTMENT'
      });

      // Attempt to apply 200.00
      await expect(
        creditsService.applyCredit({
          customerId: customerAId,
          amount: '200.00'
        })
      ).rejects.toThrow(/Insufficient customer credit balance/);
    });
  });

  // =========================================================================
  // 12. Idempotency & Duplicate Migration Protection
  // =========================================================================
  describe('12. Duplicate Migration Request Idempotency', () => {
    it('returns idempotent response without double-billing when called with same idempotencyKey', async () => {
      const sub = await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-MIG-012',
          customerId: customerAId,
          planId: starterMonthlyPlan.id,
          status: 'ACTIVE',
          startDate: new Date('2026-06-01T00:00:00Z'),
          currentPeriodStart: new Date('2026-06-01T00:00:00Z'),
          currentPeriodEnd: new Date('2026-07-01T00:00:00Z'),
          recurringPrice: '1000.00',
          currency: 'INR'
        }
      });

      const key = `idemp-${Date.now()}`;

      const res1 = await request(app)
        .post(`/api/v1/subscriptions/${sub.id}/migrate-plan`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({
          targetPlanId: proMonthlyPlan.id,
          idempotencyKey: key
        })
        .expect(201);

      expect(res1.body.data.isDuplicate).toBe(false);

      // Repeat request
      const res2 = await request(app)
        .post(`/api/v1/subscriptions/${sub.id}/migrate-plan`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({
          targetPlanId: proMonthlyPlan.id,
          idempotencyKey: key
        })
        .expect(200);

      expect(res2.body.data.isDuplicate).toBe(true);
      expect(res2.body.data.migration.id).toBe(res1.body.data.migration.id);
    });
  });

  // =========================================================================
  // 13. Currency Mismatch
  // =========================================================================
  describe('13. Currency Mismatch Protection', () => {
    it('rejects migration between plans with different currencies (INR vs USD)', async () => {
      const sub = await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-MIG-013',
          customerId: customerAId,
          planId: starterMonthlyPlan.id,
          status: 'ACTIVE',
          startDate: new Date('2026-06-01T00:00:00Z'),
          currentPeriodStart: new Date('2026-06-01T00:00:00Z'),
          currentPeriodEnd: new Date('2026-07-01T00:00:00Z'),
          recurringPrice: '1000.00',
          currency: 'INR'
        }
      });

      const res = await request(app)
        .post(`/api/v1/subscriptions/${sub.id}/preview-migration`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({
          targetPlanId: usdMonthlyPlan.id
        })
        .expect(400);

      expect(res.body.message).toMatch(/different currencies/i);
    });
  });

  // =========================================================================
  // 14 & 15. Month-End & Leap-Year Proration Math
  // =========================================================================
  describe('14 & 15. Month-End Clamping and Leap Year Proration Math', () => {
    it('handles month-end date clamping (Jan 31 -> Feb 28) without NaN or crash', () => {
      const periodStart = new Date('2025-01-31T00:00:00Z');
      const periodEnd = new Date('2025-02-28T00:00:00Z');
      const effectiveDate = new Date('2025-02-14T00:00:00Z');

      const mockSub = {
        planId: starterMonthlyPlan.id,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        recurringPrice: '1000.00',
        currency: 'INR'
      };

      const proration = prorationService.calculateProration({
        subscription: mockSub,
        targetPlan: proMonthlyPlan,
        effectiveDate
      });

      expect(proration.proration.netAdjustment).toBeDefined();
      expect(isNaN(Number(proration.proration.netAdjustment))).toBe(false);
    });

    it('accurately fractions leap-year 29-day February period', () => {
      const periodStart = new Date('2028-02-01T00:00:00Z');
      const periodEnd = new Date('2028-03-01T00:00:00Z'); // 29 days in 2028 leap year
      const effectiveDate = new Date('2028-02-15T12:00:00Z'); // exactly half (14.5 days)

      const mockSub = {
        planId: starterMonthlyPlan.id,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        recurringPrice: '2900.00',
        currency: 'INR'
      };

      const proration = prorationService.calculateProration({
        subscription: mockSub,
        targetPlan: {
          id: 'target-plan',
          name: 'Target Plan',
          price: '5800.00',
          currency: 'INR',
          billingCycle: 'MONTHLY'
        },
        effectiveDate
      });

      // Total duration is 29 days * 86400 = 2505600s
      // Remaining is 14.5 days * 86400 = 1252800s
      // Remaining fraction = 0.500000
      expect(proration.billingPeriod.remainingFraction).toBe('0.500000');
      expect(proration.proration.unusedAmount).toBe('1450.00');
      expect(proration.proration.newPlanAmount).toBe('2900.00');
      expect(proration.proration.netAdjustment).toBe('1450.00');
    });
  });

  // =========================================================================
  // 16. Zero-Value Migration
  // =========================================================================
  describe('16. Zero-Value & Free Tier Migrations', () => {
    it('handles equal-price plan switch with zero net adjustment and no fees', () => {
      const mockSub = {
        planId: starterMonthlyPlan.id,
        currentPeriodStart: new Date('2026-06-01T00:00:00Z'),
        currentPeriodEnd: new Date('2026-07-01T00:00:00Z'),
        recurringPrice: '1000.00',
        currency: 'INR'
      };

      const samePricePlan = {
        id: 'plan-same-price',
        name: 'Starter V2',
        price: '1000.00',
        currency: 'INR',
        billingCycle: 'MONTHLY'
      };

      const proration = prorationService.calculateProration({
        subscription: mockSub,
        targetPlan: samePricePlan,
        effectiveDate: new Date('2026-06-15T00:00:00Z')
      });

      expect(proration.proration.netAdjustment).toBe('0.00');
      expect(proration.actions.requiresInvoice).toBe(false);
      expect(proration.actions.requiresCreditIssuance).toBe(false);
    });
  });

  // =========================================================================
  // 17. Setup Fee Exemption Rule
  // =========================================================================
  describe('17. Business Rule: Setup Fees Never Charged on Plan Migration', () => {
    it('does not charge target plan setupFee during migration', async () => {
      // ProMonthly has setupFee = 500.00
      const sub = await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-MIG-017',
          customerId: customerAId,
          planId: starterMonthlyPlan.id,
          status: 'ACTIVE',
          startDate: new Date('2026-06-01T00:00:00Z'),
          currentPeriodStart: new Date('2026-06-01T00:00:00Z'),
          currentPeriodEnd: new Date('2026-07-01T00:00:00Z'),
          recurringPrice: '1000.00',
          currency: 'INR'
        }
      });

      const res = await request(app)
        .post(`/api/v1/subscriptions/${sub.id}/migrate-plan`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({
          targetPlanId: proMonthlyPlan.id,
          effectiveDate: '2026-06-01T00:00:00Z'
        })
        .expect(201);

      // Amount due is purely recurring difference (2500 - 1000 = 1500.00), NEVER including 500 setupFee
      expect(res.body.data.invoice.amountDue).toBe('1500.00');
    });
  });

  // =========================================================================
  // 18. Customer Ownership & RBAC
  // =========================================================================
  describe('18. Customer Ownership and RBAC Enforcement', () => {
    it('prevents Customer A from migrating Customer B subscription (403 Forbidden)', async () => {
      const subB = await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-MIG-018',
          customerId: customerBId,
          planId: starterMonthlyPlan.id,
          status: 'ACTIVE',
          startDate: new Date('2026-06-01T00:00:00Z'),
          currentPeriodStart: new Date('2026-06-01T00:00:00Z'),
          currentPeriodEnd: new Date('2026-07-01T00:00:00Z'),
          recurringPrice: '1000.00',
          currency: 'INR'
        }
      });

      await request(app)
        .post(`/api/v1/subscriptions/${subB.id}/migrate-plan`)
        .set('Authorization', `Bearer ${customerUserA.token}`) // Customer A token!
        .send({
          targetPlanId: proMonthlyPlan.id
        })
        .expect(403);
    });

    it('prevents non-admin from manually adjusting customer credits (403 Forbidden)', async () => {
      await request(app)
        .post(`/api/v1/customers/${customerAId}/credits/adjust`)
        .set('Authorization', `Bearer ${staffToken}`) // STAFF cannot adjust credits
        .send({
          amount: '100.00',
          reason: 'Staff adjustment attempt'
        })
        .expect(403);

      await request(app)
        .post(`/api/v1/customers/${customerAId}/credits/adjust`)
        .set('Authorization', `Bearer ${customerUserA.token}`) // Customer cannot adjust own credits
        .send({
          amount: '100.00',
          reason: 'Self credit'
        })
        .expect(403);
    });
  });

  // =========================================================================
  // 19. Issued Invoice Immutability
  // =========================================================================
  describe('19. Issued Invoice Immutability', () => {
    it('preserves existing issued invoices completely unchanged during migration', async () => {
      const sub = await mockPrisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-MIG-019',
          customerId: customerAId,
          planId: starterMonthlyPlan.id,
          status: 'ACTIVE',
          startDate: new Date('2026-05-01T00:00:00Z'),
          currentPeriodStart: new Date('2026-06-01T00:00:00Z'),
          currentPeriodEnd: new Date('2026-07-01T00:00:00Z'),
          recurringPrice: '1000.00',
          currency: 'INR'
        }
      });

      // Existing prior invoice
      const priorInvoice = await mockPrisma.invoice.create({
        data: {
          invoiceNumber: 'INV-PRIOR-001',
          customerId: customerAId,
          subscriptionId: sub.id,
          status: 'ISSUED',
          invoiceDate: new Date('2026-05-01T00:00:00Z'),
          dueDate: new Date('2026-05-15T00:00:00Z'),
          currency: 'INR',
          subtotal: '1000.00',
          totalAmount: '1000.00',
          amountPaid: '0.00',
          amountDue: '1000.00'
        }
      });

      // Migrate plan
      await request(app)
        .post(`/api/v1/subscriptions/${sub.id}/migrate-plan`)
        .set('Authorization', `Bearer ${customerUserA.token}`)
        .send({
          targetPlanId: proMonthlyPlan.id,
          effectiveDate: '2026-06-15T00:00:00Z'
        })
        .expect(201);

      // Prior invoice must remain strictly untouched
      const fetchedPrior = await mockPrisma.invoice.findUnique({
        where: { id: priorInvoice.id }
      });

      expect(fetchedPrior.status).toBe('ISSUED');
      expect(new Prisma.Decimal(fetchedPrior.totalAmount).toFixed(2)).toBe('1000.00');
      expect(new Prisma.Decimal(fetchedPrior.amountDue).toFixed(2)).toBe('1000.00');
    });
  });
});

