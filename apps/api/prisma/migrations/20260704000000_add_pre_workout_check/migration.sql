CREATE TYPE "PreWorkoutReadinessStatus" AS ENUM (
  'GOOD',
  'TIRED',
  'SORE',
  'PAIN_OR_LIMITATION',
  'SKIPPED'
);

ALTER TABLE "WorkoutSession"
  ADD COLUMN "preWorkoutReadinessStatus" "PreWorkoutReadinessStatus",
  ADD COLUMN "preWorkoutPainAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "preWorkoutNote" TEXT;
