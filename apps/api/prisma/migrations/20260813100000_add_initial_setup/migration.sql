CREATE TYPE "InitialSetupStatus" AS ENUM ('NOT_STARTED', 'SKIPPED', 'COMPLETED');

CREATE TABLE "UserInitialSetup" (
  "userId" UUID NOT NULL,
  "status" "InitialSetupStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "draft" JSONB,
  "draftVersion" INTEGER NOT NULL DEFAULT 0,
  "suggestionVersion" INTEGER NOT NULL DEFAULT 1,
  "previewTokenHash" VARCHAR(64),
  "previewPayloadHash" VARCHAR(64),
  "previewExpiresAt" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  "skippedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserInitialSetup_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "SetupConfirmation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "payloadHash" VARCHAR(64) NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SetupConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SetupConfirmation_userId_idempotencyKey_key"
  ON "SetupConfirmation"("userId", "idempotencyKey");

CREATE INDEX "SetupConfirmation_userId_idx" ON "SetupConfirmation"("userId");

ALTER TABLE "UserInitialSetup"
  ADD CONSTRAINT "UserInitialSetup_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SetupConfirmation"
  ADD CONSTRAINT "SetupConfirmation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
