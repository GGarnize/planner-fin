ALTER TABLE "CapturedNotification"
  ADD COLUMN "cardId" UUID,
  ADD COLUMN "confirmedCardPurchaseId" UUID;

CREATE UNIQUE INDEX "CapturedNotification_confirmedCardPurchaseId_key"
  ON "CapturedNotification"("confirmedCardPurchaseId");

ALTER TABLE "CapturedNotification"
  ADD CONSTRAINT "CapturedNotification_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "FinancialCreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CapturedNotification_confirmedCardPurchaseId_fkey"
    FOREIGN KEY ("confirmedCardPurchaseId") REFERENCES "CardPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
