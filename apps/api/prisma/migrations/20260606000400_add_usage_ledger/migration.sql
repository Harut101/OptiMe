CREATE TYPE "UsagePeriodType" AS ENUM ('DAILY', 'MONTHLY');

CREATE TYPE "UsageFeature" AS ENUM (
    'DAILY_PLAN_GENERATION',
    'DAILY_PLAN_REFRESH',
    'AI_DAILY_PLAN_GENERATION',
    'AI_SAFETY_AGENT_REVIEW',
    'FUTURE_AI_COACH_MESSAGE'
);

CREATE TABLE "UsageLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" "UsageFeature" NOT NULL,
    "periodType" "UsagePeriodType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UsageLedger_userId_feature_periodType_periodStart_key" ON "UsageLedger"("userId", "feature", "periodType", "periodStart");
CREATE INDEX "UsageLedger_userId_periodStart_idx" ON "UsageLedger"("userId", "periodStart");
CREATE INDEX "UsageLedger_feature_periodStart_idx" ON "UsageLedger"("feature", "periodStart");
CREATE INDEX "UsageLedger_userId_feature_periodType_periodStart_idx" ON "UsageLedger"("userId", "feature", "periodType", "periodStart");

ALTER TABLE "UsageLedger" ADD CONSTRAINT "UsageLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
