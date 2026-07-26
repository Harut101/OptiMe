import type {
  GoalImpactMode,
  PlanQualityMode,
  PlanStatus
} from '@prisma/client';
import type {
  NutritionTarget,
  ResolvedTrainingDayContext,
  SupportedLocale
} from '@optime/shared-types';

import type { GenerateDailyPlanPersonalizationContext } from '../ai/ai-provider.interface';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import type { ExerciseSelectionResult } from '../exercise-selection/exercise-selection.types';
import type { SelectedProtocols } from '../protocol/protocol.types';
import type { FinalizedTrainingPlan } from '../training-plan-agent/training-plan-agent.interface';
import type { DailyPlanSafetyResult } from './daily-plan-safety-orchestrator.interface';

export interface PrepareProviderPlanDocumentInput {
  planJson: DailyPlanJson;
  resolvedTrainingDay: ResolvedTrainingDayContext;
  nutritionTarget: NutritionTarget;
  appMode: GoalImpactMode;
  locale: SupportedLocale;
}

export interface FinalizeDailyPlanGenerationInput {
  userId: string;
  planLocalDate: string;
  existingPlanId?: string;
  safePlanResult: DailyPlanSafetyResult;
  finalFoodPlan: NonNullable<DailyPlanJson['nutrition']['foodPlan']>;
  trainingPreparation: FinalizedTrainingPlan;
  exerciseSelection: ExerciseSelectionResult;
  resolvedTrainingDay: ResolvedTrainingDayContext;
  nutritionTarget: NutritionTarget;
  planQualityMode: PlanQualityMode;
  selectedProtocols?: SelectedProtocols;
  healthPlanningContext?: GenerateDailyPlanPersonalizationContext['healthPlanningContext'];
  trainingEnabled: boolean;
}

export interface FinalizedDailyPlanGeneration {
  safePlanResult: DailyPlanSafetyResult;
  status: PlanStatus;
  finalExerciseIds: string[];
}
