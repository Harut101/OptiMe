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
    notes: z.string()
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
