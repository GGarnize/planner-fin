-- CreateEnum
CREATE TYPE "NotificationDeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "CapturedNotificationStatus" AS ENUM ('UNCLASSIFIED', 'NON_FINANCIAL', 'AMBIGUOUS', 'IGNORED', 'DISMISSED', 'CONFIRMED');

-- CreateTable
CREATE TABLE "NotificationDevice" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" VARCHAR(80) NOT NULL,
    "ownerBindingId" UUID NOT NULL,
    "name" VARCHAR(120),
    "status" "NotificationDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "captureEnabled" BOOLEAN NOT NULL DEFAULT false,
    "monitoredPackages" JSONB NOT NULL DEFAULT '[]',
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapturedNotification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceRecordId" UUID NOT NULL,
    "deviceId" VARCHAR(80) NOT NULL,
    "ownerBindingId" UUID NOT NULL,
    "packageName" VARCHAR(255) NOT NULL,
    "notificationKeyHash" CHAR(64) NOT NULL,
    "fingerprintHash" CHAR(64) NOT NULL,
    "fingerprintVersion" INTEGER NOT NULL DEFAULT 1,
    "postedAt" TIMESTAMPTZ(3) NOT NULL,
    "capturedAt" TIMESTAMPTZ(3) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" VARCHAR(300),
    "text" VARCHAR(1000),
    "subText" VARCHAR(300),
    "bigText" VARCHAR(4000),
    "status" "CapturedNotificationStatus" NOT NULL DEFAULT 'UNCLASSIFIED',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CapturedNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationIngestConfirmation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceRecordId" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationIngestConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDevice_ownerBindingId_key" ON "NotificationDevice"("ownerBindingId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDevice_userId_deviceId_key" ON "NotificationDevice"("userId", "deviceId");

-- CreateIndex
CREATE INDEX "NotificationDevice_userId_status_lastSeenAt_idx" ON "NotificationDevice"("userId", "status", "lastSeenAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CapturedNotification_userId_deviceId_packageName_notificationKeyHash_postedAt_fingerprintVersion_key"
ON "CapturedNotification"("userId", "deviceId", "packageName", "notificationKeyHash", "postedAt", "fingerprintVersion");

-- CreateIndex
CREATE INDEX "CapturedNotification_userId_status_receivedAt_idx" ON "CapturedNotification"("userId", "status", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "CapturedNotification_expiresAt_idx" ON "CapturedNotification"("expiresAt");

-- CreateIndex
CREATE INDEX "CapturedNotification_fingerprintHash_idx" ON "CapturedNotification"("fingerprintHash");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationIngestConfirmation_userId_idempotencyKey_key" ON "NotificationIngestConfirmation"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "NotificationIngestConfirmation_userId_createdAt_idx" ON "NotificationIngestConfirmation"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "NotificationDevice" ADD CONSTRAINT "NotificationDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapturedNotification" ADD CONSTRAINT "CapturedNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapturedNotification" ADD CONSTRAINT "CapturedNotification_deviceRecordId_fkey" FOREIGN KEY ("deviceRecordId") REFERENCES "NotificationDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationIngestConfirmation" ADD CONSTRAINT "NotificationIngestConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationIngestConfirmation" ADD CONSTRAINT "NotificationIngestConfirmation_deviceRecordId_fkey" FOREIGN KEY ("deviceRecordId") REFERENCES "NotificationDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
