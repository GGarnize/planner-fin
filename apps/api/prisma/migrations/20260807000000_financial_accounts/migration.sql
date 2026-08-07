CREATE TYPE "FinancialAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CASH', 'PAYMENT', 'OTHER');

CREATE TABLE "FinancialAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "FinancialAccountType" NOT NULL,
    "institution" VARCHAR(120),
    "currency" CHAR(3) NOT NULL,
    "openingBalance" DECIMAL(19,2) NOT NULL,
    "openingBalanceDate" DATE NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FinancialAccount_currency_check" CHECK ("currency" = 'BRL'),
    CONSTRAINT "FinancialAccount_openingBalance_check" CHECK ("openingBalance" BETWEEN -99999999999999999.99 AND 99999999999999999.99)
);

CREATE INDEX "FinancialAccount_userId_idx" ON "FinancialAccount"("userId");

ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
