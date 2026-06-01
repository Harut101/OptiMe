import { DailyReadinessLevel, PlanStatus } from '@prisma/client';

export interface MockDailyPlanInput {
  planLocalDate: string;
  planTimezone: string;
  firstName?: string | null;
  isMinor: boolean;
}

export function createMockDailyPlan(input: MockDailyPlanInput) {
  const greetingName = input.firstName ? `${input.firstName}, ` : '';
  const generatedAt = new Date().toISOString();

  return {
    status: PlanStatus.READY,
    readinessLevel: DailyReadinessLevel.MAINTAIN,
    planLocalDate: input.planLocalDate,
    planTimezone: input.planTimezone,
    generatedAt,
    mockVersion: generatedAt,
    plan: {
      summary: `${greetingName}today's plan supports steady energy, balanced meals, and manageable movement.`,
      calorieGuidance: {
        targetCalories: input.isMinor ? null : 2100,
        reason: input.isMinor
          ? 'Today focuses on balanced meals, hydration, rest, and healthy movement.'
          : 'A balanced target for steady energy today.'
      },
      macroGuidance: {
        proteinGrams: input.isMinor ? null : 130,
        carbsGrams: input.isMinor ? null : 220,
        fatsGrams: input.isMinor ? null : 65
      },
      meals: [
        {
          mealName: 'Breakfast',
          timing: 'Morning',
          foods: [
            {
              name: 'Greek yogurt or a preferred protein option',
              portion: '1 bowl',
              notes: 'Add fruit or oats if that feels good today.'
            }
          ],
          approxCalories: input.isMinor ? null : 400,
          notes: 'Start with something familiar, balanced, and easy to repeat.'
        },
        {
          mealName: 'Lunch',
          timing: 'Midday',
          foods: [
            {
              name: 'Protein, grains, and vegetables',
              portion: '1 balanced plate',
              notes: 'Choose foods that match your preferences and allergies.'
            }
          ],
          approxCalories: input.isMinor ? null : 650,
          notes: 'Aim for steady energy rather than restriction.'
        }
      ],
      hydration: {
        targetLiters: 2.3,
        timingNotes: 'Sip regularly across the day, especially around training.'
      },
      trainingRecommendation: {
        mode: DailyReadinessLevel.MAINTAIN,
        summary: 'Keep training controlled and sustainable today.',
        intensity: 'MODERATE',
        durationMinutes: 45
      },
      recoveryRecommendation: {
        summary: 'Support recovery with regular meals, hydration, and a calm evening routine.',
        actions: ['Hydrate regularly', 'Eat after training', 'Keep your evening routine calm']
      },
      coachExplanation: 'Consistency matters more than extremes. A steady day is useful progress.',
      warnings: []
    }
  };
}

export function createSafeFallbackPlan(planLocalDate: string, planTimezone: string) {
  return {
    status: PlanStatus.FALLBACK,
    readinessLevel: DailyReadinessLevel.MAINTAIN,
    planLocalDate,
    planTimezone,
    plan: {
      summary: 'Here is a simple, supportive plan for today.',
      calorieGuidance: {
        targetCalories: null,
        reason: 'A personalized estimate is not available yet.'
      },
      macroGuidance: {
        proteinGrams: null,
        carbsGrams: null,
        fatsGrams: null
      },
      meals: [
        {
          mealName: 'Balanced meal',
          timing: 'Flexible',
          foods: [
            {
              name: 'Protein source',
              portion: '1 serving',
              notes: 'Choose an option that fits your preferences.'
            },
            {
              name: 'Fruit or vegetables',
              portion: '1-2 servings',
              notes: 'Keep it simple and familiar.'
            }
          ],
          approxCalories: null,
          notes: 'Aim for steady, practical choices.'
        }
      ],
      hydration: {
        targetLiters: 2,
        timingNotes: 'Drink regularly across the day.'
      },
      trainingRecommendation: {
        mode: DailyReadinessLevel.MAINTAIN,
        summary: 'Choose light to moderate movement that feels manageable.',
        intensity: 'LOW',
        durationMinutes: 20
      },
      recoveryRecommendation: {
        summary: 'Focus on consistency, hydration, and rest.',
        actions: ['Eat regular meals', 'Stay hydrated', 'Give yourself enough recovery time']
      },
      coachExplanation: 'A steady day still counts as progress.',
      warnings: ['This is a fallback template, not a fully personalized plan.']
    }
  };
}
