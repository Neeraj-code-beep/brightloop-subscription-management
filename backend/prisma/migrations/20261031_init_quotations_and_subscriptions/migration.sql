-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "nextBillingDate" TIMESTAMP(3),
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "recurringPrice" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "resumedAt" TIMESTAMP(3),
ADD COLUMN     "setupFee" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "subscriptionNumber" TEXT NOT NULL,
ALTER COLUMN "billingCycleAnchor" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "currency" SET DEFAULT 'INR';

-- AlterTable
ALTER TABLE "SubscriptionItem" ADD COLUMN     "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "selectedVariants" JSONB,
ADD COLUMN     "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ALTER COLUMN "unitPriceInCents" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "planId" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "setupFee" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "selectedVariants" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");

-- CreateIndex
CREATE INDEX "QuotationItem_productId_idx" ON "QuotationItem"("productId");

-- CreateIndex
CREATE INDEX "QuotationItem_planId_idx" ON "QuotationItem"("planId");

-- CreateIndex
CREATE INDEX "QuotationItem_createdAt_id_idx" ON "QuotationItem"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Quotation_createdAt_id_idx" ON "Quotation"("createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_subscriptionNumber_key" ON "Subscription"("subscriptionNumber");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "Subscription_createdAt_id_idx" ON "Subscription"("createdAt", "id");

-- CreateIndex
CREATE INDEX "SubscriptionItem_planId_idx" ON "SubscriptionItem"("planId");

-- CreateIndex
CREATE INDEX "SubscriptionItem_createdAt_id_idx" ON "SubscriptionItem"("createdAt", "id");

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

