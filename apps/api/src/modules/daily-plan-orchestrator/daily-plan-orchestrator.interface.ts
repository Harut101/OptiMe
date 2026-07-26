import type { GenerateDailyPlanExerciseFeedback } from '../ai/ai-provider.interface';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import type { ExerciseSelectionResult } from '../exercise-selection/exercise-selection.types';
import type { HealthPlanningContext } from '../health/health-planning.types';
import type { RecoveryProtocol } from '../protocol/protocol.types';
import type {
  FinalizeRecoveryPlanInput,
  FinalizedRecoveryPlan
} from '../recovery-plan-agent/recovery-plan-agent.interface';
import type {
  FinalizedTrainingPlan,
  TrainingPlanProviderResult
} from '../training-plan-agent/training-plan-agent.interface';
import type {
  CreateSafetyFallbackInput,
  DailyPlanSafetyResult,
  ValidateDailyPlanSafetyInput
} from './daily-plan-safety-orchestrator.interface';

export interface AssembleDailyPlanInput {
  providerPlanResult: TrainingPlanProviderResult;
  foodPlan: NonNullable<DailyPlanJson['nutrition']['foodPlan']>;
  exerciseSelection: ExerciseSelectionResult;
  recoveryProtocol?: RecoveryProtocol;
  healthPlanningContext?: HealthPlanningContext;
  trainingEnabled: boolean;
  isTrainingDay: boolean;
  decorateProviderPlan: (planJson: DailyPlanJson) => DailyPlanJson;
  attachFoodPlan: (
    planJson: DailyPlanJson,
    foodPlan: NonNullable<DailyPlanJson['nutrition']['foodPlan']>
  ) => DailyPlanJson;
  applyTrainingLoad: (planJson: DailyPlanJson) => Promise<DailyPlanJson>;
  retryTrainingPlan?: (
    feedback: GenerateDailyPlanExerciseFeedback
  ) => Promise<TrainingPlanProviderResult>;
}

export interface AssembledDailyPlan {
  providerPlanResult: TrainingPlanProviderResult;
  trainingPreparation: FinalizedTrainingPlan;
}

export interface DailyPlanOrchestrator {
  assembleBeforeSafety(input: AssembleDailyPlanInput): Promise<AssembledDailyPlan>;
  finalizeRecoveryContext(input: FinalizeRecoveryPlanInput): FinalizedRecoveryPlan;
  validateBeforePersistence(
    input: ValidateDailyPlanSafetyInput
  ): DailyPlanSafetyResult | Promise<DailyPlanSafetyResult>;
  createSafetyFallback(input: CreateSafetyFallbackInput): DailyPlanSafetyResult;
}
