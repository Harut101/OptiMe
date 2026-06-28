-- CreateEnum
CREATE TYPE "FoodMealProgressStatus" AS ENUM ('PLANNED', 'EATEN', 'PARTIALLY_EATEN', 'SKIPPED');

-- CreateEnum
CREATE TYPE "FoodLogMealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'PRE_WORKOUT', 'POST_WORKOUT');

-- CreateTable
CREATE TABLE "FoodDayLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyPlanId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "plannedMealCount" INTEGER NOT NULL DEFAULT 0,
    "completedMealCount" INTEGER NOT NULL DEFAULT 0,
    "partialMealCount" INTEGER NOT NULL DEFAULT 0,
    "skippedMealCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodDayLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodMealProgress" (
    "id" TEXT NOT NULL,
    "foodDayLogId" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "mealOrder" INTEGER NOT NULL,
    "mealType" "FoodLogMealType" NOT NULL,
    "mealTitleSnapshot" TEXT NOT NULL,
    "status" "FoodMealProgressStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodMealProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FoodDayLog_userId_dailyPlanId_key" ON "FoodDayLog"("userId", "dailyPlanId");

-- CreateIndex
CREATE INDEX "FoodDayLog_userId_localDate_idx" ON "FoodDayLog"("userId", "localDate");

-- CreateIndex
CREATE INDEX "FoodDayLog_dailyPlanId_idx" ON "FoodDayLog"("dailyPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodMealProgress_foodDayLogId_mealId_key" ON "FoodMealProgress"("foodDayLogId", "mealId");

-- CreateIndex
CREATE INDEX "FoodMealProgress_foodDayLogId_mealOrder_idx" ON "FoodMealProgress"("foodDayLogId", "mealOrder");

-- CreateIndex
CREATE INDEX "FoodMealProgress_status_idx" ON "FoodMealProgress"("status");

-- AddForeignKey
ALTER TABLE "FoodDayLog"
ADD CONSTRAINT "FoodDayLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodDayLog"
ADD CONSTRAINT "FoodDayLog_dailyPlanId_fkey"
FOREIGN KEY ("dailyPlanId") REFERENCES "DailyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodMealProgress"
ADD CONSTRAINT "FoodMealProgress_foodDayLogId_fkey"
FOREIGN KEY ("foodDayLogId") REFERENCES "FoodDayLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
