import { PlanStatus } from '@prisma/client';

import type { GenerateDailyPlanExerciseFeedback } from '../ai/ai-provider.interface';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import type {
  ExerciseSelectionContext,
  ExerciseSelectionResult
} from '../exercise-selection/exercise-selection.types';

export interface TrainingPlanProviderResult {
  status: PlanStatus;
  planJson: DailyPlanJson;
}

export interface FinalizeTrainingPlanInput {
  providerPlanResult: TrainingPlanProviderResult;
  exerciseSelection: ExerciseSelectionResult;
  retry?: (
    feedback: GenerateDailyPlanExerciseFeedback
  ) => Promise<TrainingPlanProviderResult>;
}

export interface FinalizedTrainingPlan extends TrainingPlanProviderResult {
  usedAiRetry: boolean;
  usedDeterministicFallback: boolean;
  validationReasonCodes?: string[];
}

export interface TrainingPlanAgent {
  selectCandidates(context: ExerciseSelectionContext): Promise<ExerciseSelectionResult>;
  composeDeterministicFallback(
    planJson: DailyPlanJson,
    exerciseSelection: ExerciseSelectionResult
  ): DailyPlanJson;
  finalizeGeneratedPlan(input: FinalizeTrainingPlanInput): Promise<FinalizedTrainingPlan>;
}
