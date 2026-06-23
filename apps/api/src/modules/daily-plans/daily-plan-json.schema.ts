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
      }).optional()
    })
    .optional()
});

export type DailyPlanJson = z.infer<typeof dailyPlanJsonSchema>;
