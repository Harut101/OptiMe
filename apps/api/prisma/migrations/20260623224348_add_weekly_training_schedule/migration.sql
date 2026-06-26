-- CreateEnum
CREATE TYPE "TrainingEnvironment" AS ENUM ('HOME', 'GYM', 'OUTDOOR');

-- CreateEnum
CREATE TYPE "TrainingScheduleDayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "TrainingScheduleOverrideMode" AS ENUM ('USE_DEFAULT', 'CUSTOM');

-- CreateTable
CREATE TABLE "TrainingSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "weekStartsOn" "TrainingScheduleDayOfWeek" NOT NULL DEFAULT 'MONDAY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingScheduleDay" (
    "id" TEXT NOT NULL,
    "trainingScheduleId" TEXT NOT NULL,
    "dayOfWeek" "TrainingScheduleDayOfWeek" NOT NULL,
    "isTrainingDay" BOOLEAN NOT NULL DEFAULT false,
    "targetMusclesMode" "TrainingScheduleOverrideMode" NOT NULL DEFAULT 'USE_DEFAULT',
    "targetMuscles" "TargetMuscleGroup"[] DEFAULT ARRAY[]::"TargetMuscleGroup"[],
    "environmentMode" "TrainingScheduleOverrideMode" NOT NULL DEFAULT 'USE_DEFAULT',
    "environment" "TrainingEnvironment",
    "equipmentMode" "TrainingScheduleOverrideMode" NOT NULL DEFAULT 'USE_DEFAULT',
    "availableEquipment" "ExerciseEquipment"[] DEFAULT ARRAY[]::"ExerciseEquipment"[],
    "durationMode" "TrainingScheduleOverrideMode" NOT NULL DEFAULT 'USE_DEFAULT',
    "durationMinutes" INTEGER,
    "protocolMode" "TrainingScheduleOverrideMode" NOT NULL DEFAULT 'USE_DEFAULT',
    "protocolPreference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingScheduleDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingSchedule_userId_key" ON "TrainingSchedule"("userId");

-- CreateIndex
CREATE INDEX "TrainingSchedule_userId_isActive_idx" ON "TrainingSchedule"("userId", "isActive");

-- CreateIndex
CREATE INDEX "TrainingScheduleDay_dayOfWeek_idx" ON "TrainingScheduleDay"("dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingScheduleDay_trainingScheduleId_dayOfWeek_key" ON "TrainingScheduleDay"("trainingScheduleId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "TrainingSchedule" ADD CONSTRAINT "TrainingSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingScheduleDay" ADD CONSTRAINT "TrainingScheduleDay_trainingScheduleId_fkey" FOREIGN KEY ("trainingScheduleId") REFERENCES "TrainingSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
