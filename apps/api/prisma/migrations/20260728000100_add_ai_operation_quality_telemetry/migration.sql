ALTER TABLE "AiOperationLog"
ADD COLUMN "route" "AiModelRoute",
ADD COLUMN "planQualityMode" "PlanQualityMode",
ADD COLUMN "finalPlanStatus" "PlanStatus";

CREATE INDEX "AiOperationLog_route_createdAt_idx"
ON "AiOperationLog"("route", "createdAt");

CREATE INDEX "AiOperationLog_planQualityMode_createdAt_idx"
ON "AiOperationLog"("planQualityMode", "createdAt");

CREATE INDEX "AiOperationLog_finalPlanStatus_createdAt_idx"
ON "AiOperationLog"("finalPlanStatus", "createdAt");
