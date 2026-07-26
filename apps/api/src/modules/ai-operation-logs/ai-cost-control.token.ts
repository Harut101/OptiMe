import type { SubscriptionPlan } from '@prisma/client';

export const AI_COST_CONTROL_CONFIG = Symbol(
  'AI_COST_CONTROL_CONFIG'
);

export interface AiCostControlConfig {
  enforcementEnabled: boolean;
  monthlyCeilingMicrousd: Record<SubscriptionPlan, number>;
}
