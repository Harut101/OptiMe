-- CreateEnum
CREATE TYPE "AiOperationFeature" AS ENUM ('DAILY_PLAN');

-- CreateEnum
CREATE TYPE "AiOperationProvider" AS ENUM ('MOCK', 'OPENAI');

-- CreateEnum
CREATE TYPE "AiOperationStatus" AS ENUM ('SUCCESS', 'FALLBACK', 'ERROR');

-- CreateTable
CREATE TABLE "AiOperationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" "AiOperationFeature" NOT NULL,
    "provider" "AiOperationProvider" NOT NULL,
    "model" TEXT,
    "status" "AiOperationStatus" NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "safetyAgentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "safetyAgentProvider" TEXT,
    "safetyAgentApproved" BOOLEAN,
    "fallbackReason" TEXT,
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiOperationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiOperationLog_userId_createdAt_idx" ON "AiOperationLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiOperationLog_feature_createdAt_idx" ON "AiOperationLog"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "AiOperationLog_provider_createdAt_idx" ON "AiOperationLog"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "AiOperationLog_status_createdAt_idx" ON "AiOperationLog"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "AiOperationLog" ADD CONSTRAINT "AiOperationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
