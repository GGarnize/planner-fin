CREATE TYPE "FinancialTransactionType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "FinancialTransactionStatus" AS ENUM ('PENDING', 'PAID');

CREATE TABLE "FinancialTransaction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "type" "FinancialTransactionType" NOT NULL,
  "status" "FinancialTransactionStatus" NOT NULL,
  "description" VARCHAR(200) NOT NULL,
  "notes" VARCHAR(2000),
  "plannedAmount" DECIMAL(19,2) NOT NULL,
  "actualAmount" DECIMAL(19,2),
  "dueDate" DATE NOT NULL,
  "paidAt" DATE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "FinancialTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancialTransaction_plannedAmount_check" CHECK ("plannedAmount" > 0),
  CONSTRAINT "FinancialTransaction_actualAmount_check" CHECK ("actualAmount" IS NULL OR "actualAmount" > 0),
  CONSTRAINT "FinancialTransaction_status_check" CHECK (
    ("status" = 'PENDING' AND "actualAmount" IS NULL AND "paidAt" IS NULL) OR
    ("status" = 'PAID' AND "actualAmount" IS NOT NULL AND "paidAt" IS NOT NULL)
  )
);
CREATE INDEX "FinancialTransaction_userId_dueDate_createdAt_id_idx" ON "FinancialTransaction"("userId", "dueDate" DESC, "createdAt" DESC, "id" ASC);
CREATE INDEX "FinancialTransaction_userId_accountId_dueDate_idx" ON "FinancialTransaction"("userId", "accountId", "dueDate");
CREATE INDEX "FinancialTransaction_userId_categoryId_dueDate_idx" ON "FinancialTransaction"("userId", "categoryId", "dueDate");
CREATE INDEX "FinancialTransaction_userId_status_dueDate_idx" ON "FinancialTransaction"("userId", "status", "dueDate");
CREATE INDEX "FinancialTransaction_userId_paidAt_idx" ON "FinancialTransaction"("userId", "paidAt");
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
