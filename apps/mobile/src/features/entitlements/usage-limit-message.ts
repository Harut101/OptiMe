import type { TFunction } from 'i18next';

import { ApiError } from '@/api/client';
import { formatDate, formatTime } from '@/i18n/formatters';
import { getSubscriptionPlanLabel } from '@/i18n/enum-labels';
import type {
  AiCapacityLimitReachedError,
  UsageLimitExceededError
} from '@/types/api';

type LimitError =
  | UsageLimitExceededError
  | AiCapacityLimitReachedError;

export function getUsageLimitError(error: unknown) {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== 'object') {
    return null;
  }

  const body = error.body as Partial<LimitError>;
  return body.code === 'USAGE_LIMIT_REACHED' ||
    body.code === 'AI_CAPACITY_LIMIT_REACHED'
    ? (body as LimitError)
    : null;
}

export function formatUsageLimitMessage(
  error: LimitError,
  t: TFunction,
  locale: string
) {
  if (error.code === 'AI_CAPACITY_LIMIT_REACHED') {
    const reset = error.resetAt
      ? t('limits.tryAfterDate', {
          date: formatDate(error.resetAt, locale)
        })
      : t('limits.tryAfterReset');

    return String(t('limits.capacityMessage', { reset }));
  }

  const reset = error.resetAt
    ? error.periodType === 'MONTHLY'
      ? t('limits.tryAfterDate', {
          date: formatDate(error.resetAt, locale)
        })
      : t('limits.tryAfter', {
          time: formatTime(error.resetAt, locale)
        })
    : t('limits.tryAfterReset');
  const messageKey =
    error.periodType === 'MONTHLY'
      ? 'limits.messageMonthly'
      : 'limits.messageDaily';

  return String(
    t(messageKey as never, {
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
    case 'AI_PLAN_CHECKPOINT_PROPOSAL':
      return String(t('limits.features.aiPlanCheckpointProposal'));
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
