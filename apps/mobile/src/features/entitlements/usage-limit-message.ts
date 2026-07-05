import type { TFunction } from 'i18next';

import { ApiError } from '@/api/client';
import { formatTime } from '@/i18n/formatters';
import { getSubscriptionPlanLabel } from '@/i18n/enum-labels';
import type { UsageLimitExceededError } from '@/types/api';

export function getUsageLimitError(error: unknown) {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== 'object') {
    return null;
  }

  const body = error.body as Partial<UsageLimitExceededError>;
  return body.code === 'USAGE_LIMIT_REACHED' ? (body as UsageLimitExceededError) : null;
}

export function formatUsageLimitMessage(
  error: UsageLimitExceededError,
  t: TFunction,
  locale: string
) {
  const reset = error.resetAt
    ? t('limits.tryAfter', { time: formatTime(error.resetAt, locale) })
    : t('limits.tryAfterReset');

  return String(
    t('limits.message' as never, {
      plan: String(getSubscriptionPlanLabel(t, error.currentPlan)),
      limit: error.limit,
      action: getUsageFeatureLabel(error.feature, t),
      reset
    } as never)
  );
}

export function getUsageFeatureLabel(feature: UsageLimitExceededError['feature'], t: TFunction) {
  switch (feature) {
    case 'DAILY_PLAN_REFRESH':
      return String(t('limits.features.dailyPlanRefresh'));
    case 'AI_DAILY_PLAN_GENERATION':
      return String(t('limits.features.aiDailyPlanGeneration'));
    case 'MEAL_REGENERATION':
      return String(t('limits.features.mealRegeneration'));
    case 'MENU_REGENERATION':
      return String(t('limits.features.menuRegeneration'));
    case 'AI_TRAINING_LOAD_AGENT':
      return String(t('limits.features.aiTrainingLoadAgent'));
    default:
      return String(t('limits.features.dailyPlanGeneration'));
  }
}
