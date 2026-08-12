-- SPEC-017: soft delete aditivo para lancamentos financeiros.
ALTER TABLE "FinancialTransaction" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);

CREATE INDEX "FinancialTransaction_userId_deletedAt_dueDate_createdAt_id_idx"
  ON "FinancialTransaction"("userId", "deletedAt", "dueDate" DESC, "createdAt" DESC, "id");

CREATE INDEX "FinancialTransaction_userId_deletedAt_status_dueDate_idx"
  ON "FinancialTransaction"("userId", "deletedAt", "status", "dueDate");

CREATE INDEX "FinancialTransaction_userId_deletedAt_paidAt_idx"
  ON "FinancialTransaction"("userId", "deletedAt", "paidAt");
