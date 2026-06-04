import { DailyReadinessLevel } from '@prisma/client';

import { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';

export interface SafeFallbackPlanInput {
  planLocalDate: string;
  planTimezone: string;
  reasons?: string[];
}

export function createSafeFallbackPlan(input: SafeFallbackPlanInput): DailyPlanJson {
  return {
    schemaVersion: 'sprint-2.v1',
    generatedAt: new Date().toISOString(),
    mockVersion: 2,
    safety: {
      safeMode: true,
      adjustedForSafety: true,
      reasons: input.reasons ?? []
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
