-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "deal_intent" "DealIntent" NOT NULL DEFAULT 'BUY';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "deal_intent" "DealIntent" NOT NULL DEFAULT 'BUY';

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "deal_intent" "DealIntent" NOT NULL DEFAULT 'BUY';

-- CreateIndex
CREATE INDEX "leads_deal_intent_stage_idx" ON "leads"("deal_intent", "stage");

-- CreateIndex
CREATE INDEX "properties_deal_intent_status_idx" ON "properties"("deal_intent", "status");

