-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- DropIndex
DROP INDEX "Customer_status_idx";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "contactName",
DROP COLUMN "shippingAddress",
DROP COLUMN "taxId",
ADD COLUMN     "alternatePhone" TEXT,
ADD COLUMN     "billingCity" TEXT,
ADD COLUMN     "billingCountry" TEXT,
ADD COLUMN     "billingPostalCode" TEXT,
ADD COLUMN     "billingState" TEXT,
ADD COLUMN     "customerCode" TEXT NOT NULL,
ADD COLUMN     "customerType" "CustomerType" NOT NULL DEFAULT 'COMPANY',
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "taxNumber" TEXT,
ALTER COLUMN "companyName" DROP NOT NULL,
ALTER COLUMN "billingAddress" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerCode_key" ON "Customer"("customerCode");

-- CreateIndex
CREATE INDEX "Customer_customerCode_idx" ON "Customer"("customerCode");

-- CreateIndex
CREATE INDEX "Customer_customerType_idx" ON "Customer"("customerType");

-- CreateIndex
CREATE INDEX "Customer_isActive_idx" ON "Customer"("isActive");
