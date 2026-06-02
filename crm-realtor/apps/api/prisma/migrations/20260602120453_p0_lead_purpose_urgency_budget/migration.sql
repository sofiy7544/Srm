-- CreateEnum
CREATE TYPE "LeadPurpose" AS ENUM ('SPECIFIC_OBJECT', 'SELECTION', 'SALE', 'RENT_OUT', 'CONSULTATION', 'BROWSING');

-- CreateEnum
CREATE TYPE "LeadUrgency" AS ENUM ('URGENT', 'THIS_WEEK', 'THIS_MONTH', 'THREE_MONTHS', 'JUST_LOOKING');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "budget_currency" VARCHAR(3),
ADD COLUMN     "budget_max" DECIMAL(14,2),
ADD COLUMN     "budget_min" DECIMAL(14,2),
ADD COLUMN     "next_action_at" TIMESTAMP(3),
ADD COLUMN     "purpose" "LeadPurpose",
ADD COLUMN     "urgency" "LeadUrgency";

-- CreateIndex
CREATE INDEX "leads_assigned_user_id_next_action_at_idx" ON "leads"("assigned_user_id", "next_action_at");
