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

export type DailyPlanJson = z.infer<typeof dailyPlanJsonSchema>;
