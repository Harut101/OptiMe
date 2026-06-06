CREATE TYPE "DailyCheckInType" AS ENUM (
  'MEAL',
  'TRAINING',
  'EVENING_REFLECTION'
);

CREATE TABLE "DailyPlanCheckIn" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dailyPlanId" TEXT NOT NULL,
  "type" "DailyCheckInType" NOT NULL,
  "subjectKey" TEXT NOT NULL DEFAULT 'default',
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DailyPlanCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyPlanCheckIn_userId_dailyPlanId_type_subjectKey_key"
  ON "DailyPlanCheckIn"("userId", "dailyPlanId", "type", "subjectKey");

CREATE INDEX "DailyPlanCheckIn_userId_createdAt_idx"
  ON "DailyPlanCheckIn"("userId", "createdAt");

CREATE INDEX "DailyPlanCheckIn_dailyPlanId_type_idx"
  ON "DailyPlanCheckIn"("dailyPlanId", "type");

CREATE INDEX "DailyPlanCheckIn_userId_dailyPlanId_idx"
  ON "DailyPlanCheckIn"("userId", "dailyPlanId");

ALTER TABLE "DailyPlanCheckIn"
  ADD CONSTRAINT "DailyPlanCheckIn_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyPlanCheckIn"
  ADD CONSTRAINT "DailyPlanCheckIn_dailyPlanId_fkey"
  FOREIGN KEY ("dailyPlanId") REFERENCES "DailyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
