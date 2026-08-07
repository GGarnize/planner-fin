CREATE TYPE "RecurrenceKind" AS ENUM ('TRANSACTION', 'TRANSFER');
CREATE TYPE "RecurrenceStatus" AS ENUM ('ACTIVE', 'PAUSED');
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');
CREATE TYPE "RecurrenceAttentionStatus" AS ENUM ('READY', 'BLOCKED');
CREATE TYPE "RecurrenceBlockedReason" AS ENUM ('RELATED_RESOURCE_ARCHIVED');
CREATE TYPE "RecurrenceBlockedResourceType" AS ENUM ('ACCOUNT', 'CATEGORY');

CREATE TABLE "RecurrenceRule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL,
  "kind" "RecurrenceKind" NOT NULL, "status" "RecurrenceStatus" NOT NULL DEFAULT 'ACTIVE',
  "frequency" "RecurrenceFrequency" NOT NULL, "startDate" DATE NOT NULL, "endDate" DATE,
  "dayOfWeek" INTEGER, "dayOfMonth" INTEGER, "monthOfYear" INTEGER,
  "transactionType" "FinancialTransactionType", "accountId" UUID, "categoryId" UUID,
  "sourceAccountId" UUID, "destinationAccountId" UUID,
  "plannedAmount" DECIMAL(19,2) NOT NULL, "description" VARCHAR(200) NOT NULL,
  "notes" VARCHAR(2000), "nextOccurrenceDate" DATE,
  "attentionStatus" "RecurrenceAttentionStatus" NOT NULL DEFAULT 'READY',
  "blockedReason" "RecurrenceBlockedReason", "blockedResourceType" "RecurrenceBlockedResourceType",
  "blockedResourceId" UUID, "blockedAt" TIMESTAMPTZ(3), "archivedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "RecurrenceRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecurrenceRule_dates_check" CHECK ("endDate" IS NULL OR "endDate" >= "startDate"),
  CONSTRAINT "RecurrenceRule_amount_check" CHECK ("plannedAmount" > 0),
  CONSTRAINT "RecurrenceRule_frequency_check" CHECK (
    ("frequency"='WEEKLY' AND "dayOfWeek" BETWEEN 1 AND 7 AND "dayOfMonth" IS NULL AND "monthOfYear" IS NULL) OR
    ("frequency"='MONTHLY' AND "dayOfWeek" IS NULL AND "dayOfMonth" BETWEEN 1 AND 31 AND "monthOfYear" IS NULL) OR
    ("frequency"='YEARLY' AND "dayOfWeek" IS NULL AND "dayOfMonth" BETWEEN 1 AND 31 AND "monthOfYear" BETWEEN 1 AND 12)
  ),
  CONSTRAINT "RecurrenceRule_kind_check" CHECK (
    ("kind"='TRANSACTION' AND "transactionType" IS NOT NULL AND "accountId" IS NOT NULL AND "categoryId" IS NOT NULL AND "sourceAccountId" IS NULL AND "destinationAccountId" IS NULL) OR
    ("kind"='TRANSFER' AND "transactionType" IS NULL AND "accountId" IS NULL AND "categoryId" IS NULL AND "sourceAccountId" IS NOT NULL AND "destinationAccountId" IS NOT NULL AND "sourceAccountId" <> "destinationAccountId")
  ),
  CONSTRAINT "RecurrenceRule_attention_check" CHECK (
    ("attentionStatus"='READY' AND "blockedReason" IS NULL AND "blockedResourceType" IS NULL AND "blockedResourceId" IS NULL AND "blockedAt" IS NULL) OR
    ("attentionStatus"='BLOCKED' AND "blockedReason" IS NOT NULL AND "blockedResourceType" IS NOT NULL AND "blockedResourceId" IS NOT NULL AND "blockedAt" IS NOT NULL)
  )
);
ALTER TABLE "FinancialTransaction" ADD COLUMN "recurrenceRuleId" UUID, ADD COLUMN "occurrenceDate" DATE;
ALTER TABLE "FinancialTransfer" ADD COLUMN "recurrenceRuleId" UUID, ADD COLUMN "occurrenceDate" DATE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_recurrence_link_check" CHECK (("recurrenceRuleId" IS NULL) = ("occurrenceDate" IS NULL));
ALTER TABLE "FinancialTransfer" ADD CONSTRAINT "FinancialTransfer_recurrence_link_check" CHECK (("recurrenceRuleId" IS NULL) = ("occurrenceDate" IS NULL));
CREATE UNIQUE INDEX "FinancialTransaction_recurrenceRuleId_occurrenceDate_key" ON "FinancialTransaction"("recurrenceRuleId", "occurrenceDate");
CREATE UNIQUE INDEX "FinancialTransfer_recurrenceRuleId_occurrenceDate_key" ON "FinancialTransfer"("recurrenceRuleId", "occurrenceDate");
CREATE INDEX "RecurrenceRule_userId_archivedAt_status_nextOccurrenceDate_idx" ON "RecurrenceRule"("userId", "archivedAt", "status", "nextOccurrenceDate");
CREATE INDEX "RecurrenceRule_userId_kind_frequency_idx" ON "RecurrenceRule"("userId", "kind", "frequency");
CREATE INDEX "RecurrenceRule_accountId_idx" ON "RecurrenceRule"("accountId");
CREATE INDEX "RecurrenceRule_categoryId_idx" ON "RecurrenceRule"("categoryId");
CREATE INDEX "RecurrenceRule_sourceAccountId_idx" ON "RecurrenceRule"("sourceAccountId");
CREATE INDEX "RecurrenceRule_destinationAccountId_idx" ON "RecurrenceRule"("destinationAccountId");
ALTER TABLE "RecurrenceRule" ADD CONSTRAINT "RecurrenceRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurrenceRule" ADD CONSTRAINT "RecurrenceRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurrenceRule" ADD CONSTRAINT "RecurrenceRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurrenceRule" ADD CONSTRAINT "RecurrenceRule_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurrenceRule" ADD CONSTRAINT "RecurrenceRule_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_recurrenceRuleId_fkey" FOREIGN KEY ("recurrenceRuleId") REFERENCES "RecurrenceRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransfer" ADD CONSTRAINT "FinancialTransfer_recurrenceRuleId_fkey" FOREIGN KEY ("recurrenceRuleId") REFERENCES "RecurrenceRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
