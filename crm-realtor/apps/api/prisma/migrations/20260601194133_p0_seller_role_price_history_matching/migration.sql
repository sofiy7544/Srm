-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('BUYER', 'SELLER', 'BOTH');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "type" "ClientType" NOT NULL DEFAULT 'BUYER';

-- AlterTable
ALTER TABLE "leads" ALTER COLUMN "priority" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "seller_client_id" UUID;

-- CreateTable
CREATE TABLE "property_price_history" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'UAH',
    "changed_by_id" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_price_history_property_id_changed_at_idx" ON "property_price_history"("property_id", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "clients_type_idx" ON "clients"("type");

-- CreateIndex
CREATE INDEX "properties_seller_client_id_idx" ON "properties"("seller_client_id");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_seller_client_id_fkey" FOREIGN KEY ("seller_client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_price_history" ADD CONSTRAINT "property_price_history_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_price_history" ADD CONSTRAINT "property_price_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
