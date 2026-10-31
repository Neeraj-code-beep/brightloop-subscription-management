-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('PRORATION_CREDIT', 'MANUAL_ADJUSTMENT', 'INVOICE_APPLICATION', 'REFUND');

-- CreateEnum
CREATE TYPE "MigrationType" AS ENUM ('UPGRADE', 'DOWNGRADE', 'SAME_PLAN_CYCLE_CHANGE');

-- CreateEnum
CREATE TYPE "MigrationTiming" AS ENUM ('IMMEDIATE', 'NEXT_CYCLE');

-- CreateEnum
CREATE TYPE "MigrationStatus" AS ENUM ('COMPLETED', 'SCHEDULED', 'CANCELLED');

-- AlterTable Customer
ALTER TABLE "Customer" ADD COLUMN "creditBalance" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- AlterTable Subscription
ALTER TABLE "Subscription" ADD COLUMN "scheduledPlanId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "scheduledChangeAt" TIMESTAMP(3);

-- CreateTable CreditTransaction
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "invoiceId" TEXT,
    "migrationId" TEXT,
    "type" "CreditTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reason" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable SubscriptionMigration
CREATE TABLE "SubscriptionMigration" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fromPlanId" TEXT NOT NULL,
    "toPlanId" TEXT NOT NULL,
    "migrationType" "MigrationType" NOT NULL,
    "timing" "MigrationTiming" NOT NULL,
    "status" "MigrationStatus" NOT NULL DEFAULT 'COMPLETED',
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledExecutionDate" TIMESTAMP(3),
    "fromBillingCycle" "BillingCycle" NOT NULL,
    "toBillingCycle" "BillingCycle" NOT NULL,
    "fromPrice" DECIMAL(12,2) NOT NULL,
    "toPrice" DECIMAL(12,2) NOT NULL,
    "unusedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "newPlanAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "netAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "creditApplied" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "invoiceIssuedId" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionMigration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_idempotencyKey_key" ON "CreditTransaction"("idempotencyKey");
CREATE INDEX "CreditTransaction_customerId_createdAt_idx" ON "CreditTransaction"("customerId", "createdAt");
CREATE INDEX "CreditTransaction_subscriptionId_idx" ON "CreditTransaction"("subscriptionId");
CREATE INDEX "CreditTransaction_invoiceId_idx" ON "CreditTransaction"("invoiceId");
CREATE INDEX "CreditTransaction_migrationId_idx" ON "CreditTransaction"("migrationId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionMigration_idempotencyKey_key" ON "SubscriptionMigration"("idempotencyKey");
CREATE INDEX "SubscriptionMigration_subscriptionId_createdAt_idx" ON "SubscriptionMigration"("subscriptionId", "createdAt");
CREATE INDEX "SubscriptionMigration_customerId_idx" ON "SubscriptionMigration"("customerId");
CREATE INDEX "SubscriptionMigration_status_idx" ON "SubscriptionMigration"("status");
CREATE INDEX "SubscriptionMigration_effectiveDate_idx" ON "SubscriptionMigration"("effectiveDate");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_scheduledPlanId_fkey" FOREIGN KEY ("scheduledPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "SubscriptionMigration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubscriptionMigration" ADD CONSTRAINT "SubscriptionMigration_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionMigration" ADD CONSTRAINT "SubscriptionMigration_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionMigration" ADD CONSTRAINT "SubscriptionMigration_fromPlanId_fkey" FOREIGN KEY ("fromPlanId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionMigration" ADD CONSTRAINT "SubscriptionMigration_toPlanId_fkey" FOREIGN KEY ("toPlanId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionMigration" ADD CONSTRAINT "SubscriptionMigration_invoiceIssuedId_fkey" FOREIGN KEY ("invoiceIssuedId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

