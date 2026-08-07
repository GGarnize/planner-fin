CREATE TYPE "DebtType" AS ENUM ('LOAN', 'FINANCING', 'NEGOTIATED_DEBT', 'OTHER');
CREATE TYPE "DebtStatus" AS ENUM ('ACTIVE', 'PAID_OFF');
CREATE TYPE "DebtInstallmentStatus" AS ENUM ('PENDING', 'PAID');

CREATE TABLE "FinancialDebt" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL,
  "type" "DebtType" NOT NULL, "creditorName" VARCHAR(120) NOT NULL,
  "description" VARCHAR(200), "notes" VARCHAR(2000),
  "originalPrincipal" DECIMAL(19,2) NOT NULL, "startDate" DATE NOT NULL,
  "installmentCount" INTEGER NOT NULL, "status" "DebtStatus" NOT NULL DEFAULT 'ACTIVE',
  "archivedAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "FinancialDebt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancialDebt_principal_check" CHECK ("originalPrincipal" > 0),
  CONSTRAINT "FinancialDebt_installment_count_check" CHECK ("installmentCount" BETWEEN 1 AND 600)
);
CREATE TABLE "DebtFunding" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL, "debtId" UUID NOT NULL,
  "accountId" UUID NOT NULL, "amount" DECIMAL(19,2) NOT NULL, "fundingDate" DATE NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DebtFunding_pkey" PRIMARY KEY ("id"), CONSTRAINT "DebtFunding_amount_check" CHECK ("amount" > 0)
);
CREATE TABLE "DebtInstallment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "debtId" UUID NOT NULL, "installmentNumber" INTEGER NOT NULL,
  "dueDate" DATE NOT NULL, "principalAmount" DECIMAL(19,2) NOT NULL,
  "interestAmount" DECIMAL(19,2) NOT NULL, "feeAmount" DECIMAL(19,2) NOT NULL,
  "status" "DebtInstallmentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "DebtInstallment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DebtInstallment_components_check" CHECK ("installmentNumber" > 0 AND "principalAmount" > 0 AND "interestAmount" >= 0 AND "feeAmount" >= 0)
);
CREATE TABLE "DebtPayment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL, "debtId" UUID NOT NULL,
  "installmentId" UUID NOT NULL, "accountId" UUID NOT NULL, "paymentDate" DATE NOT NULL,
  "principalAmount" DECIMAL(19,2) NOT NULL, "interestAmount" DECIMAL(19,2) NOT NULL,
  "feeAmount" DECIMAL(19,2) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DebtPayment_components_check" CHECK ("principalAmount" > 0 AND "interestAmount" >= 0 AND "feeAmount" >= 0)
);
CREATE UNIQUE INDEX "DebtFunding_debtId_key" ON "DebtFunding"("debtId");
CREATE INDEX "DebtFunding_userId_accountId_fundingDate_idx" ON "DebtFunding"("userId", "accountId", "fundingDate");
CREATE UNIQUE INDEX "DebtInstallment_debtId_installmentNumber_key" ON "DebtInstallment"("debtId", "installmentNumber");
CREATE INDEX "DebtInstallment_debtId_status_dueDate_installmentNumber_idx" ON "DebtInstallment"("debtId", "status", "dueDate", "installmentNumber");
CREATE UNIQUE INDEX "DebtPayment_installmentId_key" ON "DebtPayment"("installmentId");
CREATE INDEX "DebtPayment_userId_paymentDate_id_idx" ON "DebtPayment"("userId", "paymentDate" DESC, "id" DESC);
CREATE INDEX "DebtPayment_userId_accountId_paymentDate_idx" ON "DebtPayment"("userId", "accountId", "paymentDate");
CREATE INDEX "DebtPayment_debtId_paymentDate_id_idx" ON "DebtPayment"("debtId", "paymentDate" DESC, "id" DESC);
CREATE INDEX "FinancialDebt_userId_archivedAt_status_type_idx" ON "FinancialDebt"("userId", "archivedAt", "status", "type");
CREATE INDEX "FinancialDebt_userId_createdAt_id_idx" ON "FinancialDebt"("userId", "createdAt" DESC, "id" DESC);
ALTER TABLE "FinancialDebt" ADD CONSTRAINT "FinancialDebt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DebtFunding" ADD CONSTRAINT "DebtFunding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DebtFunding" ADD CONSTRAINT "DebtFunding_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "FinancialDebt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DebtFunding" ADD CONSTRAINT "DebtFunding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DebtInstallment" ADD CONSTRAINT "DebtInstallment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "FinancialDebt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "FinancialDebt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "DebtInstallment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
