import { DailyReadinessLevel, PlanQualityMode } from '@prisma/client';
import type { NutritionTarget } from '@optime/shared-types';

import { DailyPlanJson } from '../daily-plan-json.schema';
import { buildDailyPlanContextNotes } from '../daily-plan-context-notes';
import type { GenerateDailyPlanExerciseSelection } from '../../ai/ai-provider.interface';
import type { HealthPlanningContext } from '../../health/health-planning.types';

export interface MockDailyPlanInput {
  planLocalDate: string;
  planTimezone: string;
  firstName?: string | null;
  isMinor: boolean;
  planQualityMode?: PlanQualityMode;
  trainingEnabled?: boolean;
  exerciseSelection?: GenerateDailyPlanExerciseSelection;
  nutritionTarget?: NutritionTarget;
  healthPlanningContext?: HealthPlanningContext;
}

export function createMockDailyPlan(input: MockDailyPlanInput): DailyPlanJson {
  const greetingName = input.firstName ? `${input.firstName}, ` : '';
  const generatedAt = new Date().toISOString();
  const planQualityMode = input.planQualityMode ?? PlanQualityMode.BASIC;
  const summaryByMode = getSummaryByMode(planQualityMode);
  const primaryMeals = createPrimaryMeals();
  const trainingEnabled = input.trainingEnabled ?? true;
  const contextNotes = buildDailyPlanContextNotes({
    healthPlanningContext: input.healthPlanningContext,
    trainingEnabled,
    isTrainingDay: trainingEnabled
  });

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
        label: input.nutritionTarget && input.nutritionTarget.safety.status !== 'NEEDS_MORE_INFO'
          ? `${input.nutritionTarget.calories.targetKcal} kcal target`
          : input.isMinor ? 'Balanced meals' : 'Steady energy target',
        notes: input.isMinor
          ? 'Today focuses on balanced meals, hydration, rest, and healthy movement.'
          : input.nutritionTarget?.calories.adjustmentReason ?? 'A balanced target for steady energy today.'
      },
      macroGuidance: {
        protein: input.nutritionTarget && input.nutritionTarget.safety.status !== 'NEEDS_MORE_INFO'
          ? `${input.nutritionTarget.macros.proteinGrams}g`
          : input.isMinor ? 'Include a protein food at meals' : 'Protein with each meal',
        carbs: input.nutritionTarget && input.nutritionTarget.safety.status !== 'NEEDS_MORE_INFO'
          ? `${input.nutritionTarget.macros.carbsGrams}g`
          : 'Choose steady-energy carbs around activity',
        fat: input.nutritionTarget && input.nutritionTarget.safety.status !== 'NEEDS_MORE_INFO'
          ? `${input.nutritionTarget.macros.fatGrams}g`
          : 'Include satisfying fats in moderate portions',
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
      recommendation: trainingEnabled
        ? getTrainingRecommendation(summaryByMode.trainingRecommendation, input.healthPlanningContext)
        : 'Training is off for this plan.',
      intensity: trainingEnabled ? 'MODERATE' : 'REST',
      notes: trainingEnabled
        ? input.healthPlanningContext?.trainingLoadContext.userFacingHint ??
          'Adjust effort down if energy, sleep, or recovery feels off.'
        : 'OptiMe will focus on nutrition today. You can enable training whenever it fits your goals.',
      exercises: !trainingEnabled
        ? []
        : input.exerciseSelection
          ? createLibraryExercises(input.exerciseSelection)
          : createExercises(planQualityMode)
    },
    ...(contextNotes ? { contextNotes } : {}),
    recovery: getRecoveryGuidance(input.healthPlanningContext),
    reminders: ['Hydrate regularly', 'Eat after training', 'Keep your evening routine calm'],
    debug: {
      provider: 'mock',
      generatedBy: 'MockAiProviderService',
      planQualityMode
    }
  };
}

function getTrainingRecommendation(
  baseRecommendation: string,
  healthPlanningContext?: HealthPlanningContext
) {
  const trainingLoad = healthPlanningContext?.trainingLoadContext;
  if (
    trainingLoad?.hasTrainingLoadContext &&
    trainingLoad.readinessHint !== 'NORMAL' &&
    trainingLoad.userFacingHint
  ) {
    return `${baseRecommendation} Keep the session controlled today.`;
  }

  return baseRecommendation;
}

function getRecoveryGuidance(
  healthPlanningContext?: HealthPlanningContext
): DailyPlanJson['recovery'] {
  const wearableContext = healthPlanningContext?.wearableContext;
  if (wearableContext?.hasRecentData) {
    if (
      Boolean(healthPlanningContext?.signals.lowSleep) ||
      (wearableContext.recoveryScore ?? 100) < 40 ||
      (wearableContext.strainScore ?? 0) >= 15
    ) {
      return {
        recommendation:
          'Recent wearable signals suggest keeping recovery simple and intensity conservative today.',
        sleepTip: 'Aim for a calm wind-down and enough time in bed tonight.',
        mobilityTip: 'Choose gentle mobility or an easy walk if it feels comfortable.'
      };
    }

    return {
      recommendation:
        'Recent wearable signals are available, so today can stay steady while still respecting how you feel.',
      sleepTip: 'Keep your evening routine predictable.',
      mobilityTip: 'Add gentle mobility if it feels good.'
    };
  }

  if (wearableContext?.isStale) {
    return {
      recommendation:
        'Wearable data is not recent, so recovery guidance uses your saved profile and schedule today.',
      sleepTip: 'Give yourself a realistic wind-down window tonight.',
      mobilityTip: 'Add gentle mobility if it feels good.'
    };
  }

  return {
    recommendation: 'Support recovery with regular meals, hydration, and a calm evening routine.',
    sleepTip: 'Give yourself a realistic wind-down window tonight.',
    mobilityTip: 'Add gentle mobility if it feels good.'
  };
}

function createLibraryExercises(selection: GenerateDailyPlanExerciseSelection): NonNullable<DailyPlanJson['training']['exercises']> {
  return selection.candidates.slice(0, selection.requestedExerciseCount).map((candidate) => {
    const common = {
      exerciseId: candidate.exerciseId,
      slug: candidate.slug,
      name: candidate.name,
      targetMuscles: candidate.targetMuscles,
      equipment: candidate.equipment,
      intensityCue: 'Keep the movement controlled and leave comfortable effort in reserve.',
      safetyNotes: candidate.safetyNotes.join(' ').slice(0, 220),
      notes: 'Use a comfortable range and adjust down when needed.'
    };
    if (candidate.category === 'STRENGTH') return { ...common, sets: '2', reps: '8-10', rest: '60 seconds' };
    if (candidate.category === 'CARDIO') return { ...common, duration: '10 minutes' };
    return { ...common, duration: '5 minutes' };
  });
}

function createExercises(
  planQualityMode: PlanQualityMode
): NonNullable<DailyPlanJson['training']['exercises']> {
  const basics = [
    {
      name: 'Easy walk',
      targetMuscles: ['full body'],
      equipment: ['bodyweight'],
      duration: '10-20 minutes',
      intensityCue: 'Keep the pace comfortable.',
      safetyNotes: 'Stop or reduce effort if anything feels uncomfortable.'
    },
    {
      name: 'Bodyweight squat',
      targetMuscles: ['legs', 'glutes'],
      equipment: ['bodyweight'],
      sets: '2',
      reps: '8-10',
      rest: '60-90 seconds',
      intensityCue: 'Move with control and leave effort in reserve.',
      safetyNotes: 'Use a pain-free range of motion.'
    }
  ];

  if (planQualityMode === PlanQualityMode.BASIC) {
    return basics.slice(0, 2);
  }

  const personalized = [
    ...basics,
    {
      name: 'Incline push-up',
      targetMuscles: ['chest', 'shoulders', 'arms'],
      equipment: ['bench or sturdy surface'],
      sets: '2-3',
      reps: '6-10',
      rest: '60-90 seconds',
      intensityCue: 'Choose an incline that feels smooth and controlled.',
      safetyNotes: 'Skip this if wrists or shoulders feel irritated.'
    },
    {
      name: 'Dead bug',
      targetMuscles: ['core'],
      equipment: ['bodyweight'],
      sets: '2',
      reps: '6-8 per side',
      rest: '45-60 seconds',
      intensityCue: 'Move slowly and breathe steadily.',
      safetyNotes: 'Keep the movement gentle and controlled.'
    }
  ];

  if (planQualityMode === PlanQualityMode.PERSONALIZED) {
    return personalized;
  }

  return [
    ...personalized,
    {
      name: 'Glute bridge',
      targetMuscles: ['glutes', 'hamstrings'],
      equipment: ['bodyweight'],
      sets: '2-3',
      reps: '8-12',
      rest: '60 seconds',
      intensityCue: 'Use a steady pace and stop well before strain.',
      safetyNotes: 'Keep it comfortable for hips and lower back.'
    }
  ];
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
