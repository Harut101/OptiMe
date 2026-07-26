import type {
  PlanStatus,
  PregnancyStatus,
  TrainingLevel
} from '@prisma/client';
import type { SupportedLocale } from '@optime/shared-types';

import type { GenerateDailyPlanSafetyFeedback } from '../ai/ai-provider.interface';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';

export interface DailyPlanSafetyUserContext {
  safeMode: boolean;
  isMinor: boolean;
  gender?: string | null;
  pregnancyStatus?: PregnancyStatus | null;
  trainingLevel?: TrainingLevel | null;
  limitationsOrPainAreas: string[];
  painOrDiscomfortReported: boolean;
  highTirednessReported: boolean;
  goal: {
    goalType?: string | null;
    targetWeightKg?: number | null;
    targetTimelineDays?: number | null;
    impactMode?: string | null;
  } | null;
}

export interface ValidateDailyPlanSafetyInput {
  providerPlan: unknown;
  blockedFoods: {
    allergies: string[];
    excludedFoods: string[];
  };
  planLocalDate: string;
  planTimezone: string;
  locale: SupportedLocale;
  userContext: DailyPlanSafetyUserContext;
  forcedFallback?: boolean;
  allowSafetyRetry?: boolean;
  safetyRetryUsed?: boolean;
}

export interface DailyPlanSafetyResult {
  status: PlanStatus;
  planJson: DailyPlanJson;
  safetyRetryRequest?: GenerateDailyPlanSafetyFeedback;
}

export interface CreateSafetyFallbackInput {
  planLocalDate: string;
  planTimezone: string;
  locale: SupportedLocale;
  fallbackReason: string;
  approved?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
  retryUsed?: boolean;
  retryResult?: 'approved' | 'rejected' | 'failed' | 'not_used';
}
