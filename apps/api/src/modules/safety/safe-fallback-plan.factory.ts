import { DailyReadinessLevel } from '@prisma/client';
import type { SupportedLocale } from '@optime/shared-types';

import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import { getSafeFallbackCopy } from '../daily-plans/daily-plan-copy';
import { SUPPORTIVE_SAFETY_MESSAGES } from './safety-rules';

export interface SafeFallbackPlanInput {
  planLocalDate: string;
  planTimezone: string;
  locale?: SupportedLocale;
  reasons?: string[];
}

export function createSafeFallbackPlan(input: SafeFallbackPlanInput): DailyPlanJson {
  const reasons = input.reasons ?? [];
  const locale = input.locale ?? 'en-US';
  const copy = getSafeFallbackCopy(locale);

  return {
    schemaVersion: 'sprint-2.v1',
    generatedAt: new Date().toISOString(),
    mockVersion: 2,
    contentLocale: locale,
    safety: {
      safeMode: true,
      adjustedForSafety: true,
      reasons,
      userSafeMessage: getUserSafeFallbackMessage(reasons, locale)
    },
    summary: {
      title: copy.summaryTitle,
      message: copy.summaryMessage,
      readiness: DailyReadinessLevel.MAINTAIN
    },
    nutrition: {
      calorieGuidance: {
        label: copy.calorieLabel,
        notes: copy.calorieNotes
      },
      macroGuidance: {
        protein: copy.protein,
        carbs: copy.carbs,
        fat: copy.fat,
        notes: copy.macroNotes
      },
      meals: [
        {
          name: copy.mealName,
          purpose: copy.mealPurpose,
          foods: [
            {
              name: copy.proteinFood,
              portion: '1 serving',
              notes: copy.proteinNotes
            },
            {
              name: copy.produceFood,
              portion: '1-2 servings',
              notes: copy.simpleNotes
            }
          ]
        }
      ],
      hydration: {
        guidance: copy.hydrationGuidance,
        notes: copy.hydrationNotes
      }
    },
    training: {
      recommendation: copy.trainingRecommendation,
      intensity: 'LIGHT',
      notes: copy.trainingNotes
    },
    recovery: {
      recommendation: copy.recoveryRecommendation,
      sleepTip: copy.sleepTip,
      mobilityTip: copy.mobilityTip
    },
    reminders: copy.reminders,
    debug: {
      provider: 'fallback',
      generatedBy: 'SafeFallbackPlanFactory',
      fallbackReason: input.reasons?.join(' | ')
    }
  };
}

export function getUserSafeFallbackMessage(reasons: string[], locale: SupportedLocale = 'en-US') {
  const reasonText = reasons.join(' | ').toLowerCase();

  if (locale !== 'en-US') {
    const isFoodConflict =
      reasonText.includes('allerg') ||
      reasonText.includes('excluded food') ||
      reasonText.includes('conflicts with your allergies') ||
      reasonText.includes(SUPPORTIVE_SAFETY_MESSAGES.planFoodConflict.toLowerCase());
    const isTrainingConcern =
      reasonText.includes('pain') ||
      reasonText.includes('dizz') ||
      reasonText.includes('illness') ||
      reasonText.includes('exhaust') ||
      reasonText.includes('injur');

    if (locale === 'ru-RU') {
      if (isFoodConflict) return 'Мы выбрали более безопасный вариант с учётом аллергий и исключённых продуктов.';
      if (isTrainingConcern) return 'Сегодня мы снизили нагрузку, чтобы движение оставалось щадящим и поддерживало восстановление.';
      return 'Сегодня мы выбрали более безопасный и спокойный план.';
    }

    if (locale === 'fr-FR') {
      if (isFoodConflict) return 'Nous avons choisi une option plus prudente en tenant compte de vos allergies et exclusions.';
      if (isTrainingConcern) return "Nous avons reduit l'intensite afin de garder un mouvement prudent et favorable a la recuperation.";
      return 'Nous avons choisi un plan plus prudent et plus regulier aujourd’hui.';
    }

    if (isFoodConflict) return '我们已采用更安全的方案，并考虑您的过敏和排除食物。';
    if (isTrainingConcern) return '今天我们降低了训练强度，让活动更保守并有利于恢复。';
    return '今天我们采用了更安全、更稳健的计划。';
  }

  if (
    reasonText.includes('under 18') ||
    reasonText.includes('minor') ||
    reasonText.includes('safe mode')
  ) {
    return 'We adjusted today toward balanced meals, hydration, recovery, and healthy movement.';
  }

  if (
    reasonText.includes('weight loss') ||
    reasonText.includes('weight-loss') ||
    reasonText.includes('steadier goal') ||
    reasonText.includes('aggressive')
  ) {
    return 'We adjusted today toward a steadier plan that supports energy, training, and recovery.';
  }

  if (
    reasonText.includes('pregnancy') ||
    reasonText.includes('postpartum') ||
    reasonText.includes('breastfeeding') ||
    reasonText.includes('nursing')
  ) {
    return 'We adjusted today toward gentle, balanced guidance because your health context calls for extra care.';
  }

  if (
    reasonText.includes('allerg') ||
    reasonText.includes('excluded food') ||
    reasonText.includes('conflicts with your allergies') ||
    reasonText.includes(SUPPORTIVE_SAFETY_MESSAGES.planFoodConflict.toLowerCase())
  ) {
    return 'We switched to a safer plan because the generated plan may have conflicted with your allergies or excluded foods.';
  }

  if (
    reasonText.includes('pain') ||
    reasonText.includes('dizz') ||
    reasonText.includes('illness') ||
    reasonText.includes('exhaust') ||
    reasonText.includes('injur')
  ) {
    return 'We reduced training intensity today so movement stays conservative and recovery-friendly.';
  }

  if (reasonText.includes('safety_agent')) {
    return 'We used a safer fallback because the generated plan needed a more conservative safety review.';
  }

  if (
    reasonText.includes('safely validated') ||
    reasonText.includes('schema_validation') ||
    reasonText.includes('json_parse') ||
    reasonText.includes('missing_output') ||
    reasonText.includes('openai_')
  ) {
    return 'We used a reliable safe plan today because the generated plan could not be fully verified.';
  }

  return 'We adjusted today toward a safer, steadier plan.';
}
