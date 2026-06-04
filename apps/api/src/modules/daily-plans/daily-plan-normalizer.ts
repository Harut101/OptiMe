import { DailyReadinessLevel } from '@prisma/client';

import { DailyPlanJson, dailyPlanJsonSchema } from './daily-plan-json.schema';

interface NormalizeDailyPlanInput {
  planJson: unknown;
  planLocalDate: string;
  planTimezone: string;
  readinessLevel: string;
  safeMode?: boolean;
}

export function normalizeDailyPlanJson(input: NormalizeDailyPlanInput): DailyPlanJson {
  const parsed = dailyPlanJsonSchema.safeParse(input.planJson);

  if (parsed.success) {
    return parsed.data;
  }

  return normalizeLegacyPlanJson(input);
}

function normalizeLegacyPlanJson(input: NormalizeDailyPlanInput): DailyPlanJson {
  const record = isRecord(input.planJson) ? input.planJson : {};
  const legacyPlan = isRecord(record.plan) ? record.plan : {};
  const readiness = normalizeReadiness(input.readinessLevel);
  const summary = stringOrDefault(
    legacyPlan.summary,
    'Today is about steady energy, practical meals, and manageable movement.'
  );
  const calorieGuidance = isRecord(legacyPlan.calorieGuidance)
    ? legacyPlan.calorieGuidance
    : {};
  const macroGuidance = isRecord(legacyPlan.macroGuidance) ? legacyPlan.macroGuidance : {};
  const hydration = isRecord(legacyPlan.hydration) ? legacyPlan.hydration : {};
  const training = isRecord(legacyPlan.trainingRecommendation)
    ? legacyPlan.trainingRecommendation
    : {};
  const recovery = isRecord(legacyPlan.recoveryRecommendation)
    ? legacyPlan.recoveryRecommendation
    : {};

  return dailyPlanJsonSchema.parse({
    schemaVersion: 'sprint-2.v1',
    generatedAt: stringOrDefault(record.generatedAt, new Date().toISOString()),
    mockVersion: 1,
    safety: {
      safeMode: Boolean(input.safeMode),
      adjustedForSafety: false,
      reasons: arrayOfStrings(legacyPlan.warnings)
    },
    summary: {
      title: readiness === 'RECOVER' ? 'Recovery-focused day' : 'Steady plan for today',
      message: summary,
      readiness
    },
    nutrition: {
      calorieGuidance: {
        label: 'Balanced guidance',
        notes: stringOrDefault(
          calorieGuidance.reason,
          'A balanced target for steady energy today.'
        )
      },
      macroGuidance: {
        protein: legacyMacroValue(macroGuidance.proteinGrams),
        carbs: legacyMacroValue(macroGuidance.carbsGrams),
        fat: legacyMacroValue(macroGuidance.fatsGrams),
        notes: 'Use this as practical direction, not a strict rule.'
      },
      meals: normalizeLegacyMeals(legacyPlan.meals),
      hydration: {
        guidance: legacyHydrationValue(hydration.targetLiters),
        notes: stringOrDefault(hydration.timingNotes, 'Sip regularly across the day.')
      }
    },
    training: {
      recommendation: stringOrDefault(
        training.summary,
        'Choose movement that feels manageable today.'
      ),
      intensity: normalizeTrainingIntensity(training.intensity),
      notes: legacyTrainingNotes(training.durationMinutes)
    },
    recovery: {
      recommendation: stringOrDefault(
        recovery.summary,
        'Support recovery with regular meals, hydration, and enough rest.'
      ),
      sleepTip: 'Keep your evening routine calm and realistic.',
      mobilityTip: 'Add gentle mobility if it feels good.'
    },
    reminders:
      arrayOfStrings(recovery.actions).length > 0
        ? arrayOfStrings(recovery.actions)
        : ['Eat regular meals', 'Hydrate regularly', 'Keep effort sustainable']
  });
}

function normalizeLegacyMeals(value: unknown): DailyPlanJson['nutrition']['meals'] {
  if (!Array.isArray(value)) {
    return [
      {
        name: 'Balanced meal',
        purpose: 'Steady energy',
        foods: [
          {
            name: 'A familiar protein option',
            portion: '1 serving',
            notes: 'Choose something that fits your allergies and preferences.'
          }
        ]
      }
    ];
  }

  return value.map((meal) => {
    const record = isRecord(meal) ? meal : {};

    return {
      name: stringOrDefault(record.mealName, 'Balanced meal'),
      purpose: stringOrDefault(record.notes, 'Steady energy'),
      foods: Array.isArray(record.foods)
        ? record.foods.map((food) => {
            const foodRecord = isRecord(food) ? food : {};

            return {
              name: stringOrDefault(foodRecord.name, 'Preferred food'),
              portion: stringOrDefault(foodRecord.portion, '1 serving'),
              notes:
                typeof foodRecord.notes === 'string' && foodRecord.notes.trim().length > 0
                  ? foodRecord.notes
                  : undefined
            };
          })
        : []
    };
  });
}

function normalizeReadiness(value: string): DailyPlanJson['summary']['readiness'] {
  if (
    value === DailyReadinessLevel.PUSH ||
    value === DailyReadinessLevel.MAINTAIN ||
    value === DailyReadinessLevel.RECOVER
  ) {
    return value;
  }

  return 'MAINTAIN';
}

function normalizeTrainingIntensity(value: unknown): DailyPlanJson['training']['intensity'] {
  if (value === 'LOW') {
    return 'LIGHT';
  }

  if (value === 'HIGH') {
    return 'HARD';
  }

  if (value === 'REST' || value === 'LIGHT' || value === 'MODERATE' || value === 'HARD') {
    return value;
  }

  return 'MODERATE';
}

function legacyMacroValue(value: unknown) {
  return typeof value === 'number' ? `${value}g` : 'Flexible';
}

function legacyHydrationValue(value: unknown) {
  return typeof value === 'number'
    ? `Aim for about ${value} liters across the day.`
    : 'Sip water regularly across the day.';
}

function legacyTrainingNotes(value: unknown) {
  return typeof value === 'number'
    ? `Keep it around ${value} minutes if that feels good.`
    : 'Adjust duration based on energy and recovery.';
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
