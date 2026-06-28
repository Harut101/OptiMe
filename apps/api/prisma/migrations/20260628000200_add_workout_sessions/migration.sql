-- CreateEnum
CREATE TYPE "WorkoutSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyPlanId" TEXT NOT NULL,
    "status" "WorkoutSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "plannedExerciseCount" INTEGER NOT NULL DEFAULT 0,
    "completedExerciseCount" INTEGER NOT NULL DEFAULT 0,
    "plannedSetCount" INTEGER NOT NULL DEFAULT 0,
    "completedSetCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExerciseProgress" (
    "id" TEXT NOT NULL,
    "workoutSessionId" TEXT NOT NULL,
    "planExerciseKey" TEXT NOT NULL,
    "planExerciseOrder" INTEGER NOT NULL,
    "exerciseId" TEXT,
    "exerciseSlug" TEXT,
    "exerciseNameSnapshot" TEXT NOT NULL,
    "plannedSets" INTEGER,
    "plannedReps" TEXT,
    "plannedDurationSeconds" INTEGER,
    "plannedRestSeconds" INTEGER,
    "completedSetIndexes" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "isExerciseCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutExerciseProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSession_userId_dailyPlanId_key" ON "WorkoutSession"("userId", "dailyPlanId");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_status_updatedAt_idx" ON "WorkoutSession"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_dailyPlanId_idx" ON "WorkoutSession"("dailyPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutExerciseProgress_workoutSessionId_planExerciseKey_key" ON "WorkoutExerciseProgress"("workoutSessionId", "planExerciseKey");

-- CreateIndex
CREATE INDEX "WorkoutExerciseProgress_workoutSessionId_planExerciseOrder_idx" ON "WorkoutExerciseProgress"("workoutSessionId", "planExerciseOrder");

-- AddForeignKey
ALTER TABLE "WorkoutSession"
ADD CONSTRAINT "WorkoutSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession"
ADD CONSTRAINT "WorkoutSession_dailyPlanId_fkey"
FOREIGN KEY ("dailyPlanId") REFERENCES "DailyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExerciseProgress"
ADD CONSTRAINT "WorkoutExerciseProgress_workoutSessionId_fkey"
FOREIGN KEY ("workoutSessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
