-- CreateEnum
CREATE TYPE "ImportFormat" AS ENUM ('OFX', 'CSV');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'MAPPING_REQUIRED', 'READY_FOR_REVIEW', 'CONFIRMING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportRowValidationStatus" AS ENUM ('VALID', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ImportDuplicateClassification" AS ENUM ('NONE', 'STRONG', 'PROBABLE', 'POSSIBLE');

-- CreateTable
CREATE TABLE "ImportSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "format" "ImportFormat" NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "fileHash" CHAR(64) NOT NULL,
    "parserVersion" VARCHAR(32) NOT NULL,
    "displayFileName" VARCHAR(120),
    "mapping" JSONB,
    "sourceData" JSONB,
    "draftVersion" INTEGER NOT NULL DEFAULT 1,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "previewTokenHash" CHAR(64),
    "previewPayloadHash" CHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),

    CONSTRAINT "ImportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "date" DATE,
    "description" VARCHAR(200),
    "type" "FinancialTransactionType",
    "amount" DECIMAL(19,2),
    "externalId" VARCHAR(255),
    "categoryId" UUID,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "validationStatus" "ImportRowValidationStatus" NOT NULL,
    "warningCodes" JSONB NOT NULL,
    "editedFields" JSONB NOT NULL,
    "probableOverride" BOOLEAN NOT NULL DEFAULT false,
    "possibleAccepted" BOOLEAN NOT NULL DEFAULT false,
    "strongKeyHash" CHAR(64),
    "exactFingerprint" CHAR(64),
    "windowFingerprint" CHAR(64),
    "fingerprintVersion" INTEGER NOT NULL DEFAULT 1,
    "duplicateClassification" "ImportDuplicateClassification" NOT NULL DEFAULT 'NONE',
    "transactionId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportConfirmation" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportSession_userId_status_updatedAt_idx" ON "ImportSession"("userId", "status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "ImportSession_userId_fileHash_idx" ON "ImportSession"("userId", "fileHash");

-- CreateIndex
CREATE INDEX "ImportSession_status_expiresAt_idx" ON "ImportSession"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_transactionId_key" ON "ImportRow"("transactionId");

-- CreateIndex
CREATE INDEX "ImportRow_userId_sessionId_rowNumber_idx" ON "ImportRow"("userId", "sessionId", "rowNumber");

-- CreateIndex
CREATE INDEX "ImportRow_userId_strongKeyHash_idx" ON "ImportRow"("userId", "strongKeyHash");

-- A identidade forte permanece mesmo quando o lançamento vinculado vira tombstone.
CREATE UNIQUE INDEX "ImportRow_confirmed_strong_identity_key"
ON "ImportRow"("userId", "strongKeyHash")
WHERE "strongKeyHash" IS NOT NULL AND "transactionId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "ImportRow_userId_exactFingerprint_idx" ON "ImportRow"("userId", "exactFingerprint");

-- CreateIndex
CREATE INDEX "ImportRow_userId_windowFingerprint_date_idx" ON "ImportRow"("userId", "windowFingerprint", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_sessionId_rowNumber_key" ON "ImportRow"("sessionId", "rowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ImportConfirmation_sessionId_key" ON "ImportConfirmation"("sessionId");

-- CreateIndex
CREATE INDEX "ImportConfirmation_userId_createdAt_idx" ON "ImportConfirmation"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ImportConfirmation_userId_idempotencyKey_key" ON "ImportConfirmation"("userId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "ImportSession" ADD CONSTRAINT "ImportSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportSession" ADD CONSTRAINT "ImportSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ImportSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinancialTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportConfirmation" ADD CONSTRAINT "ImportConfirmation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ImportSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportConfirmation" ADD CONSTRAINT "ImportConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
