CREATE TYPE "PostWorkoutFeeling" AS ENUM ('GOOD', 'TOO_EASY', 'TOO_HARD', 'PAIN_DURING_WORKOUT', 'SKIPPED');

ALTER TABLE "WorkoutSession"
ADD COLUMN "preWorkoutConflictDetected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "preWorkoutConflictMuscleGroups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "preWorkoutConflictingExerciseKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "preWorkoutAcknowledgedPainConflict" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "postWorkoutFeeling" "PostWorkoutFeeling",
ADD COLUMN "postWorkoutPainAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "postWorkoutNote" TEXT;
