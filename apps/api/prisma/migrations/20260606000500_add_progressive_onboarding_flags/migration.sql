-- Sprint 5 progressive onboarding flags.
-- noKnownAllergiesConfirmed distinguishes "not answered" from "no known allergies".
-- noTrainingPlanned lets Stage 1 proceed with conservative training guidance.
ALTER TABLE "User" ADD COLUMN "noTrainingPlanned" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "NutritionPreference"
  ALTER COLUMN "mealsPerDay" SET DEFAULT 3,
  ADD COLUMN "noKnownAllergiesConfirmed" BOOLEAN NOT NULL DEFAULT false;
