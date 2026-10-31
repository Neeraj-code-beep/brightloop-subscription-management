-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('VAT', 'GST', 'SALES_TAX', 'CUSTOMS', 'EXCISE', 'OTHER');

-- AlterTable Tax
ALTER TABLE "Tax" ADD COLUMN "code" TEXT;
ALTER TABLE "Tax" ADD COLUMN "rate" DECIMAL(5,2);
ALTER TABLE "Tax" ADD COLUMN "type" "TaxType" NOT NULL DEFAULT 'SALES_TAX';
ALTER TABLE "Tax" ADD COLUMN "description" TEXT;
ALTER TABLE "Tax" ADD COLUMN "validFrom" TIMESTAMP(3);
ALTER TABLE "Tax" ADD COLUMN "validTo" TIMESTAMP(3);
ALTER TABLE "Tax" ADD COLUMN "isCompound" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tax" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tax" ALTER COLUMN "jurisdiction" DROP NOT NULL;

-- AlterTable Discount
ALTER TABLE "Discount" ADD COLUMN "name" TEXT;
ALTER TABLE "Discount" ADD COLUMN "description" TEXT;
ALTER TABLE "Discount" ALTER COLUMN "value" TYPE DECIMAL(12,2) USING "value"::numeric;
ALTER TABLE "Discount" ADD COLUMN "valueInBasisPoints" INTEGER;
ALTER TABLE "Discount" ADD COLUMN "minPurchaseAmount" DECIMAL(12,2);
ALTER TABLE "Discount" ADD COLUMN "maxDiscountAmount" DECIMAL(12,2);
ALTER TABLE "Discount" ADD COLUMN "maxRedemptionsPerCustomer" INTEGER DEFAULT 1;

-- CreateTable DiscountRedemption
CREATE TABLE "DiscountRedemption" (
    "id" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "quotationId" TEXT,
    "subscriptionId" TEXT,
    "amountApplied" DECIMAL(12,2) NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tax_code_key" ON "Tax"("code");
CREATE INDEX "Tax_isActive_idx" ON "Tax"("isActive");
CREATE INDEX "Tax_code_idx" ON "Tax"("code");
CREATE INDEX "Tax_createdAt_id_idx" ON "Tax"("createdAt", "id");

CREATE INDEX "Discount_code_idx" ON "Discount"("code");
CREATE INDEX "Discount_isActive_idx" ON "Discount"("isActive");
CREATE INDEX "Discount_createdAt_id_idx" ON "Discount"("createdAt", "id");

CREATE INDEX "DiscountRedemption_discountId_customerId_idx" ON "DiscountRedemption"("discountId", "customerId");
CREATE INDEX "DiscountRedemption_customerId_idx" ON "DiscountRedemption"("customerId");

-- AddForeignKey
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

