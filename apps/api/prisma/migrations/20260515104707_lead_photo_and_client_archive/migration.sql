-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_blacklisted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "interest_photo_url" TEXT;

-- CreateIndex
CREATE INDEX "clients_is_archived_idx" ON "clients"("is_archived");

-- CreateIndex
CREATE INDEX "clients_is_blacklisted_idx" ON "clients"("is_blacklisted");

