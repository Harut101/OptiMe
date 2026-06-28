ALTER TYPE "HealthProvider" ADD VALUE IF NOT EXISTS 'WHOOP';
ALTER TYPE "HealthProvider" ADD VALUE IF NOT EXISTS 'MANUAL';
ALTER TYPE "HealthProvider" ADD VALUE IF NOT EXISTS 'MOCK';

ALTER TYPE "HealthConnectionStatus" ADD VALUE IF NOT EXISTS 'NOT_CONNECTED';
ALTER TYPE "HealthConnectionStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REAUTH';
ALTER TYPE "HealthConnectionStatus" ADD VALUE IF NOT EXISTS 'DISABLED';

CREATE TABLE "WearableDailySnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "HealthProvider" NOT NULL,
    "localDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "steps" INTEGER,
    "activeCaloriesKcal" INTEGER,
    "workoutMinutes" INTEGER,
    "sleepMinutes" INTEGER,
    "sleepQualityScore" INTEGER,
    "recoveryScore" INTEGER,
    "strainScore" DOUBLE PRECISION,
    "restingHeartRateBpm" INTEGER,
    "hrvMs" INTEGER,
    "respiratoryRate" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WearableDailySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WearableDailySnapshot_userId_source_localDate_key" ON "WearableDailySnapshot"("userId", "source", "localDate");
CREATE INDEX "WearableDailySnapshot_userId_localDate_idx" ON "WearableDailySnapshot"("userId", "localDate");
CREATE INDEX "WearableDailySnapshot_source_localDate_idx" ON "WearableDailySnapshot"("source", "localDate");
CREATE INDEX "WearableDailySnapshot_userId_capturedAt_idx" ON "WearableDailySnapshot"("userId", "capturedAt");

ALTER TABLE "WearableDailySnapshot" ADD CONSTRAINT "WearableDailySnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
