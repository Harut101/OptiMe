import { z } from 'zod';

export const emailSchema = z.string().email().trim().toLowerCase();

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  privacyConsentAccepted: z.boolean().optional()
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8)
});

export const profileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  gender: z.string().optional(),
  pregnancyStatus: z
    .enum([
      'NOT_PREGNANT',
      'PREGNANT',
      'POSTPARTUM',
      'BREASTFEEDING',
      'PREFER_NOT_TO_SAY',
      'UNKNOWN'
    ])
    .optional(),
  dateOfBirth: z.string(),
  heightCm: z.coerce.number().min(80).max(260),
  weightKg: z.coerce.number().min(20).max(350),
  activityLevel: z.enum(['LOW', 'LIGHT', 'MODERATE', 'HIGH', 'ATHLETE']),
  privacyConsentAccepted: z.boolean().optional()
});

export const goalSchema = z.object({
  goalType: z.enum([
    'HEALTHY_LIFESTYLE',
    'IMPROVE_FITNESS',
    'BUILD_MUSCLE',
    'IMPROVE_ENDURANCE',
    'REDUCE_WEIGHT'
  ]).optional(),
  primaryGoal: z
    .enum(['WEIGHT_LOSS', 'WEIGHT_MAINTENANCE', 'WEIGHT_GAIN', 'HEALTHY_EATING'])
    .optional(),
  targetWeightKg: z.coerce.number().min(20).max(350).optional(),
  targetTimelineDays: z.coerce.number().int().min(14).max(730).optional(),
  impactMode: z.enum(['NUTRITION_ONLY', 'NUTRITION_AND_TRAINING']).optional(),
  appMode: z.enum(['NUTRITION_ONLY', 'NUTRITION_AND_TRAINING']).optional()
}).refine((value) => value.goalType || value.primaryGoal, {
  message: 'Either goalType or primaryGoal is required.',
  path: ['primaryGoal']
});

export const nutritionPreferencesSchema = z.object({
  dietType: z.enum([
    'NONE',
    'OMNIVORE',
    'VEGETARIAN',
    'VEGAN',
    'PESCATARIAN',
    'KETO',
    'LOW_CARB',
    'MEDITERRANEAN',
    'HALAL',
    'KOSHER'
  ]).optional(),
  mealsPerDay: z.coerce.number().int().min(1).max(8).optional(),
  noKnownAllergiesConfirmed: z.boolean().optional(),
  notes: z.string().optional(),
  allergies: z.array(z.string()).max(30).optional(),
  excludedFoods: z.array(z.string()).max(60).optional(),
  preferredFoods: z.array(z.string()).max(60).optional()
});

export const trainingScheduleItemSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  sportType: z.enum([
    'RUNNING',
    'CYCLING',
    'GYM',
    'STRENGTH',
    'HIIT',
    'YOGA',
    'SWIMMING',
    'WALKING',
    'TEAM_SPORT',
    'OTHER'
  ]),
  durationMinutes: z.coerce.number().int().min(1).max(300),
  intensity: z.enum(['LOW', 'MODERATE', 'HIGH']),
  description: z.string().optional()
});

export const trainingIntentSchema = z.object({
  noTrainingPlanned: z.boolean()
});

export const trainingPreferenceSchema = z.object({
  targetMuscleGroups: z
    .array(z.enum([
      'CHEST', 'TRAPS', 'LATS', 'LOWER_BACK', 'ABS', 'OBLIQUES', 'BICEPS', 'TRICEPS',
      'FOREARMS', 'QUADRICEPS', 'HAMSTRINGS', 'ADDUCTORS', 'ABDUCTORS', 'CALVES',
      'GLUTES', 'SHOULDERS', 'BACK', 'LEGS', 'CORE', 'ARMS', 'FULL_BODY'
    ]))
    .max(20)
    .optional(),
  trainingOutcome: z
    .enum(['STRENGTH', 'MUSCLE_GROWTH', 'ENDURANCE', 'MOBILITY', 'GENERAL_FITNESS'])
    .nullable()
    .optional(),
  equipment: z
    .array(z.enum(['GYM', 'HOME', 'DUMBBELLS', 'BODYWEIGHT', 'MACHINES']))
    .max(5)
    .optional(),
  trainingLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).nullable().optional(),
  limitationsOrPainAreas: z.array(z.string().max(120)).max(20).optional(),
  preferredTrainingDays: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional()
});

const targetMuscleGroupSchema = z.enum([
  'CHEST', 'TRAPS', 'LATS', 'LOWER_BACK', 'ABS', 'OBLIQUES', 'BICEPS', 'TRICEPS',
  'FOREARMS', 'QUADRICEPS', 'HAMSTRINGS', 'ADDUCTORS', 'ABDUCTORS', 'CALVES',
  'GLUTES', 'SHOULDERS', 'BACK', 'LEGS', 'CORE', 'ARMS', 'FULL_BODY'
]);
const exerciseEquipmentSchema = z.enum([
  'NONE',
  'BODYWEIGHT',
  'DUMBBELLS',
  'BARBELL',
  'KETTLEBELL',
  'RESISTANCE_BANDS',
  'MACHINES',
  'BENCH',
  'PULL_UP_BAR',
  'CABLE_MACHINE',
  'CARDIO_MACHINE'
]);
export const dayOfWeekSchema = z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);
export const trainingEnvironmentSchema = z.enum(['HOME', 'GYM', 'OUTDOOR']);
export const trainingScheduleOverrideModeSchema = z.enum(['USE_DEFAULT', 'CUSTOM']);

export const trainingScheduleDaySchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  isTrainingDay: z.boolean(),
  targetMusclesMode: trainingScheduleOverrideModeSchema,
  targetMuscles: z.array(targetMuscleGroupSchema).max(20).optional(),
  environmentMode: trainingScheduleOverrideModeSchema,
  environment: trainingEnvironmentSchema.nullable().optional(),
  equipmentMode: trainingScheduleOverrideModeSchema,
  availableEquipment: z.array(exerciseEquipmentSchema).max(20).optional(),
  durationMode: trainingScheduleOverrideModeSchema,
  durationMinutes: z.coerce.number().int().min(1).max(300).nullable().optional(),
  protocolMode: trainingScheduleOverrideModeSchema.optional(),
  protocolPreference: z.string().trim().max(80).nullable().optional()
});

export const trainingScheduleSchema = z.object({
  isActive: z.boolean(),
  days: z.array(trainingScheduleDaySchema).length(7)
});

export const resolvedTrainingDayContextSchema = z.object({
  source: z.enum(['WEEKLY_SCHEDULE', 'GLOBAL_DEFAULTS']),
  localDate: z.string(),
  dayOfWeek: dayOfWeekSchema,
  isTrainingDay: z.boolean(),
  targetMuscles: z.array(targetMuscleGroupSchema),
  environment: trainingEnvironmentSchema.nullable(),
  availableEquipment: z.array(exerciseEquipmentSchema),
  durationMinutes: z.number().int().min(1).max(300),
  protocolPreference: z.string().nullable(),
  inheritedFields: z.array(z.enum(['TARGET_MUSCLES', 'ENVIRONMENT', 'EQUIPMENT', 'DURATION', 'PROTOCOL']))
});

export const nutritionDayTypeSchema = z.enum([
  'NUTRITION_ONLY',
  'TRAINING_DAY',
  'REST_DAY',
  'TRAINING_DISABLED'
]);
export const nutritionSafetyStatusSchema = z.enum(['OK', 'LIMITED', 'NEEDS_MORE_INFO']);
export const nutritionTargetTitleCodeSchema = z.enum([
  'TODAY_TARGET',
  'MORE_INFO_NEEDED'
]);
export const nutritionTargetReasonCodeSchema = z.enum([
  'BASED_ON_PRIMARY_GOAL',
  'BASED_ON_NORMAL_ACTIVITY',
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
export const nutritionTargetMissingFieldSchema = z.enum([
  'profile',
  'dateOfBirth',
  'heightCm',
  'weightKg',
  'activityLevel'
]);

export const nutritionTargetExplanationSchema = z.object({
  titleCode: nutritionTargetTitleCodeSchema,
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
          missingFields: z.array(nutritionTargetMissingFieldSchema).optional()
        })
        .optional()
    })
  )
});

export const legacyNutritionTargetExplanationSchema = z.object({
  title: z.string(),
  bullets: z.array(z.string())
});

export const nutritionTargetSchema = z.object({
  engineVersion: z.number().int().min(1),
  localDate: z.string(),
  source: z.literal('DETERMINISTIC_ENGINE'),
  appMode: z.enum(['NUTRITION_ONLY', 'NUTRITION_AND_TRAINING']),
  primaryGoal: z.enum(['WEIGHT_LOSS', 'WEIGHT_MAINTENANCE', 'WEIGHT_GAIN', 'HEALTHY_EATING']),
  dayType: nutritionDayTypeSchema,
  calories: z.object({
    targetKcal: z.number().int().min(0),
    minKcal: z.number().int().min(0),
    maxKcal: z.number().int().min(0),
    maintenanceEstimateKcal: z.number().int().min(0),
    adjustmentKcal: z.number().int(),
    adjustmentReason: z.string()
  }),
  macros: z.object({
    proteinGrams: z.number().int().min(0),
    carbsGrams: z.number().int().min(0),
    fatGrams: z.number().int().min(0),
    proteinKcal: z.number().int().min(0),
    carbsKcal: z.number().int().min(0),
    fatKcal: z.number().int().min(0)
  }),
  context: z.object({
    trainingEnabled: z.boolean(),
    scheduledTrainingDay: z.boolean(),
    plannedWorkoutDurationMinutes: z.number().int().min(1).max(300).nullable(),
    plannedWorkoutIntensity: z.string().nullable(),
    normalActivityLevel: z.enum(['LOW', 'LIGHT', 'MODERATE', 'HIGH', 'ATHLETE']).nullable(),
    inheritedScheduleFields: z.array(z.enum(['TARGET_MUSCLES', 'ENVIRONMENT', 'EQUIPMENT', 'DURATION', 'PROTOCOL'])).optional()
  }),
  safety: z.object({
    status: nutritionSafetyStatusSchema,
    reasons: z.array(z.string()),
    warnings: z.array(z.string())
  }),
  explanation: nutritionTargetExplanationSchema
});

export const nutritionTargetSnapshotSchema = z.object({
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
  safetyStatus: nutritionSafetyStatusSchema,
  safetyReasons: z.array(z.string()),
  explanation: z.union([nutritionTargetExplanationSchema, legacyNutritionTargetExplanationSchema])
});

export const progressivePromptAnswerSchema = z.object({
  value: z.union([
    z.string(),
    z.array(z.string()),
    z.number(),
    z.boolean()
  ])
});

export const generateDailyPlanSchema = z.object({
  forceRegenerate: z.boolean().optional()
});

export const dailyPlanReadinessSchema = z.enum(['PUSH', 'MAINTAIN', 'RECOVER']);
export const dailyPlanStatusSchema = z.enum(['READY', 'FALLBACK']);

const dailyPlanFoodItemSchema = z.object({
  name: z.string(),
  portion: z.string(),
  notes: z.string().optional()
});

const dailyPlanMealSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  foods: z.array(dailyPlanFoodItemSchema)
});

const dailyPlanExerciseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  targetMuscles: z.array(z.string().trim().min(1).max(60)).max(5),
  equipment: z.array(z.string().trim().min(1).max(60)).max(5),
  sets: z.string().trim().max(40).optional(),
  reps: z.string().trim().max(40).optional(),
  rest: z.string().trim().max(40).optional(),
  duration: z.string().trim().max(60).optional(),
  intensityCue: z.string().trim().max(160).optional(),
  safetyNotes: z.string().trim().max(220).optional()
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
    readiness: dailyPlanReadinessSchema
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
    meals: z.array(dailyPlanMealSchema),
    menuOptions: z
      .array(
        z.object({
          label: z.string(),
          focus: z.string(),
          meals: z.array(dailyPlanMealSchema)
        })
      )
      .optional(),
    hydration: z.object({
      guidance: z.string(),
      notes: z.string().optional()
    })
  }),
  training: z.object({
    recommendation: z.string(),
    intensity: z.enum(['REST', 'LIGHT', 'MODERATE', 'HARD']),
    notes: z.string(),
    exercises: z.array(dailyPlanExerciseSchema).max(8).optional()
  }),
  trainingScheduleSnapshot: resolvedTrainingDayContextSchema.optional(),
  nutritionTargetSnapshot: nutritionTargetSnapshotSchema.optional(),
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
        .optional()
    })
    .optional()
});

export const dailyPlanResponseSchema = z.object({
  id: z.string(),
  planLocalDate: z.string(),
  planTimezone: z.string(),
  status: dailyPlanStatusSchema,
  readinessLevel: dailyPlanReadinessSchema,
  updatedAt: z.string(),
  plan: dailyPlanJsonSchema
});

export const planFeedbackRatingSchema = z.enum(['HELPFUL', 'NOT_HELPFUL']);
export const planFeedbackTagSchema = z.enum([
  'TOO_MUCH_FOOD',
  'TOO_LITTLE_FOOD',
  'TRAINING_TOO_HARD',
  'TRAINING_TOO_EASY',
  'FELT_GOOD',
  'LOW_ENERGY',
  'RECOVERY_NEEDED'
]);

export const dailyPlanHistoryResponseSchema = z.object({
  items: z.array(dailyPlanResponseSchema)
});

export const submitDailyPlanFeedbackSchema = z.object({
  rating: planFeedbackRatingSchema.optional(),
  tags: z.array(planFeedbackTagSchema).max(7).optional(),
  notes: z.string().max(500).optional()
});

export const dailyPlanFeedbackResponseSchema = z.object({
  id: z.string(),
  dailyPlanId: z.string(),
  rating: planFeedbackRatingSchema.nullable(),
  tags: z.array(planFeedbackTagSchema),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const dailyCheckInTypeSchema = z.enum(['MEAL', 'TRAINING', 'EVENING_REFLECTION']);
export const mealCheckInStatusSchema = z.enum([
  'COMPLETED',
  'PARTIALLY_COMPLETED',
  'SKIPPED',
  'SWAPPED'
]);
export const trainingCheckInStatusSchema = z.enum([
  'COMPLETED',
  'PARTIALLY_COMPLETED',
  'SKIPPED',
  'RESTED_INSTEAD'
]);

export const createDailyPlanCheckInSchema = z.object({
  type: dailyCheckInTypeSchema,
  payload: z.record(z.string(), z.unknown())
});
