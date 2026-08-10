CREATE TABLE "MonthlyBudget" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "month" CHAR(7) NOT NULL,
  "totalLimit" DECIMAL(19,2) NOT NULL,
  "notes" VARCHAR(2000),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "MonthlyBudget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MonthlyBudget_month_check" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT "MonthlyBudget_total_limit_check" CHECK ("totalLimit" > 0)
);

CREATE TABLE "MonthlyBudgetCategory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "budgetId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "limitAmount" DECIMAL(19,2) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "MonthlyBudgetCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MonthlyBudgetCategory_limit_amount_check" CHECK ("limitAmount" > 0)
);

CREATE UNIQUE INDEX "MonthlyBudget_userId_month_key" ON "MonthlyBudget"("userId", "month");
CREATE INDEX "MonthlyBudget_userId_idx" ON "MonthlyBudget"("userId");
CREATE UNIQUE INDEX "MonthlyBudgetCategory_budgetId_categoryId_key" ON "MonthlyBudgetCategory"("budgetId", "categoryId");
CREATE INDEX "MonthlyBudgetCategory_categoryId_idx" ON "MonthlyBudgetCategory"("categoryId");
ALTER TABLE "MonthlyBudget" ADD CONSTRAINT "MonthlyBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MonthlyBudgetCategory" ADD CONSTRAINT "MonthlyBudgetCategory_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "MonthlyBudget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MonthlyBudgetCategory" ADD CONSTRAINT "MonthlyBudgetCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
