import { DailyReadinessLevel } from '@prisma/client';

import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import { SUPPORTIVE_SAFETY_MESSAGES } from './safety-rules';

export interface SafeFallbackPlanInput {
  planLocalDate: string;
  planTimezone: string;
  reasons?: string[];
}

export function createSafeFallbackPlan(input: SafeFallbackPlanInput): DailyPlanJson {
  const reasons = input.reasons ?? [];

  return {
    schemaVersion: 'sprint-2.v1',
    generatedAt: new Date().toISOString(),
    mockVersion: 2,
    safety: {
      safeMode: true,
      adjustedForSafety: true,
      reasons,
      userSafeMessage: getUserSafeFallbackMessage(reasons)
    },
    summary: {
      title: 'Simple safe plan',
      message: 'Here is a simple, supportive plan for today.',
      readiness: DailyReadinessLevel.MAINTAIN
    },
    nutrition: {
      calorieGuidance: {
        label: 'Balanced guidance',
        notes: 'A balanced target for steady energy today.'
      },
      macroGuidance: {
        protein: 'Include a familiar protein option',
        carbs: 'Add steady-energy carbs if training or energy calls for it',
        fat: 'Include satisfying fats in moderate portions',
        notes: 'Keep this flexible and comfortable.'
      },
      meals: [
        {
          name: 'Balanced meal',
          purpose: 'Steady energy',
          foods: [
            {
              name: 'A familiar protein option',
              portion: '1 serving',
              notes: 'Choose something that fits your allergies and preferences.'
            },
            {
              name: 'Fruit or vegetables',
              portion: '1-2 servings',
              notes: 'Keep it simple and comfortable.'
            }
          ]
        }
      ],
      hydration: {
        guidance: 'Drink regularly across the day.',
        notes: 'Hydration supports energy and recovery.'
      }
    },
    training: {
      recommendation: 'Choose light to moderate movement that feels manageable.',
      intensity: 'LIGHT',
      notes: 'If you feel unwell, dizzy, exhausted, or in pain, prioritize rest.'
    },
    recovery: {
      recommendation: 'Focus on consistency, hydration, and rest.',
      sleepTip: 'Protect a calm evening routine if possible.',
      mobilityTip: 'Gentle mobility is enough today.'
    },
    reminders: ['Eat regular meals', 'Stay hydrated', 'Give yourself enough recovery time'],
    debug: {
      provider: 'fallback',
      generatedBy: 'SafeFallbackPlanFactory',
      fallbackReason: input.reasons?.join(' | ')
    }
  };
}

export function getUserSafeFallbackMessage(reasons: string[]) {
  const reasonText = reasons.join(' | ').toLowerCase();

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
