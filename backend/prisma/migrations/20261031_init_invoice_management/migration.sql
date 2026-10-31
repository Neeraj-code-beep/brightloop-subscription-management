-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'ISSUED';
ALTER TYPE "InvoiceStatus" ADD VALUE 'PARTIALLY_PAID';
ALTER TYPE "InvoiceStatus" ADD VALUE 'OVERDUE';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "periodStart" TIMESTAMP(3),
ADD COLUMN     "periodEnd" TIMESTAMP(3),
ADD COLUMN     "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "amountDue" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "termsAndConditions" TEXT,
ADD COLUMN     "issuedAt" TIMESTAMP(3),
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB,
ALTER COLUMN "currency" SET DEFAULT 'INR';

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "productId" TEXT,
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "subscriptionItemId" TEXT,
ADD COLUMN     "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "lineSubtotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ALTER COLUMN "unitPriceInCents" SET DEFAULT 0,
ALTER COLUMN "totalInCents" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_subscriptionId_periodStart_periodEnd_key" ON "Invoice"("subscriptionId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "Invoice_subscriptionId_idx" ON "Invoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_id_idx" ON "Invoice"("createdAt", "id");

-- CreateIndex
CREATE INDEX "InvoiceItem_productId_idx" ON "InvoiceItem"("productId");

-- CreateIndex
CREATE INDEX "InvoiceItem_planId_idx" ON "InvoiceItem"("planId");

-- CreateIndex
CREATE INDEX "InvoiceItem_subscriptionItemId_idx" ON "InvoiceItem"("subscriptionItemId");

-- CreateIndex
CREATE INDEX "InvoiceItem_createdAt_id_idx" ON "InvoiceItem"("createdAt", "id");

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_subscriptionItemId_fkey" FOREIGN KEY ("subscriptionItemId") REFERENCES "SubscriptionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
