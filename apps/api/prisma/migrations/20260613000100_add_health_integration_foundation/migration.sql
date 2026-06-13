-- CreateEnum
CREATE TYPE "HealthProvider" AS ENUM ('APPLE_HEALTH', 'HEALTH_CONNECT');

-- CreateEnum
CREATE TYPE "HealthConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'PERMISSION_DENIED', 'ERROR');

-- CreateTable
CREATE TABLE "HealthConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "HealthProvider" NOT NULL,
    "status" "HealthConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "consentedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "permissionsGranted" JSONB,
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthDailySummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "sourceProvider" "HealthProvider" NOT NULL,
    "steps" INTEGER,
    "sleepMinutes" INTEGER,
    "activeEnergyKcal" INTEGER,
    "workoutCount" INTEGER,
    "workoutMinutes" INTEGER,
    "averageHeartRate" INTEGER,
    "restingHeartRate" INTEGER,
    "weightKg" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthDailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HealthConnection_userId_provider_key" ON "HealthConnection"("userId", "provider");

-- CreateIndex
CREATE INDEX "HealthConnection_userId_status_idx" ON "HealthConnection"("userId", "status");

-- CreateIndex
CREATE INDEX "HealthConnection_provider_status_idx" ON "HealthConnection"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HealthDailySummary_userId_localDate_sourceProvider_key" ON "HealthDailySummary"("userId", "localDate", "sourceProvider");

-- CreateIndex
CREATE INDEX "HealthDailySummary_userId_localDate_idx" ON "HealthDailySummary"("userId", "localDate");

-- CreateIndex
CREATE INDEX "HealthDailySummary_sourceProvider_localDate_idx" ON "HealthDailySummary"("sourceProvider", "localDate");

-- AddForeignKey
ALTER TABLE "HealthConnection" ADD CONSTRAINT "HealthConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthDailySummary" ADD CONSTRAINT "HealthDailySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
