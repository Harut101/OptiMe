import type { Prisma } from '@prisma/client';

import { normalizeDailyPlanJson } from '../daily-plans/daily-plan-normalizer';

export interface DailyPlanResponseSource {
  id: string;
  status: string;
  readinessLevel: string;
  planLocalDate: string;
  planTimezone: string;
  planJson: Prisma.JsonValue;
  updatedAt: Date;
}

export function toDailyPlanResponse(
  plan: DailyPlanResponseSource
) {
  const normalizedPlan = normalizeDailyPlanJson({
    planJson: plan.planJson,
    planLocalDate: plan.planLocalDate,
    planTimezone: plan.planTimezone,
    readinessLevel: plan.readinessLevel
  });

  return {
    id: plan.id,
    status: plan.status,
    readinessLevel: plan.readinessLevel,
    planLocalDate: plan.planLocalDate,
    planTimezone: plan.planTimezone,
    plan: normalizedPlan,
    updatedAt: plan.updatedAt.toISOString()
  };
}
