CREATE TYPE "ProgressiveProfilePromptKey" AS ENUM (
  'PREFERRED_FOODS',
  'EXCLUDED_FOODS',
  'DIET_TYPE',
  'MEALS_PER_DAY',
  'TARGET_MUSCLE_GROUPS',
  'TRAINING_OUTCOME',
  'EQUIPMENT',
  'TRAINING_LEVEL',
  'LIMITATIONS_OR_PAIN_AREAS',
  'COOKING_TIME',
  'MEAL_PREP',
  'MEAL_TIMING'
);

CREATE TYPE "ProgressiveProfilePromptStatus" AS ENUM (
  'PENDING',
  'ANSWERED',
  'SKIPPED'
);

CREATE TABLE "UserProgressiveProfilePrompt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "promptKey" "ProgressiveProfilePromptKey" NOT NULL,
  "status" "ProgressiveProfilePromptStatus" NOT NULL DEFAULT 'PENDING',
  "answerJson" JSONB,
  "answeredAt" TIMESTAMP(3),
  "skippedAt" TIMESTAMP(3),
  "skippedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserProgressiveProfilePrompt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProgressiveProfilePrompt_userId_promptKey_key"
  ON "UserProgressiveProfilePrompt"("userId", "promptKey");

CREATE INDEX "UserProgressiveProfilePrompt_userId_status_idx"
  ON "UserProgressiveProfilePrompt"("userId", "status");

CREATE INDEX "UserProgressiveProfilePrompt_userId_skippedUntil_idx"
  ON "UserProgressiveProfilePrompt"("userId", "skippedUntil");

ALTER TABLE "UserProgressiveProfilePrompt"
  ADD CONSTRAINT "UserProgressiveProfilePrompt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
