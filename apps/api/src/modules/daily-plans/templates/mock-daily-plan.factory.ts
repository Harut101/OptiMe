import { DailyReadinessLevel, PlanQualityMode } from '@prisma/client';
import type { NutritionTarget, SupportedLocale } from '@optime/shared-types';

import { DailyPlanJson } from '../daily-plan-json.schema';
import { buildDailyPlanContextNotes } from '../daily-plan-context-notes';
import { getSafeFallbackCopy } from '../daily-plan-copy';
import type { GenerateDailyPlanExerciseSelection } from '../../ai/ai-provider.interface';
import type { HealthPlanningContext } from '../../health/health-planning.types';
import { getMockDailyPlanCopy, type MockDailyPlanCopy } from './mock-daily-plan-copy';

export interface MockDailyPlanInput {
  planLocalDate: string;
  planTimezone: string;
  locale?: SupportedLocale;
  firstName?: string | null;
  isMinor: boolean;
  planQualityMode?: PlanQualityMode;
  trainingEnabled?: boolean;
  exerciseSelection?: GenerateDailyPlanExerciseSelection;
  nutritionTarget?: NutritionTarget;
  healthPlanningContext?: HealthPlanningContext;
}

export function createMockDailyPlan(input: MockDailyPlanInput): DailyPlanJson {
  const locale = input.locale ?? 'en-US';
  const copy = getMockDailyPlanCopy(locale);
  const trainingOffCopy = getSafeFallbackCopy(locale);
  const greetingName = input.firstName ? `${input.firstName}, ` : '';
  const generatedAt = new Date().toISOString();
  const planQualityMode = input.planQualityMode ?? PlanQualityMode.BASIC;
  const summaryByMode = copy.summaries[planQualityMode];
  const primaryMeals = createPrimaryMeals(copy);
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
    contentLocale: locale,
    safety: {
      safeMode: input.isMinor,
      adjustedForSafety: input.isMinor,
      reasons: input.isMinor ? [copy.safeModeReason] : []
    },
    summary: {
      title: summaryByMode.title,
      message: `${greetingName}${summaryByMode.message}`,
      readiness: DailyReadinessLevel.MAINTAIN
    },
    nutrition: {
      calorieGuidance: {
        label: input.nutritionTarget && input.nutritionTarget.safety.status !== 'NEEDS_MORE_INFO'
          ? copy.calorieTarget(input.nutritionTarget.calories.targetKcal)
          : input.isMinor ? copy.balancedMeals : copy.steadyEnergyTarget,
        notes: input.isMinor
          ? copy.balancedNutritionNotes
          : locale === 'en-US'
            ? input.nutritionTarget?.calories.adjustmentReason ?? copy.steadyEnergyTarget
            : copy.steadyEnergyTarget
      },
      macroGuidance: {
        protein: input.nutritionTarget && input.nutritionTarget.safety.status !== 'NEEDS_MORE_INFO'
          ? `${input.nutritionTarget.macros.proteinGrams}g`
          : copy.proteinWithEachMeal,
        carbs: input.nutritionTarget && input.nutritionTarget.safety.status !== 'NEEDS_MORE_INFO'
          ? `${input.nutritionTarget.macros.carbsGrams}g`
          : copy.steadyCarbs,
        fat: input.nutritionTarget && input.nutritionTarget.safety.status !== 'NEEDS_MORE_INFO'
          ? `${input.nutritionTarget.macros.fatGrams}g`
          : copy.satisfyingFats,
        notes: copy.practicalDirection
      },
      meals: primaryMeals,
      menuOptions: createMenuOptions(planQualityMode, primaryMeals, copy),
      hydration: {
        guidance: copy.hydrationGuidance,
        notes: copy.hydrationNotes
      }
    },
    training: {
      recommendation: trainingEnabled
        ? getTrainingRecommendation(summaryByMode.trainingRecommendation, input.healthPlanningContext, copy)
        : trainingOffCopy.trainingOffRecommendation,
      intensity: trainingEnabled ? 'MODERATE' : 'REST',
      notes: trainingEnabled
        ? (locale === 'en-US'
            ? input.healthPlanningContext?.trainingLoadContext.userFacingHint
            : undefined) ??
          copy.trainingNotes
        : trainingOffCopy.trainingOffNotes,
      exercises: !trainingEnabled
        ? []
        : input.exerciseSelection
          ? createLibraryExercises(input.exerciseSelection, copy)
          : createExercises(planQualityMode, copy)
    },
    ...(contextNotes ? { contextNotes } : {}),
    recovery: getRecoveryGuidance(input.healthPlanningContext, copy),
    reminders: copy.reminders,
    debug: {
      provider: 'mock',
      generatedBy: 'MockAiProviderService',
      planQualityMode
    }
  };
}

function getTrainingRecommendation(
  baseRecommendation: string,
  healthPlanningContext: HealthPlanningContext | undefined,
  copy: MockDailyPlanCopy
) {
  const trainingLoad = healthPlanningContext?.trainingLoadContext;
  if (
    trainingLoad?.hasTrainingLoadContext &&
    trainingLoad.readinessHint !== 'NORMAL' &&
    trainingLoad.userFacingHint
  ) {
    return `${baseRecommendation} ${copy.controlledSession}`;
  }

  return baseRecommendation;
}

function getRecoveryGuidance(
  healthPlanningContext: HealthPlanningContext | undefined,
  copy: MockDailyPlanCopy
): DailyPlanJson['recovery'] {
  const wearableContext = healthPlanningContext?.wearableContext;
  if (wearableContext?.hasRecentData) {
    if (
      Boolean(healthPlanningContext?.signals.lowSleep) ||
      (wearableContext.recoveryScore ?? 100) < 40 ||
      (wearableContext.strainScore ?? 0) >= 15
    ) {
      return { recommendation: copy.recoveryRecommendation, sleepTip: copy.sleepTip, mobilityTip: copy.mobilityTip };
    }

    return { recommendation: copy.recoveryRecommendation, sleepTip: copy.sleepTip, mobilityTip: copy.mobilityTip };
  }

  if (wearableContext?.isStale) {
    return { recommendation: copy.recoveryRecommendation, sleepTip: copy.sleepTip, mobilityTip: copy.mobilityTip };
  }

  return { recommendation: copy.recoveryRecommendation, sleepTip: copy.sleepTip, mobilityTip: copy.mobilityTip };
}

function createLibraryExercises(
  selection: GenerateDailyPlanExerciseSelection,
  copy: MockDailyPlanCopy
): NonNullable<DailyPlanJson['training']['exercises']> {
  return selection.candidates.slice(0, selection.requestedExerciseCount).map((candidate) => {
    const sets = selection.volumePlan.suggestedSetsPerExercise || 2;
    const rest = selection.volumePlan.suggestedRestSeconds || 60;
    const common = {
      exerciseId: candidate.exerciseId,
      slug: candidate.slug,
      name: candidate.name,
      targetMuscles: candidate.targetMuscles,
      equipment: candidate.equipment,
      intensityCue: copy.exercise.intensityCue,
      safetyNotes: candidate.safetyNotes.join(' ').slice(0, 220),
      notes: copy.exercise.plannedSession(selection.workoutDurationMinutes)
    };
    if (candidate.category === 'STRENGTH') return { ...common, sets: String(Math.max(1, Math.min(5, sets))), reps: '8-10', rest: copy.exercise.seconds(rest) };
    if (candidate.category === 'CARDIO') return { ...common, duration: copy.exercise.minutes(Math.max(5, Math.min(15, Math.floor(selection.workoutDurationMinutes / 3)))) };
    return { ...common, duration: copy.exercise.minutes(5) };
  });
}

function createExercises(
  planQualityMode: PlanQualityMode,
  copy: MockDailyPlanCopy
): NonNullable<DailyPlanJson['training']['exercises']> {
  const exercise = copy.exercise;
  const basics = [
    {
      name: exercise.easyWalk.name,
      targetMuscles: exercise.easyWalk.muscles,
      equipment: exercise.easyWalk.equipment,
      duration: exercise.easyWalk.duration,
      intensityCue: exercise.easyWalk.cue,
      safetyNotes: exercise.easyWalk.safety
    },
    {
      name: exercise.squat.name,
      targetMuscles: exercise.squat.muscles,
      equipment: exercise.squat.equipment,
      sets: '2',
      reps: '8-10',
      rest: exercise.squat.rest,
      intensityCue: exercise.squat.cue,
      safetyNotes: exercise.squat.safety
    }
  ];

  if (planQualityMode === PlanQualityMode.BASIC) {
    return basics.slice(0, 2);
  }

  const personalized = [
    ...basics,
    {
      name: exercise.inclinePushUp.name,
      targetMuscles: exercise.inclinePushUp.muscles,
      equipment: exercise.inclinePushUp.equipment,
      sets: '2-3',
      reps: '6-10',
      rest: exercise.inclinePushUp.rest,
      intensityCue: exercise.inclinePushUp.cue,
      safetyNotes: exercise.inclinePushUp.safety
    },
    {
      name: exercise.deadBug.name,
      targetMuscles: exercise.deadBug.muscles,
      equipment: exercise.deadBug.equipment,
      sets: '2',
      reps: '6-8 per side',
      rest: exercise.deadBug.rest,
      intensityCue: exercise.deadBug.cue,
      safetyNotes: exercise.deadBug.safety
    }
  ];

  if (planQualityMode === PlanQualityMode.PERSONALIZED) {
    return personalized;
  }

  return [
    ...personalized,
    {
      name: exercise.gluteBridge.name,
      targetMuscles: exercise.gluteBridge.muscles,
      equipment: exercise.gluteBridge.equipment,
      sets: '2-3',
      reps: '8-12',
      rest: exercise.gluteBridge.rest,
      intensityCue: exercise.gluteBridge.cue,
      safetyNotes: exercise.gluteBridge.safety
    }
  ];
}

function createPrimaryMeals(copy: MockDailyPlanCopy): DailyPlanJson['nutrition']['meals'] {
  return [
    {
      name: copy.breakfast.name,
      purpose: copy.breakfast.purpose,
      foods: [
        {
          name: copy.breakfast.food,
          portion: '1 bowl',
          notes: copy.breakfast.notes
        }
      ]
    },
    {
      name: copy.lunch.name,
      purpose: copy.lunch.purpose,
      foods: [
        {
          name: copy.lunch.food,
          portion: '1 balanced plate',
          notes: copy.lunch.notes
        }
      ]
    }
  ];
}

function createMenuOptions(
  planQualityMode: PlanQualityMode,
  primaryMeals: DailyPlanJson['nutrition']['meals'],
  copy: MockDailyPlanCopy
): NonNullable<DailyPlanJson['nutrition']['menuOptions']> {
  const balancedOption = {
    label: copy.options.balanced.label,
    focus: copy.options.balanced.focus,
    meals: primaryMeals
  };

  if (planQualityMode === PlanQualityMode.BASIC) {
    return [balancedOption];
  }

  const quickOption = {
    label: copy.options.quick.label,
    focus: copy.options.quick.focus,
    meals: [
      {
        name: copy.options.quick.breakfast,
        purpose: copy.options.quick.focus,
        foods: [
          {
            name: copy.options.quick.breakfastFood,
            portion: '1 serving',
            notes: copy.breakfast.notes
          }
        ]
      },
      {
        name: copy.options.quick.lunch,
        purpose: copy.options.quick.focus,
        foods: [
          {
            name: copy.options.quick.lunchFood,
            portion: '1 bowl',
            notes: copy.lunch.notes
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
      label: copy.options.workout.label,
      focus: copy.options.workout.focus,
      meals: primaryMeals
    },
    {
      label: copy.options.recovery.label,
      focus: copy.options.recovery.focus,
      meals: [
        {
          name: copy.options.recovery.breakfast,
          purpose: copy.options.recovery.focus,
          foods: [
            {
              name: copy.options.recovery.breakfastFood,
              portion: '1 bowl',
              notes: copy.options.recovery.focus
            }
          ]
        },
        {
          name: copy.options.recovery.lunch,
          purpose: copy.options.recovery.focus,
          foods: [
            {
              name: copy.options.recovery.lunchFood,
              portion: '1 bowl',
              notes: copy.lunch.notes
            }
          ]
        }
      ]
    },
    quickOption
  ];
}
