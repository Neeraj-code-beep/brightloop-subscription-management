-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SOFTWARE', 'SERVICE', 'SUBSCRIPTION', 'ADD_ON');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "basePrice" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "costPrice" DECIMAL(12,2),
ADD COLUMN     "type" "ProductType" NOT NULL DEFAULT 'SOFTWARE';

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "additionalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "description" TEXT,
ALTER COLUMN "unitPriceInCents" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_type_idx" ON "Product"("type");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX "Product_createdAt_id_idx" ON "Product"("createdAt", "id");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "ProductVariant_isActive_idx" ON "ProductVariant"("isActive");

-- CreateIndex
CREATE INDEX "ProductVariant_createdAt_id_idx" ON "ProductVariant"("createdAt", "id");

