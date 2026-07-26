import type { GenerateDailyPlanPersonalizationContext } from '../ai/ai-provider.interface';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import type { RecoveryProtocol } from '../protocol/protocol.types';

export type RecoveryPlanMode = 'NORMAL' | 'GENTLE' | 'CONSERVATIVE';

export interface FinalizeRecoveryPlanInput {
  planJson: DailyPlanJson;
  recoveryProtocol?: RecoveryProtocol;
  healthPlanningContext?: GenerateDailyPlanPersonalizationContext['healthPlanningContext'];
  trainingEnabled: boolean;
  isTrainingDay: boolean;
}

export interface FinalizedRecoveryPlan {
  planJson: DailyPlanJson;
  mode: RecoveryPlanMode;
  contextApplied: boolean;
}

export interface RecoveryPlanAgent {
  finalizeGeneratedPlan(input: FinalizeRecoveryPlanInput): FinalizedRecoveryPlan;
}
