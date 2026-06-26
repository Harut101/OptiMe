-- Add normalized primary goal support while preserving existing GoalType data.
CREATE TYPE "PrimaryGoal" AS ENUM (
  'WEIGHT_LOSS',
  'WEIGHT_MAINTENANCE',
  'WEIGHT_GAIN',
  'HEALTHY_EATING'
);

ALTER TABLE "Goal" ADD COLUMN "primaryGoal" "PrimaryGoal";

UPDATE "Goal"
SET "primaryGoal" = CASE
  WHEN "goalType" = 'REDUCE_WEIGHT' THEN 'WEIGHT_LOSS'::"PrimaryGoal"
  WHEN "goalType" = 'BUILD_MUSCLE' THEN 'WEIGHT_GAIN'::"PrimaryGoal"
  ELSE 'HEALTHY_EATING'::"PrimaryGoal"
END
WHERE "primaryGoal" IS NULL;
