import type {
  GoalImpactMode,
  PlanQualityMode
} from '@prisma/client';
import type {
  DailyFoodPlan,
  NutritionTarget,
  ResolvedTrainingDayContext,
  SupportedLocale
} from '@optime/shared-types';

import type {
  GenerateDailyPlanExerciseFeedback,
  GenerateDailyPlanPersonalizationContext,
  GenerateDailyPlanSafetyFeedback
} from '../ai/ai-provider.interface';
import type { ExerciseSelectionResult } from '../exercise-selection/exercise-selection.types';
import type { TrainingPlanProviderResult } from '../training-plan-agent/training-plan-agent.interface';
import type { DailyPlanPlanningUser } from './daily-plan-planning-user';

export interface GenerateProviderDailyPlanInput {
  user: DailyPlanPlanningUser;
  locale: SupportedLocale;
  planLocalDate: string;
  planTimezone: string;
  planQualityMode: PlanQualityMode;
  personalizationContext: GenerateDailyPlanPersonalizationContext;
  exerciseSelection: ExerciseSelectionResult;
  exerciseFeedback?: GenerateDailyPlanExerciseFeedback;
  safetyFeedback?: GenerateDailyPlanSafetyFeedback;
}

export interface GenerateDailyFoodPlanInput {
  user: DailyPlanPlanningUser;
  locale: SupportedLocale;
  planLocalDate: string;
  planQualityMode: PlanQualityMode;
  appMode: GoalImpactMode;
  nutritionTarget: NutritionTarget;
  personalizationContext: GenerateDailyPlanPersonalizationContext;
  availableFoodSlugs: string[];
  resolvedTrainingDay: ResolvedTrainingDayContext;
  safetyFeedback?: GenerateDailyPlanSafetyFeedback;
}

export interface DailyPlanAgentExecution {
  getProviderName(): 'mock' | 'openai';
  generateProviderPlan(
    input: GenerateProviderDailyPlanInput
  ): Promise<TrainingPlanProviderResult>;
  generateFoodPlan(
    input: GenerateDailyFoodPlanInput
  ): Promise<DailyFoodPlan>;
}
