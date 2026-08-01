import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import { buildSafetyAgentSemanticPlan } from './safety-agent-review-context';

describe('buildSafetyAgentSemanticPlan', () => {
  it('keeps user-facing safety text and removes technical metadata', () => {
    const plan = createPlan();
    const context = buildSafetyAgentSemanticPlan(plan);
    const serialized = JSON.stringify(context);

    expect(serialized).toContain('Do not train through pain.');
    expect(serialized).toContain('Stop if dizziness appears.');
    expect(serialized).toContain('Use the oil only for cooking.');
    expect(serialized).not.toContain('OpenAiProviderService');
    expect(serialized).not.toContain('catalog-food-slug');
    expect(serialized).not.toContain('checkpointBaseline');
    expect(serialized).not.toContain('caloriesKcal');
  });
});

function createPlan(): DailyPlanJson {
  return {
    schemaVersion: 'sprint-2.v1',
    generatedAt: '2026-08-01T00:00:00.000Z',
    mockVersion: 0,
    safety: { safeMode: false, adjustedForSafety: false, reasons: [] },
    summary: { title: 'Daily plan', message: 'Stay consistent.', readiness: 'MAINTAIN' },
    nutrition: {
      calorieGuidance: { label: 'Balanced', notes: 'Eat regular meals.' },
      macroGuidance: { protein: '120 g', carbs: '200 g', fat: '60 g', notes: 'Balanced.' },
      meals: [],
      hydration: { guidance: 'Drink water.' },
      foodPlan: {
        source: 'NUTRITION_AGENT',
        localDate: '2026-08-01',
        locale: 'en-US',
        nutritionTargetSnapshot: {
          engineVersion: 1,
          localDate: '2026-08-01',
          dayType: 'TRAINING_DAY',
          appMode: 'NUTRITION_AND_TRAINING',
          primaryGoal: 'HEALTHY_EATING',
          targetKcal: 2_000,
          minKcal: 1_900,
          maxKcal: 2_100,
          maintenanceEstimateKcal: 2_000,
          proteinGrams: 120,
          carbsGrams: 200,
          fatGrams: 60,
          safetyStatus: 'OK',
          safetyReasons: [],
          explanation: { titleCode: 'TODAY_TARGET', reasonCodes: [] }
        },
        totals: { caloriesKcal: 100, proteinGrams: 10, carbsGrams: 10, fatGrams: 2 },
        validation: {
          status: 'VALID',
          reasons: [],
          tolerances: { caloriesPercent: 5, proteinGrams: 10, carbsGrams: 15, fatGrams: 10 }
        },
        meals: [{
          id: 'meal-1',
          mealType: 'BREAKFAST',
          title: 'Breakfast',
          shortDescription: null,
          prepTimeMinutes: 10,
          servingSummary: '1 serving',
          caloriesKcal: 100,
          proteinGrams: 10,
          carbsGrams: 10,
          fatGrams: 2,
          ingredients: [{
            catalogFoodSlug: 'catalog-food-slug',
            name: 'Olive oil',
            quantity: 5,
            unit: 'g',
            isOptional: false,
            caloriesKcal: 45,
            proteinGrams: 0,
            carbsGrams: 0,
            fatGrams: 5,
            usage: 'Use the oil only for cooking.'
          }],
          preparationSteps: ['Cook gently.'],
          substitutions: [],
          explanation: { reasonCodes: ['TARGET_ALIGNED'] }
        }]
      }
    },
    training: {
      recommendation: 'Do not train through pain.',
      intensity: 'LIGHT',
      notes: 'Keep control.',
      exercises: [{
        name: 'Squat',
        targetMuscles: ['legs'],
        equipment: ['bodyweight'],
        safetyNotes: 'Stop if dizziness appears.'
      }]
    },
    recovery: { recommendation: 'Rest well.' },
    reminders: ['Use a steady pace.'],
    checkpointBaseline: {
      capturedAt: '2026-08-01T00:00:00.000Z',
      health: {
        source: null,
        localDate: null,
        sleepMinutes: null,
        steps: null,
        activeCaloriesKcal: null,
        workoutMinutes: null
      },
      progress: { completedMeals: 0, skippedMeals: 0, workoutStatus: 'NOT_STARTED' },
      checkIn: { energyLevel: null, tirednessLevel: null, sorenessLevel: null },
      safetySignals: {
        painOrLimitation: false,
        illness: false,
        dizziness: false,
        exhaustion: false
      }
    },
    debug: {
      provider: 'openai',
      generatedBy: 'OpenAiProviderService'
    }
  };
}
