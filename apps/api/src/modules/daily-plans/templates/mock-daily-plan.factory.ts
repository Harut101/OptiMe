import { DailyReadinessLevel, PlanQualityMode } from '@prisma/client';

import { DailyPlanJson } from '../daily-plan-json.schema';

export interface MockDailyPlanInput {
  planLocalDate: string;
  planTimezone: string;
  firstName?: string | null;
  isMinor: boolean;
  planQualityMode?: PlanQualityMode;
}

export function createMockDailyPlan(input: MockDailyPlanInput): DailyPlanJson {
  const greetingName = input.firstName ? `${input.firstName}, ` : '';
  const generatedAt = new Date().toISOString();
  const planQualityMode = input.planQualityMode ?? PlanQualityMode.BASIC;
  const summaryByMode = getSummaryByMode(planQualityMode);
  const primaryMeals = createPrimaryMeals();

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
      title: summaryByMode.title,
      message: `${greetingName}${summaryByMode.message}`,
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
      meals: primaryMeals,
      menuOptions: createMenuOptions(planQualityMode, primaryMeals),
      hydration: {
        guidance: 'Sip regularly across the day, especially around training.',
        notes: 'Hydration supports energy and recovery.'
      }
    },
    training: {
      recommendation: summaryByMode.trainingRecommendation,
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
      generatedBy: 'MockAiProviderService',
      planQualityMode
    }
  };
}

function createPrimaryMeals(): DailyPlanJson['nutrition']['meals'] {
  return [
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
  ];
}

function createMenuOptions(
  planQualityMode: PlanQualityMode,
  primaryMeals: DailyPlanJson['nutrition']['meals']
): NonNullable<DailyPlanJson['nutrition']['menuOptions']> {
  const balancedOption = {
    label: 'Balanced standard day',
    focus: 'Steady energy with familiar, practical meals.',
    meals: primaryMeals
  };

  if (planQualityMode === PlanQualityMode.BASIC) {
    return [balancedOption];
  }

  const quickOption = {
    label: 'Quick simple prep',
    focus: 'Easy meals with minimal prep while keeping nutrition steady.',
    meals: [
      {
        name: 'Simple breakfast',
        purpose: 'Quick start',
        foods: [
          {
            name: 'Protein smoothie',
            portion: '1 serving',
            notes: 'Use ingredients that fit your allergies and preferences.'
          }
        ]
      },
      {
        name: 'Simple lunch',
        purpose: 'Low-friction midday meal',
        foods: [
          {
            name: 'Rice bowl with lean protein',
            portion: '1 bowl',
            notes: 'Add vegetables that fit your preferences.'
          }
        ]
      }
    ]
  };

  if (planQualityMode === PlanQualityMode.PERSONALIZED) {
    return [balancedOption, quickOption];
  }

  return [
    {
      label: 'Workout support',
      focus: 'Meals that support scheduled training and steady recovery.',
      meals: primaryMeals
    },
    {
      label: 'Recovery friendly',
      focus: 'Gentle, practical meals for an easier recovery-focused day.',
      meals: [
        {
          name: 'Recovery breakfast',
          purpose: 'Gentle morning fuel',
          foods: [
            {
              name: 'Oats with protein',
              portion: '1 bowl',
              notes: 'Keep preparation simple and comfortable.'
            }
          ]
        },
        {
          name: 'Recovery lunch',
          purpose: 'Balanced, easy digestion',
          foods: [
            {
              name: 'Warm grain bowl',
              portion: '1 bowl',
              notes: 'Choose vegetables and protein that fit your preferences.'
            }
          ]
        }
      ]
    },
    quickOption
  ];
}

function getSummaryByMode(planQualityMode: PlanQualityMode) {
  switch (planQualityMode) {
    case PlanQualityMode.ADAPTIVE:
      return {
        title: 'Adaptive plan for today',
        message:
          "today's plan uses your recent patterns to support steady energy, training, and recovery.",
        trainingRecommendation:
          'Use today as a tailored maintain day, adjusting effort to your recent feedback and schedule.'
      };
    case PlanQualityMode.PERSONALIZED:
      return {
        title: 'Personalized plan for today',
        message:
          "today's plan reflects your preferences, schedule, and goal with practical choices.",
        trainingRecommendation:
          'Train in line with your schedule and goal, keeping the session specific but sustainable.'
      };
    case PlanQualityMode.BASIC:
    default:
      return {
        title: 'Steady plan for today',
        message:
          "today's plan supports steady energy, balanced meals, and manageable movement.",
        trainingRecommendation: 'Keep training controlled and sustainable today.'
      };
  }
}
