import { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import { SafetyAgentReview } from './safety-agent-review.schema';

export interface SafetyAgentGoalSummary {
  goalType?: string | null;
  targetWeightKg?: number | null;
  targetTimelineDays?: number | null;
  impactMode?: string | null;
}

export interface DeterministicSafetyContext {
  safeMode: boolean;
  isMinor: boolean;
  gender?: string | null;
  pregnancyStatus?: string | null;
  allergies: string[];
  excludedFoods: string[];
  deterministicSafetyPassed: boolean;
}

export interface ReviewDailyPlanInput {
  plan: DailyPlanJson;
  safeMode: boolean;
  goalSummary: SafetyAgentGoalSummary | null;
  deterministicSafetyContext: DeterministicSafetyContext;
}

export interface SafetyAgent {
  reviewDailyPlan(input: ReviewDailyPlanInput): Promise<SafetyAgentReview>;
}
