-- CreateEnum
CREATE TYPE "DailyTrainingOverrideType" AS ENUM ('TRAINING_DAY', 'REST_DAY');

-- CreateEnum
CREATE TYPE "DailyTrainingOverrideSource" AS ENUM ('USER_SELECTED_TRAIN_TODAY', 'USER_SELECTED_REST_TODAY', 'USER_MOVED_WORKOUT', 'MANUAL');

-- CreateTable
CREATE TABLE "DailyTrainingOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "overrideType" "DailyTrainingOverrideType" NOT NULL,
    "targetMuscles" "TargetMuscleGroup"[] DEFAULT ARRAY[]::"TargetMuscleGroup"[],
    "environment" "TrainingEnvironment",
    "availableEquipment" "ExerciseEquipment"[] DEFAULT ARRAY[]::"ExerciseEquipment"[],
    "durationMinutes" INTEGER,
    "protocolPreference" TEXT,
    "source" "DailyTrainingOverrideSource" NOT NULL DEFAULT 'MANUAL',
    "movedFromLocalDate" TEXT,
    "movedToLocalDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTrainingOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyTrainingOverride_userId_localDate_key" ON "DailyTrainingOverride"("userId", "localDate");

-- CreateIndex
CREATE INDEX "DailyTrainingOverride_userId_localDate_idx" ON "DailyTrainingOverride"("userId", "localDate");

-- CreateIndex
CREATE INDEX "DailyTrainingOverride_userId_overrideType_idx" ON "DailyTrainingOverride"("userId", "overrideType");

-- CreateIndex
CREATE INDEX "DailyTrainingOverride_source_idx" ON "DailyTrainingOverride"("source");

-- AddForeignKey
ALTER TABLE "DailyTrainingOverride" ADD CONSTRAINT "DailyTrainingOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
