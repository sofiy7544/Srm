-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "consent_timestamp" TIMESTAMP(3),
ADD COLUMN     "consent_version" TEXT,
ADD COLUMN     "marketing_consent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lost_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_available" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "leads_last_activity_at_idx" ON "leads"("last_activity_at");

