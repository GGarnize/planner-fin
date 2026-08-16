-- AlterEnum
ALTER TYPE "CapturedNotificationStatus" ADD VALUE 'FINANCIAL_CANDIDATE';

-- AlterTable
ALTER TABLE "CapturedNotification"
  ADD COLUMN "classifierVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "parsedType" "FinancialTransactionType",
  ADD COLUMN "parsedAmount" DECIMAL(19,2),
  ADD COLUMN "parsedDescription" VARCHAR(300),
  ADD COLUMN "classificationReasons" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "classifiedAt" TIMESTAMPTZ(3),
  ADD COLUMN "accountId" UUID,
  ADD COLUMN "categoryId" UUID,
  ADD COLUMN "confirmedTransactionId" UUID,
  ADD COLUMN "confirmedAt" TIMESTAMPTZ(3),
  ADD COLUMN "dismissedAt" TIMESTAMPTZ(3);

-- CreateIndex
CREATE UNIQUE INDEX "CapturedNotification_confirmedTransactionId_key" ON "CapturedNotification"("confirmedTransactionId");

-- AddForeignKey
ALTER TABLE "CapturedNotification" ADD CONSTRAINT "CapturedNotification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapturedNotification" ADD CONSTRAINT "CapturedNotification_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapturedNotification" ADD CONSTRAINT "CapturedNotification_confirmedTransactionId_fkey" FOREIGN KEY ("confirmedTransactionId") REFERENCES "FinancialTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
