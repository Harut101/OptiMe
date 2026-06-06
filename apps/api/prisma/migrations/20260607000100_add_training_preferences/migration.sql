-- Sprint 6 Batch 2: optional training preference storage.
CREATE TYPE "TrainingOutcome" AS ENUM ('STRENGTH', 'MUSCLE_GROWTH', 'ENDURANCE', 'MOBILITY', 'GENERAL_FITNESS');

CREATE TYPE "TrainingLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

CREATE TYPE "TargetMuscleGroup" AS ENUM ('CHEST', 'BACK', 'LEGS', 'GLUTES', 'CORE', 'SHOULDERS', 'ARMS', 'FULL_BODY');

CREATE TYPE "TrainingEquipment" AS ENUM ('GYM', 'HOME', 'DUMBBELLS', 'BODYWEIGHT', 'MACHINES');

CREATE TABLE "TrainingPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetMuscleGroups" "TargetMuscleGroup"[] DEFAULT ARRAY[]::"TargetMuscleGroup"[],
  "trainingOutcome" "TrainingOutcome",
  "equipment" "TrainingEquipment"[] DEFAULT ARRAY[]::"TrainingEquipment"[],
  "trainingLevel" "TrainingLevel",
  "limitationsOrPainAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "preferredTrainingDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrainingPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingPreference_userId_key" ON "TrainingPreference"("userId");

ALTER TABLE "TrainingPreference"
ADD CONSTRAINT "TrainingPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
