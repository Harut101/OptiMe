CREATE TYPE "AiRequestAgent" AS ENUM (
  'DAILY_PLAN',
  'PLAN_CHECKPOINT',
  'NUTRITION',
  'SAFETY',
  'TRAINING_LOAD'
);

CREATE TYPE "AiRequestOperation" AS ENUM (
  'DAILY_PLAN_GENERATION',
  'PLAN_CHECKPOINT',
  'NUTRITION_GENERATION',
  'MENU_REGENERATION',
  'MEAL_REGENERATION',
  'SAFETY_REVIEW',
  'TRAINING_LOAD'
);

CREATE TYPE "AiModelRoute" AS ENUM ('LUNA', 'TERRA', 'SOL');

CREATE TABLE "AiRequestLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agent" "AiRequestAgent" NOT NULL,
  "operation" "AiRequestOperation" NOT NULL,
  "route" "AiModelRoute" NOT NULL,
  "provider" "AiOperationProvider" NOT NULL,
  "model" TEXT NOT NULL,
  "status" "AiOperationStatus" NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "retryAttempt" BOOLEAN NOT NULL DEFAULT false,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "totalTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostMicrousd" INTEGER,
  "errorReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiRequestLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiRequestLog_userId_createdAt_idx"
ON "AiRequestLog"("userId", "createdAt");

CREATE INDEX "AiRequestLog_agent_createdAt_idx"
ON "AiRequestLog"("agent", "createdAt");

CREATE INDEX "AiRequestLog_operation_createdAt_idx"
ON "AiRequestLog"("operation", "createdAt");

CREATE INDEX "AiRequestLog_route_createdAt_idx"
ON "AiRequestLog"("route", "createdAt");

CREATE INDEX "AiRequestLog_status_createdAt_idx"
ON "AiRequestLog"("status", "createdAt");

ALTER TABLE "AiRequestLog"
ADD CONSTRAINT "AiRequestLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
