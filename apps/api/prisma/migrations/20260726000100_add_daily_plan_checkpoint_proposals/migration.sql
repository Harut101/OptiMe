-- CreateEnum
CREATE TYPE "PlanCheckpointProposalStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED', 'EXPIRED');

-- CreateTable
CREATE TABLE "DailyPlanCheckpointProposal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyPlanId" TEXT NOT NULL,
    "sourcePlanUpdatedAt" TIMESTAMP(3) NOT NULL,
    "trigger" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "reasonCodes" TEXT[],
    "affectedSections" TEXT[],
    "evaluationJson" JSONB NOT NULL,
    "proposedPlanJson" JSONB NOT NULL,
    "summaryTitle" TEXT NOT NULL,
    "summaryMessage" TEXT NOT NULL,
    "status" "PlanCheckpointProposalStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPlanCheckpointProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyPlanCheckpointProposal_userId_status_createdAt_idx" ON "DailyPlanCheckpointProposal"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DailyPlanCheckpointProposal_dailyPlanId_status_createdAt_idx" ON "DailyPlanCheckpointProposal"("dailyPlanId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DailyPlanCheckpointProposal_sourcePlanUpdatedAt_idx" ON "DailyPlanCheckpointProposal"("sourcePlanUpdatedAt");

-- AddForeignKey
ALTER TABLE "DailyPlanCheckpointProposal" ADD CONSTRAINT "DailyPlanCheckpointProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPlanCheckpointProposal" ADD CONSTRAINT "DailyPlanCheckpointProposal_dailyPlanId_fkey" FOREIGN KEY ("dailyPlanId") REFERENCES "DailyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
