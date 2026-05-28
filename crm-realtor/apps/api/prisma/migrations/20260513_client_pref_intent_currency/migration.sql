-- Add deal intent (BUY/RENT) and currency to client_preferences
CREATE TYPE "DealIntent" AS ENUM ('BUY', 'RENT');
ALTER TABLE "client_preferences"
  ADD COLUMN "deal_intent" "DealIntent",
  ADD COLUMN "currency" VARCHAR(3) DEFAULT 'UAH';
