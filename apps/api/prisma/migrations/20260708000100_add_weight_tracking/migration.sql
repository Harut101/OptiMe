ALTER TYPE "HealthProvider" ADD VALUE 'GARMIN';

CREATE TYPE "WeightDataSource" AS ENUM (
  'MANUAL',
  'APPLE_HEALTH',
  'HEALTH_CONNECT',
  'WHOOP',
  'GARMIN'
);

CREATE TABLE "WeightLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "localDate" TEXT NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "weightKg" DECIMAL(6,2) NOT NULL,
  "source" "WeightDataSource" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WeightLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeightLog_userId_localDate_source_key" ON "WeightLog"("userId", "localDate", "source");
CREATE INDEX "WeightLog_userId_measuredAt_idx" ON "WeightLog"("userId", "measuredAt");
CREATE INDEX "WeightLog_userId_localDate_idx" ON "WeightLog"("userId", "localDate");
CREATE INDEX "WeightLog_userId_source_localDate_idx" ON "WeightLog"("userId", "source", "localDate");

ALTER TABLE "WeightLog"
ADD CONSTRAINT "WeightLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
