CREATE TABLE "TransactionTemplate" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "normalizedName" VARCHAR(80) NOT NULL,
    "type" "FinancialTransactionType" NOT NULL,
    "categoryId" UUID NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "plannedAmount" DECIMAL(19,2) NOT NULL,
    "defaultAccountId" UUID,
    "notes" VARCHAR(2000),
    "dueDay" INTEGER,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "TransactionTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TransactionTemplate_plannedAmount_check" CHECK ("plannedAmount" > 0),
    CONSTRAINT "TransactionTemplate_dueDay_check" CHECK ("dueDay" IS NULL OR "dueDay" BETWEEN 1 AND 31)
);
CREATE UNIQUE INDEX "TransactionTemplate_userId_normalizedName_key" ON "TransactionTemplate"("userId", "normalizedName");
CREATE INDEX "TransactionTemplate_userId_archivedAt_normalizedName_id_idx" ON "TransactionTemplate"("userId", "archivedAt", "normalizedName", "id");
CREATE INDEX "TransactionTemplate_categoryId_idx" ON "TransactionTemplate"("categoryId");
CREATE INDEX "TransactionTemplate_defaultAccountId_idx" ON "TransactionTemplate"("defaultAccountId");
ALTER TABLE "TransactionTemplate" ADD CONSTRAINT "TransactionTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionTemplate" ADD CONSTRAINT "TransactionTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionTemplate" ADD CONSTRAINT "TransactionTemplate_defaultAccountId_fkey" FOREIGN KEY ("defaultAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
