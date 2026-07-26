import type {
  GoalImpactMode,
  PlanQualityMode
} from '@prisma/client';
import type {
  ResolvedTrainingDayContext,
  SupportedLocale
} from '@optime/shared-types';

import type { GenerateDailyPlanPersonalizationContext } from '../ai/ai-provider.interface';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import type { ExerciseSelectionResult } from '../exercise-selection/exercise-selection.types';
import type { DailyPlanPlanningUser } from './daily-plan-planning-user';

export interface ApplyDailyPlanTrainingLoadInput {
  planJson: DailyPlanJson;
  user: DailyPlanPlanningUser;
  locale: SupportedLocale;
  planLocalDate: string;
  planQualityMode: PlanQualityMode;
  personalizationContext: GenerateDailyPlanPersonalizationContext;
  exerciseSelection: ExerciseSelectionResult;
  resolvedTrainingDay: ResolvedTrainingDayContext;
  appMode: GoalImpactMode;
  provider: 'mock' | 'openai';
}
