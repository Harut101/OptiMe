-- CreateEnum
CREATE TYPE "PlanFeedbackRating" AS ENUM ('HELPFUL', 'NOT_HELPFUL');

-- CreateEnum
CREATE TYPE "PlanFeedbackTag" AS ENUM ('TOO_MUCH_FOOD', 'TOO_LITTLE_FOOD', 'TRAINING_TOO_HARD', 'TRAINING_TOO_EASY', 'FELT_GOOD', 'LOW_ENERGY', 'RECOVERY_NEEDED');

-- CreateTable
CREATE TABLE "DailyPlanFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyPlanId" TEXT NOT NULL,
    "rating" "PlanFeedbackRating",
    "tags" "PlanFeedbackTag"[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPlanFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyPlanFeedback_userId_dailyPlanId_key" ON "DailyPlanFeedback"("userId", "dailyPlanId");

-- CreateIndex
CREATE INDEX "DailyPlanFeedback_userId_createdAt_idx" ON "DailyPlanFeedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DailyPlanFeedback_dailyPlanId_idx" ON "DailyPlanFeedback"("dailyPlanId");

-- AddForeignKey
ALTER TABLE "DailyPlanFeedback" ADD CONSTRAINT "DailyPlanFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPlanFeedback" ADD CONSTRAINT "DailyPlanFeedback_dailyPlanId_fkey" FOREIGN KEY ("dailyPlanId") REFERENCES "DailyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
