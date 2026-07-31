import type { DailyPlanJson } from '../src/modules/daily-plans/daily-plan-json.schema';
import {
  evaluateBenchmarkPlanQuality,
  summarizePlanQuality
} from './ai-live-benchmark-quality';

describe('AI live benchmark quality', () => {
  it('scores a catalog-backed aligned food and training plan', () => {
    const quality = evaluateBenchmarkPlanQuality(createPlan(), {
      trainingExpected: true,
      preferredFoods: ['rice'],
      expectedMealCount: 1
    });

    expect(quality.food.score).toBe(100);
    expect(quality.training.score).toBe(100);
    expect(quality.overallScore).toBe(100);
  });

  it('exposes deterministic fallback and incomplete prescriptions', () => {
    const plan = createPlan();
    plan.nutrition.foodPlan!.source = 'DETERMINISTIC_FALLBACK';
    plan.training.exercises![0].rest = undefined;
    plan.debug!.exerciseSelection!.usedDeterministicFallback = true;

    const quality = evaluateBenchmarkPlanQuality(plan, {
      trainingExpected: true,
      preferredFoods: ['rice'],
      expectedMealCount: 1
    });

    expect(quality.food.usedDeterministicFallback).toBe(true);
    expect(quality.food.score).toBeLessThan(100);
    expect(quality.training.usedDeterministicFallback).toBe(true);
    expect(quality.training.prescriptionCoveragePercent).toBe(0);
    expect(quality.training.score).toBeLessThan(100);
  });

  it('summarizes applicable training plans separately from rest days', () => {
    const training = evaluateBenchmarkPlanQuality(createPlan(), {
      trainingExpected: true,
      preferredFoods: [],
      expectedMealCount: 1
    });
    const restPlan = createPlan();
    restPlan.training = {
      recommendation: 'Rest',
      intensity: 'REST',
      notes: 'Rest day',
      exercises: []
    };
    const rest = evaluateBenchmarkPlanQuality(restPlan, {
      trainingExpected: false,
      preferredFoods: [],
      expectedMealCount: 1
    });

    const summary = summarizePlanQuality([training, rest]);
    expect(summary.training.applicablePlanCount).toBe(1);
    expect(summary.training.averageScore).toBe(100);
  });
});

function createPlan(): DailyPlanJson {
  return {
    schemaVersion: 'sprint-2.v1',
    generatedAt: new Date().toISOString(),
    mockVersion: 0,
    safety: { safeMode: false, adjustedForSafety: false, reasons: [] },
    summary: { title: 'Today', message: 'Ready', readiness: 'MAINTAIN' },
    nutrition: {
      calorieGuidance: { label: 'Target', notes: 'Aligned' },
      macroGuidance: {
        protein: '30 g',
        carbs: '50 g',
        fat: '20 g',
        notes: 'Aligned'
      },
      meals: [],
      hydration: { guidance: 'Hydrate' },
      foodPlan: {
        source: 'NUTRITION_AGENT',
        localDate: '2026-07-31',
        locale: 'en-US',
        nutritionTargetSnapshot: {
          engineVersion: 1,
          localDate: '2026-07-31',
          dayType: 'TRAINING_DAY',
          appMode: 'NUTRITION_AND_TRAINING',
          primaryGoal: 'HEALTHY_EATING',
          targetKcal: 500,
          minKcal: 450,
          maxKcal: 550,
          maintenanceEstimateKcal: 2000,
          proteinGrams: 30,
          carbsGrams: 50,
          fatGrams: 20,
          safetyStatus: 'OK',
          safetyReasons: [],
          explanation: { titleCode: 'TODAY_TARGET', reasonCodes: [] }
        },
        totals: {
          caloriesKcal: 500,
          proteinGrams: 30,
          carbsGrams: 50,
          fatGrams: 20
        },
        validation: {
          status: 'VALID',
          reasons: [],
          tolerances: {
            caloriesPercent: 10,
            proteinGrams: 10,
            carbsGrams: 15,
            fatGrams: 8
          }
        },
        meals: [
          {
            id: 'meal-1',
            mealType: 'LUNCH',
            title: 'Rice bowl',
            shortDescription: 'Balanced lunch',
            prepTimeMinutes: 15,
            servingSummary: 'One bowl',
            caloriesKcal: 500,
            proteinGrams: 30,
            carbsGrams: 50,
            fatGrams: 20,
            ingredients: [
              {
                catalogFoodSlug: 'rice-cooked',
                name: 'Rice',
                quantity: 150,
                unit: 'g',
                isOptional: false,
                role: 'BASE',
                measurementState: 'COOKED',
                usage: 'Use as the base.',
                preparation: null,
                caloriesKcal: 500,
                proteinGrams: 30,
                carbsGrams: 50,
                fatGrams: 20
              }
            ],
            preparationSteps: ['Serve the cooked rice.'],
            substitutions: [],
            explanation: { reasonCodes: ['TARGET_ALIGNED'] }
          }
        ]
      }
    },
    training: {
      recommendation: 'Strength workout',
      intensity: 'MODERATE',
      notes: 'Controlled pace',
      exercises: [
        {
          exerciseId: 'exercise-1',
          slug: 'bodyweight-squat',
          name: 'Bodyweight squat',
          targetMuscles: ['QUADRICEPS'],
          equipment: ['BODYWEIGHT'],
          sets: '3',
          reps: '10',
          rest: '60 seconds',
          exerciseSnapshot: {
            resolvedLocale: 'en-US',
            category: 'STRENGTH',
            movementPattern: 'SQUAT',
            equipment: ['BODYWEIGHT'],
            targetMuscles: ['QUADRICEPS', 'GLUTES', 'HAMSTRINGS'],
            secondaryMuscles: [],
            instructions: ['Squat with control.'],
            coachingCues: ['Keep a steady pace.'],
            safetyNotes: ['Stop if pain increases.'],
            exerciseUpdatedAt: new Date().toISOString()
          }
        }
      ]
    },
    recovery: { recommendation: 'Recover' },
    reminders: [],
    debug: {
      provider: 'openai',
      generatedBy: 'OpenAiProviderService',
      generation: { isComplete: true, adjustedSections: [] },
      exerciseSelection: {
        candidateCount: 3,
        requestedExerciseCount: 1,
        fallbackMode: 'NONE',
        usedAiRetry: false,
        usedDeterministicFallback: false,
        resolvedLocale: 'en-US'
      }
    }
  };
}
