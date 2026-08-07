CREATE TYPE "FinancialTransferStatus" AS ENUM ('PENDING', 'COMPLETED');

CREATE TABLE "FinancialTransfer" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sourceAccountId" UUID NOT NULL,
    "destinationAccountId" UUID NOT NULL,
    "status" "FinancialTransferStatus" NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "notes" VARCHAR(2000),
    "plannedAmount" DECIMAL(19,2) NOT NULL,
    "actualAmount" DECIMAL(19,2),
    "dueDate" DATE NOT NULL,
    "completedAt" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "FinancialTransfer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FinancialTransfer_distinct_accounts_check" CHECK ("sourceAccountId" <> "destinationAccountId"),
    CONSTRAINT "FinancialTransfer_planned_amount_positive_check" CHECK ("plannedAmount" > 0),
    CONSTRAINT "FinancialTransfer_actual_amount_positive_check" CHECK ("actualAmount" IS NULL OR "actualAmount" > 0),
    CONSTRAINT "FinancialTransfer_status_fields_check" CHECK (
      ("status" = 'PENDING' AND "actualAmount" IS NULL AND "completedAt" IS NULL)
      OR ("status" = 'COMPLETED' AND "actualAmount" IS NOT NULL AND "completedAt" IS NOT NULL)
    )
);

CREATE INDEX "FinancialTransfer_userId_dueDate_createdAt_id_idx" ON "FinancialTransfer"("userId", "dueDate" DESC, "createdAt" DESC, "id");
CREATE INDEX "FinancialTransfer_userId_sourceAccountId_dueDate_idx" ON "FinancialTransfer"("userId", "sourceAccountId", "dueDate");
CREATE INDEX "FinancialTransfer_userId_destinationAccountId_dueDate_idx" ON "FinancialTransfer"("userId", "destinationAccountId", "dueDate");
CREATE INDEX "FinancialTransfer_userId_status_dueDate_idx" ON "FinancialTransfer"("userId", "status", "dueDate");
CREATE INDEX "FinancialTransfer_userId_completedAt_idx" ON "FinancialTransfer"("userId", "completedAt");

ALTER TABLE "FinancialTransfer" ADD CONSTRAINT "FinancialTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransfer" ADD CONSTRAINT "FinancialTransfer_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransfer" ADD CONSTRAINT "FinancialTransfer_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
