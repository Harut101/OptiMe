import type {
  DailyPlan,
  PlanStatus
} from '@prisma/client';

import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import type { DailyPlanSafetyResult } from './daily-plan-safety-orchestrator.interface';

export interface DailyPlanOperationContext {
  provider: 'mock' | 'openai';
  safetyAgentEnabled: boolean;
  safetyAgentProvider: string;
}

export interface RecordDailyPlanGenerationInput {
  userId: string;
  status: PlanStatus;
  planJson: DailyPlanJson;
  latencyMs: number;
  operation: DailyPlanOperationContext;
}

export interface PersistGeneratedDailyPlanInput {
  userId: string;
  existingPlanId?: string;
  planLocalDate: string;
  planTimezone: string;
  result: DailyPlanSafetyResult;
  operationStartedAt: number;
  operation: DailyPlanOperationContext;
}

export interface PersistGeneratedDailyPlanResult {
  plan: DailyPlan;
  status: PlanStatus;
}

export interface RecordDailyPlanGenerationErrorInput {
  userId: string;
  latencyMs: number;
  error: unknown;
  operation: DailyPlanOperationContext;
}
