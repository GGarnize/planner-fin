CREATE TYPE "CardInvoiceStatus" AS ENUM ('OPEN', 'CLOSED', 'PAID');

CREATE TABLE "FinancialCreditCard" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL, "issuer" VARCHAR(120), "last4" CHAR(4),
  "creditLimit" DECIMAL(19,2), "closingDay" INTEGER NOT NULL, "dueDay" INTEGER NOT NULL,
  "archivedAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "FinancialCreditCard_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancialCreditCard_days_check" CHECK ("closingDay" BETWEEN 1 AND 31 AND "dueDay" BETWEEN 1 AND 31),
  CONSTRAINT "FinancialCreditCard_last4_check" CHECK ("last4" IS NULL OR "last4" ~ '^[0-9]{4}$'),
  CONSTRAINT "FinancialCreditCard_limit_check" CHECK ("creditLimit" IS NULL OR "creditLimit" > 0)
);
CREATE TABLE "CardPurchase" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL, "cardId" UUID NOT NULL,
  "categoryId" UUID NOT NULL, "description" VARCHAR(200) NOT NULL, "notes" VARCHAR(2000),
  "purchaseDate" DATE NOT NULL, "totalAmount" DECIMAL(19,2) NOT NULL, "installmentCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "CardPurchase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CardPurchase_amount_check" CHECK ("totalAmount" > 0),
  CONSTRAINT "CardPurchase_installments_check" CHECK ("installmentCount" BETWEEN 1 AND 36 AND "totalAmount" * 100 >= "installmentCount")
);
CREATE TABLE "CardInvoice" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL, "cardId" UUID NOT NULL,
  "referenceMonth" CHAR(7) NOT NULL, "closingDate" DATE NOT NULL, "dueDate" DATE NOT NULL,
  "status" "CardInvoiceStatus" NOT NULL DEFAULT 'OPEN', "closedAt" TIMESTAMPTZ(3), "paidAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "CardInvoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CardInvoice_month_check" CHECK ("referenceMonth" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT "CardInvoice_dates_check" CHECK ("dueDate" > "closingDate"),
  CONSTRAINT "CardInvoice_status_check" CHECK (("status"='OPEN' AND "closedAt" IS NULL AND "paidAt" IS NULL) OR ("status"='CLOSED' AND "closedAt" IS NOT NULL AND "paidAt" IS NULL) OR ("status"='PAID' AND "closedAt" IS NOT NULL AND "paidAt" IS NOT NULL))
);
CREATE TABLE "CardInstallment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "purchaseId" UUID NOT NULL,
  "installmentNumber" INTEGER NOT NULL, "installmentCount" INTEGER NOT NULL,
  "amount" DECIMAL(19,2) NOT NULL, "referenceMonth" CHAR(7) NOT NULL, "invoiceId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardInstallment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CardInstallment_numbers_check" CHECK ("installmentCount" BETWEEN 1 AND 36 AND "installmentNumber" BETWEEN 1 AND "installmentCount"),
  CONSTRAINT "CardInstallment_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "CardInstallment_month_check" CHECK ("referenceMonth" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
CREATE TABLE "CardInvoicePayment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL, "invoiceId" UUID NOT NULL,
  "accountId" UUID NOT NULL, "amount" DECIMAL(19,2) NOT NULL, "paymentDate" DATE NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardInvoicePayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CardInvoicePayment_amount_check" CHECK ("amount" > 0)
);
CREATE INDEX "FinancialCreditCard_userId_archivedAt_name_id_idx" ON "FinancialCreditCard"("userId", "archivedAt", "name", "id");
CREATE INDEX "CardPurchase_userId_purchaseDate_createdAt_id_idx" ON "CardPurchase"("userId", "purchaseDate" DESC, "createdAt" DESC, "id");
CREATE INDEX "CardPurchase_userId_cardId_purchaseDate_idx" ON "CardPurchase"("userId", "cardId", "purchaseDate");
CREATE INDEX "CardPurchase_userId_categoryId_purchaseDate_idx" ON "CardPurchase"("userId", "categoryId", "purchaseDate");
CREATE UNIQUE INDEX "CardInstallment_purchaseId_installmentNumber_key" ON "CardInstallment"("purchaseId", "installmentNumber");
CREATE INDEX "CardInstallment_invoiceId_idx" ON "CardInstallment"("invoiceId");
CREATE INDEX "CardInstallment_referenceMonth_idx" ON "CardInstallment"("referenceMonth");
CREATE UNIQUE INDEX "CardInvoice_cardId_referenceMonth_key" ON "CardInvoice"("cardId", "referenceMonth");
CREATE INDEX "CardInvoice_userId_referenceMonth_createdAt_id_idx" ON "CardInvoice"("userId", "referenceMonth" DESC, "createdAt" DESC, "id");
CREATE INDEX "CardInvoice_userId_cardId_status_referenceMonth_idx" ON "CardInvoice"("userId", "cardId", "status", "referenceMonth");
CREATE UNIQUE INDEX "CardInvoicePayment_invoiceId_key" ON "CardInvoicePayment"("invoiceId");
CREATE INDEX "CardInvoicePayment_userId_paymentDate_id_idx" ON "CardInvoicePayment"("userId", "paymentDate" DESC, "id");
CREATE INDEX "CardInvoicePayment_userId_accountId_paymentDate_idx" ON "CardInvoicePayment"("userId", "accountId", "paymentDate");
ALTER TABLE "FinancialCreditCard" ADD CONSTRAINT "FinancialCreditCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "FinancialCreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardInvoice" ADD CONSTRAINT "CardInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardInvoice" ADD CONSTRAINT "CardInvoice_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "FinancialCreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardInstallment" ADD CONSTRAINT "CardInstallment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CardPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardInstallment" ADD CONSTRAINT "CardInstallment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CardInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardInvoicePayment" ADD CONSTRAINT "CardInvoicePayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardInvoicePayment" ADD CONSTRAINT "CardInvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CardInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardInvoicePayment" ADD CONSTRAINT "CardInvoicePayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
