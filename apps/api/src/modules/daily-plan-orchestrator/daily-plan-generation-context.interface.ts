import type {
  GoalImpactMode,
  PlanQualityMode
} from '@prisma/client';
import type {
  NutritionTarget,
  ResolvedTrainingDayContext,
  SupportedLocale
} from '@optime/shared-types';

import type { GenerateDailyPlanPersonalizationContext } from '../ai/ai-provider.interface';
import type { ExerciseSelectionResult } from '../exercise-selection/exercise-selection.types';
import type { DailyPlanPlanningUser } from './daily-plan-planning-user';

export interface PrepareDailyPlanGenerationContextInput {
  user: DailyPlanPlanningUser;
  planLocalDate: string;
}

export interface DailyPlanGenerationContext {
  locale: SupportedLocale;
  planQualityMode: PlanQualityMode;
  availableFoodSlugs: string[];
  appMode: GoalImpactMode;
  trainingEnabled: boolean;
  resolvedTrainingDay: ResolvedTrainingDayContext;
  nutritionTarget: NutritionTarget;
  personalizationContext: GenerateDailyPlanPersonalizationContext;
  exerciseSelection: ExerciseSelectionResult;
  blockedFoods: {
    allergies: string[];
    excludedFoods: string[];
  };
}
