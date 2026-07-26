import type { DailyPlan } from '@prisma/client';
import type { SupportedLocale } from '@optime/shared-types';

import type { DailyPlanPlanningUser } from './daily-plan-planning-user';

export interface GenerateDailyPlanUseCaseInput {
  userId: string;
  user: DailyPlanPlanningUser;
  existingPlan: DailyPlan | null;
  planLocalDate: string;
  planTimezone: string;
  locale: SupportedLocale;
  forceRegenerate: boolean;
  recreateForCurrentLanguage: boolean;
}
