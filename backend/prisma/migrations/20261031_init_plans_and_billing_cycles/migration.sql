-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CustomBillingUnit" AS ENUM ('DAYS', 'WEEKS', 'MONTHS', 'YEARS');

-- DropForeignKey
ALTER TABLE "Plan" DROP CONSTRAINT "Plan_variantId_fkey";

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "customDuration" INTEGER,
ADD COLUMN     "customDurationUnit" "CustomBillingUnit",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "price" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "productId" TEXT NOT NULL,
ADD COLUMN     "setupFee" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ALTER COLUMN "variantId" DROP NOT NULL,
ALTER COLUMN "priceInCents" SET DEFAULT 0,
ALTER COLUMN "currency" SET DEFAULT 'INR';

-- CreateTable
CREATE TABLE "PlanVariant" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanVariant_planId_idx" ON "PlanVariant"("planId");

-- CreateIndex
CREATE INDEX "PlanVariant_variantId_idx" ON "PlanVariant"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVariant_planId_variantId_key" ON "PlanVariant"("planId", "variantId");

-- CreateIndex
CREATE INDEX "Plan_productId_idx" ON "Plan"("productId");

-- CreateIndex
CREATE INDEX "Plan_billingCycle_idx" ON "Plan"("billingCycle");

-- CreateIndex
CREATE INDEX "Plan_isActive_idx" ON "Plan"("isActive");

-- CreateIndex
CREATE INDEX "Plan_createdAt_id_idx" ON "Plan"("createdAt", "id");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVariant" ADD CONSTRAINT "PlanVariant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVariant" ADD CONSTRAINT "PlanVariant_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

