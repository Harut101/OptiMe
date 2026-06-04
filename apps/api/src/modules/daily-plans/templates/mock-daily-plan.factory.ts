import { DailyReadinessLevel } from '@prisma/client';

import { DailyPlanJson } from '../daily-plan-json.schema';

export interface MockDailyPlanInput {
  planLocalDate: string;
  planTimezone: string;
  firstName?: string | null;
  isMinor: boolean;
}

export function createMockDailyPlan(input: MockDailyPlanInput): DailyPlanJson {
  const greetingName = input.firstName ? `${input.firstName}, ` : '';
  const generatedAt = new Date().toISOString();

  return {
    schemaVersion: 'sprint-2.v1',
    generatedAt,
    mockVersion: 2,
    safety: {
      safeMode: input.isMinor,
      adjustedForSafety: input.isMinor,
      reasons: input.isMinor ? ['Safe mode is active for balanced, age-appropriate guidance.'] : []
    },
    summary: {
      title: 'Steady plan for today',
      message: `${greetingName}today's plan supports steady energy, balanced meals, and manageable movement.`,
      readiness: DailyReadinessLevel.MAINTAIN
    },
    nutrition: {
      calorieGuidance: {
        label: input.isMinor ? 'Balanced meals' : 'Steady energy target',
        notes: input.isMinor
          ? 'Today focuses on balanced meals, hydration, rest, and healthy movement.'
          : 'A balanced target for steady energy today.'
      },
      macroGuidance: {
        protein: input.isMinor ? 'Include a protein food at meals' : 'Protein with each meal',
        carbs: 'Choose steady-energy carbs around activity',
        fat: 'Include satisfying fats in moderate portions',
        notes: 'Use this as practical direction, not a strict rule.'
      },
      meals: [
        {
          name: 'Breakfast',
          purpose: 'Start with something familiar, balanced, and easy to repeat.',
          foods: [
            {
              name: 'Greek yogurt or a preferred protein option',
              portion: '1 bowl',
              notes: 'Add fruit or oats if that feels good today.'
            }
          ]
        },
        {
          name: 'Lunch',
          purpose: 'Midday energy',
          foods: [
            {
              name: 'Protein, grains, and vegetables',
              portion: '1 balanced plate',
              notes: 'Choose foods that match your preferences and allergies.'
            }
          ]
        }
      ],
      hydration: {
        guidance: 'Sip regularly across the day, especially around training.',
        notes: 'Hydration supports energy and recovery.'
      }
    },
    training: {
      recommendation: 'Keep training controlled and sustainable today.',
      intensity: 'MODERATE',
      notes: 'Adjust effort down if energy, sleep, or recovery feels off.'
    },
    recovery: {
      recommendation: 'Support recovery with regular meals, hydration, and a calm evening routine.',
      sleepTip: 'Give yourself a realistic wind-down window tonight.',
      mobilityTip: 'Add gentle mobility if it feels good.'
    },
    reminders: ['Hydrate regularly', 'Eat after training', 'Keep your evening routine calm'],
    debug: {
      provider: 'mock',
      generatedBy: 'MockAiProviderService'
    }
  };
}
