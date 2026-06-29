import { z } from 'zod';

const foodItemSchema = z.object({
  name: z.string(),
  portion: z.string(),
  notes: z.string().optional()
});

const mealSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  foods: z.array(foodItemSchema)
});

const foodNutritionTotalsSchema = z.object({
  caloriesKcal: z.number().int().min(0).max(10000),
  proteinGrams: z.number().min(0).max(1000),
  carbsGrams: z.number().min(0).max(1500),
  fatGrams: z.number().min(0).max(1000)
});

const foodIngredientSchema = foodNutritionTotalsSchema.extend({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(10000),
  unit: z.enum(['g', 'ml', 'piece', 'tbsp', 'tsp', 'cup', 'serving']),
  isOptional: z.boolean()
});

const foodSubstitutionSchema = z.object({
  originalItem: z.string().trim().min(1).max(120),
  replacementItem: z.string().trim().min(1).max(120),
  servingSummary: z.string().trim().min(1).max(160),
  reasonCode: z.enum([
    'ALLERGY_SAFE_ALTERNATIVE',
    'EXCLUDED_FOOD_ALTERNATIVE',
    'PREFERENCE_SWAP',
    'SIMILAR_MACROS',
    'SIMPLER_PREP'
  ]),
  macroImpactNote: z.string().trim().max(180).nullable()
});

const foodMealSchema = foodNutritionTotalsSchema.extend({
  id: z.string().trim().min(1).max(80),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'PRE_WORKOUT', 'POST_WORKOUT']),
  title: z.string().trim().min(1).max(120),
  shortDescription: z.string().trim().max(240).nullable(),
  prepTimeMinutes: z.number().int().min(0).max(240).nullable(),
  servingSummary: z.string().trim().min(1).max(180),
  ingredients: z.array(foodIngredientSchema).min(1).max(20),
  preparationSteps: z.array(z.string().trim().min(1).max(220)).min(1).max(10),
  substitutions: z.array(foodSubstitutionSchema).max(8),
  explanation: z.object({
    reasonCodes: z.array(z.enum([
      'TARGET_ALIGNED',
      'PREFERENCE_ALIGNED',
      'TRAINING_SUPPORT',
      'RECOVERY_SUPPORT',
      'SIMPLE_PREP',
      'SAFETY_ADJUSTED',
      'BALANCED_ENERGY'
    ])).min(1).max(6),
    params: z.record(z.string(), z.unknown()).optional()
  })
});

const exerciseSchema = z.object({
  exerciseId: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(120),
  targetMuscles: z.array(z.string().trim().min(1).max(60)).max(5),
  equipment: z.array(z.string().trim().min(1).max(60)).max(5),
  sets: z.string().trim().max(40).optional(),
  reps: z.string().trim().max(40).optional(),
  rest: z.string().trim().max(40).optional(),
  duration: z.string().trim().max(60).optional(),
  intensityCue: z.string().trim().max(160).optional(),
  safetyNotes: z.string().trim().max(220).optional(),
  notes: z.string().trim().max(220).optional(),
  exerciseSnapshot: z.object({
    resolvedLocale: z.enum(['en-US', 'ru-RU', 'fr-FR', 'zh-CN']),
    category: z.enum(['STRENGTH', 'MOBILITY', 'CARDIO', 'RECOVERY']),
    movementPattern: z.enum(['SQUAT', 'HINGE', 'HORIZONTAL_PUSH', 'VERTICAL_PUSH', 'HORIZONTAL_PULL', 'VERTICAL_PULL', 'LUNGE', 'CARRY', 'ROTATION', 'ANTI_ROTATION', 'CORE_FLEXION', 'CORE_STABILITY', 'ISOLATION', 'MOBILITY', 'CARDIO', 'RECOVERY']),
    equipment: z.array(z.enum(['NONE', 'BODYWEIGHT', 'DUMBBELLS', 'BARBELL', 'KETTLEBELL', 'RESISTANCE_BANDS', 'MACHINES', 'BENCH', 'PULL_UP_BAR', 'CABLE_MACHINE', 'CARDIO_MACHINE'])),
    targetMuscles: z.array(z.string()),
    secondaryMuscles: z.array(z.string()),
    instructions: z.array(z.string()),
    coachingCues: z.array(z.string()),
    safetyNotes: z.array(z.string()),
    exerciseUpdatedAt: z.string().datetime()
  }).optional()
});

const resolvedTrainingDayContextSchema = z.object({
  source: z.enum(['WEEKLY_SCHEDULE', 'GLOBAL_DEFAULTS']),
  localDate: z.string(),
  dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
  isTrainingDay: z.boolean(),
  targetMuscles: z.array(z.enum([
    'CHEST', 'TRAPS', 'LATS', 'LOWER_BACK', 'ABS', 'OBLIQUES', 'BICEPS', 'TRICEPS',
    'FOREARMS', 'QUADRICEPS', 'HAMSTRINGS', 'ADDUCTORS', 'ABDUCTORS', 'CALVES',
    'BACK', 'LEGS', 'GLUTES', 'CORE', 'SHOULDERS', 'ARMS', 'FULL_BODY'
  ])),
  environment: z.enum(['HOME', 'GYM', 'OUTDOOR']).nullable(),
  availableEquipment: z.array(z.enum(['NONE', 'BODYWEIGHT', 'DUMBBELLS', 'BARBELL', 'KETTLEBELL', 'RESISTANCE_BANDS', 'MACHINES', 'BENCH', 'PULL_UP_BAR', 'CABLE_MACHINE', 'CARDIO_MACHINE'])),
  durationMinutes: z.number().int().min(1).max(300),
  protocolPreference: z.string().nullable(),
  inheritedFields: z.array(z.enum(['TARGET_MUSCLES', 'ENVIRONMENT', 'EQUIPMENT', 'DURATION', 'PROTOCOL']))
});

const nutritionDayTypeSchema = z.enum([
  'NUTRITION_ONLY',
  'TRAINING_DAY',
  'REST_DAY',
  'TRAINING_DISABLED'
]);

const nutritionTargetReasonCodeSchema = z.enum([
  'BASED_ON_PRIMARY_GOAL',
  'BASED_ON_NORMAL_ACTIVITY',
  'BASED_ON_RECENT_ACTIVITY',
  'NUTRITION_ONLY_MODE',
  'ADJUSTED_FOR_TRAINING_DAY',
  'SCHEDULED_REST_DAY',
  'TRAINING_DISABLED',
  'CONSERVATIVE_SAFETY_TARGET',
  'NEEDS_PROFILE_DETAILS',
  'LIMITED_BY_HEALTH_CONTEXT',
  'MACROS_DERIVED_FROM_TARGET',
  'USING_MAINTENANCE_ESTIMATE',
  'WEIGHT_LOSS_DEFICIT_APPLIED',
  'WEIGHT_GAIN_SURPLUS_APPLIED',
  'HEALTHY_EATING_BALANCED_TARGET'
]);

const nutritionTargetExplanationSchema = z.object({
  titleCode: z.enum(['TODAY_TARGET', 'MORE_INFO_NEEDED']),
  reasonCodes: z.array(
    z.object({
      code: nutritionTargetReasonCodeSchema,
      params: z
        .object({
          primaryGoal: z.enum(['WEIGHT_LOSS', 'WEIGHT_MAINTENANCE', 'WEIGHT_GAIN', 'HEALTHY_EATING']).optional(),
          appMode: z.enum(['NUTRITION_ONLY', 'NUTRITION_AND_TRAINING']).optional(),
          dayType: nutritionDayTypeSchema.optional(),
          durationMinutes: z.number().int().min(1).max(300).optional(),
          targetKcal: z.number().int().min(0).optional(),
          minKcal: z.number().int().min(0).optional(),
          maxKcal: z.number().int().min(0).optional(),
          proteinGrams: z.number().int().min(0).optional(),
          carbsGrams: z.number().int().min(0).optional(),
          fatGrams: z.number().int().min(0).optional(),
          missingFields: z.array(z.enum(['profile', 'dateOfBirth', 'heightCm', 'weightKg', 'activityLevel'])).optional()
        })
        .optional()
    })
  )
});

const legacyNutritionTargetExplanationSchema = z.object({
  title: z.string(),
  bullets: z.array(z.string())
});

const nutritionTargetSnapshotSchema = z.object({
  engineVersion: z.number().int().min(1),
  localDate: z.string(),
  dayType: nutritionDayTypeSchema,
  appMode: z.enum(['NUTRITION_ONLY', 'NUTRITION_AND_TRAINING']),
  primaryGoal: z.enum(['WEIGHT_LOSS', 'WEIGHT_MAINTENANCE', 'WEIGHT_GAIN', 'HEALTHY_EATING']),
  targetKcal: z.number().int().min(0),
  minKcal: z.number().int().min(0),
  maxKcal: z.number().int().min(0),
  maintenanceEstimateKcal: z.number().int().min(0),
  proteinGrams: z.number().int().min(0),
  carbsGrams: z.number().int().min(0),
  fatGrams: z.number().int().min(0),
  safetyStatus: z.enum(['OK', 'LIMITED', 'NEEDS_MORE_INFO']),
  safetyReasons: z.array(z.string()),
  explanation: z.union([nutritionTargetExplanationSchema, legacyNutritionTargetExplanationSchema])
});

export const dailyFoodPlanSchema = z.object({
  source: z.enum(['NUTRITION_AGENT', 'DETERMINISTIC_FALLBACK']),
  localDate: z.string(),
  locale: z.enum(['en-US', 'ru-RU', 'fr-FR', 'zh-CN']),
  nutritionTargetSnapshot: nutritionTargetSnapshotSchema,
  totals: foodNutritionTotalsSchema,
  validation: z.object({
    status: z.enum(['VALID', 'ADJUSTED', 'FALLBACK', 'INVALID']),
    reasons: z.array(z.string()).max(20),
    tolerances: z.object({
      caloriesPercent: z.number().min(0).max(100),
      proteinGrams: z.number().min(0).max(1000),
      carbsGrams: z.number().min(0).max(1000),
      fatGrams: z.number().min(0).max(1000)
    })
  }),
  meals: z.array(foodMealSchema).min(1).max(8)
});

const wearablePlanningReasonCodeSchema = z.enum([
  'NO_WEARABLE_DATA',
  'STALE_WEARABLE_DATA',
  'PARTIAL_WEARABLE_DATA',
  'LOW_SLEEP',
  'OK_SLEEP',
  'HIGH_ACTIVITY',
  'MODERATE_ACTIVITY',
  'RECENT_WORKOUT_LOAD',
  'RECOVERY_DATA_AVAILABLE',
  'LIMITED_RECOVERY_DATA',
  'APPLE_HEALTH_NO_RECOVERY_SCORE'
]);

const trainingLoadReadinessHintSchema = z.enum([
  'NORMAL',
  'CONTROLLED',
  'LIGHT',
  'RECOVERY_FOCUSED',
  'UNKNOWN'
]);

const trainingLoadReasonCodeSchema = z.enum([
  'LOW_SLEEP',
  'HIGH_ACTIVITY',
  'RECENT_WORKOUT_LOAD',
  'PARTIAL_WEARABLE_DATA',
  'STALE_WEARABLE_DATA',
  'NO_WEARABLE_DATA'
]);

const dailyPlanContextNotesSchema = z.object({
  wearable: z
    .object({
      titleCode: z.enum([
        'WEARABLE_DATA_INCLUDED',
        'APPLE_HEALTH_DATA_INCLUDED',
        'USING_PROFILE_AND_SCHEDULE',
        'TRAINING_LOAD_CONTEXT',
        'RECOVERY_CONTEXT'
      ]),
      messageCode: z.enum([
        'RECENT_ACTIVITY_AND_SLEEP_AVAILABLE',
        'RECENT_ACTIVITY_INCLUDED',
        'RECENT_SLEEP_INCLUDED',
        'NO_RECENT_WEARABLE_DATA_USED',
        'WEARABLE_DATA_STALE',
        'KEEP_WORKOUT_CONTROLLED',
        'TAKE_LONGER_RESTS',
        'GENTLER_RECOVERY_FOCUS'
      ]),
      reasonCodes: z.array(wearablePlanningReasonCodeSchema).max(12)
    })
    .optional(),
  trainingLoad: z
    .object({
      titleCode: z.enum([
        'WEARABLE_DATA_INCLUDED',
        'APPLE_HEALTH_DATA_INCLUDED',
        'USING_PROFILE_AND_SCHEDULE',
        'TRAINING_LOAD_CONTEXT',
        'RECOVERY_CONTEXT'
      ]),
      messageCode: z.enum([
        'RECENT_ACTIVITY_AND_SLEEP_AVAILABLE',
        'RECENT_ACTIVITY_INCLUDED',
        'RECENT_SLEEP_INCLUDED',
        'NO_RECENT_WEARABLE_DATA_USED',
        'WEARABLE_DATA_STALE',
        'KEEP_WORKOUT_CONTROLLED',
        'TAKE_LONGER_RESTS',
        'GENTLER_RECOVERY_FOCUS'
      ]),
      readinessHint: trainingLoadReadinessHintSchema,
      reasonCodes: z.array(trainingLoadReasonCodeSchema).max(8)
    })
    .optional(),
  recovery: z
    .object({
      titleCode: z.enum([
        'WEARABLE_DATA_INCLUDED',
        'APPLE_HEALTH_DATA_INCLUDED',
        'USING_PROFILE_AND_SCHEDULE',
        'TRAINING_LOAD_CONTEXT',
        'RECOVERY_CONTEXT'
      ]),
      messageCode: z.enum([
        'RECENT_ACTIVITY_AND_SLEEP_AVAILABLE',
        'RECENT_ACTIVITY_INCLUDED',
        'RECENT_SLEEP_INCLUDED',
        'NO_RECENT_WEARABLE_DATA_USED',
        'WEARABLE_DATA_STALE',
        'KEEP_WORKOUT_CONTROLLED',
        'TAKE_LONGER_RESTS',
        'GENTLER_RECOVERY_FOCUS'
      ]),
      reasonCodes: z.array(wearablePlanningReasonCodeSchema).max(12)
    })
    .optional()
});

export const dailyPlanJsonSchema = z.object({
  schemaVersion: z.literal('sprint-2.v1'),
  generatedAt: z.string().datetime(),
  mockVersion: z.number().int().min(0),
  safety: z.object({
    safeMode: z.boolean(),
    adjustedForSafety: z.boolean(),
    reasons: z.array(z.string()),
    userSafeMessage: z.string().optional()
  }),
  summary: z.object({
    title: z.string(),
    message: z.string(),
    readiness: z.enum(['PUSH', 'MAINTAIN', 'RECOVER'])
  }),
  nutrition: z.object({
    calorieGuidance: z.object({
      label: z.string(),
      notes: z.string()
    }),
    macroGuidance: z.object({
      protein: z.string(),
      carbs: z.string(),
      fat: z.string(),
      notes: z.string()
    }),
    meals: z.array(mealSchema),
    menuOptions: z
      .array(
        z.object({
          label: z.string(),
          focus: z.string(),
          meals: z.array(mealSchema)
        })
      )
      .optional(),
    foodPlan: dailyFoodPlanSchema.optional(),
    hydration: z.object({
      guidance: z.string(),
      notes: z.string().optional()
    })
  }),
  training: z.object({
    recommendation: z.string(),
    intensity: z.enum(['REST', 'LIGHT', 'MODERATE', 'HARD']),
    notes: z.string(),
    exercises: z.array(exerciseSchema).max(8).optional()
  }),
  trainingScheduleSnapshot: resolvedTrainingDayContextSchema.optional(),
  nutritionTargetSnapshot: nutritionTargetSnapshotSchema.optional(),
  contextNotes: dailyPlanContextNotesSchema.optional(),
  recovery: z.object({
    recommendation: z.string(),
    sleepTip: z.string().optional(),
    mobilityTip: z.string().optional()
  }),
  reminders: z.array(z.string()),
  debug: z
    .object({
      provider: z.enum(['mock', 'openai', 'fallback']),
      generatedBy: z.enum([
        'MockAiProviderService',
        'OpenAiProviderService',
        'SafeFallbackPlanFactory'
      ]),
      planQualityMode: z.enum(['BASIC', 'PERSONALIZED', 'ADAPTIVE']).optional(),
      protocols: z
        .object({
          nutritionProtocolId: z.string(),
          trainingProtocolId: z.string(),
          recoveryProtocolId: z.string()
        })
        .optional(),
      healthSignals: z
        .object({
          lowSleep: z.boolean(),
          highActivityYesterday: z.boolean(),
          recentWorkout: z.boolean(),
          lowStepTrend: z.boolean()
        })
        .optional(),
      wearableContext: z
        .object({
          source: z.enum(['APPLE_HEALTH', 'HEALTH_CONNECT', 'WHOOP', 'MANUAL', 'MOCK']),
          hasRecentData: z.boolean(),
          isStale: z.boolean(),
          localDate: z.string().optional()
        })
        .optional(),
      fallbackReason: z.string().optional(),
      safetyAgent: z
        .object({
          enabled: z.boolean(),
          provider: z.enum(['mock', 'openai']),
          approved: z.boolean().optional(),
          riskLevel: z.enum(['low', 'medium', 'high']).optional(),
          retryUsed: z.boolean().optional(),
          retryResult: z.enum(['approved', 'rejected', 'failed', 'not_used']).optional()
        })
        .optional(),
      exerciseSelection: z.object({
        candidateCount: z.number().int().min(0).max(16),
        requestedExerciseCount: z.number().int().min(0).max(8),
        fallbackMode: z.enum(['NONE', 'BODYWEIGHT_ONLY', 'RECOVERY_FOCUSED', 'MINIMAL_SAFE_POOL']),
        usedAiRetry: z.boolean(),
        usedDeterministicFallback: z.boolean(),
        resolvedLocale: z.enum(['en-US', 'ru-RU', 'fr-FR', 'zh-CN'])
      }).optional(),
      trainingLoadContext: z.object({
        hasTrainingLoadContext: z.boolean(),
        readinessHint: trainingLoadReadinessHintSchema,
        reasons: z.array(trainingLoadReasonCodeSchema).max(8)
      }).optional()
    })
    .optional()
});

export type DailyPlanJson = z.infer<typeof dailyPlanJsonSchema>;
