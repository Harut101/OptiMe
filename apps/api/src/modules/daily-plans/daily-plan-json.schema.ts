import { z } from 'zod';

export const dailyPlanJsonSchema = z.object({
  schemaVersion: z.literal('sprint-2.v1'),
  generatedAt: z.string().datetime(),
  mockVersion: z.number().int().min(0),
  safety: z.object({
    safeMode: z.boolean(),
    adjustedForSafety: z.boolean(),
    reasons: z.array(z.string())
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
    meals: z.array(
      z.object({
        name: z.string(),
        purpose: z.string(),
        foods: z.array(
          z.object({
            name: z.string(),
            portion: z.string(),
            notes: z.string().optional()
          })
        )
      })
    ),
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
      fallbackReason: z.string().optional(),
      safetyAgent: z
        .object({
          enabled: z.boolean(),
          provider: z.enum(['mock', 'openai']),
          approved: z.boolean().optional(),
          riskLevel: z.enum(['low', 'medium', 'high']).optional()
        })
        .optional()
    })
    .optional()
});

export type DailyPlanJson = z.infer<typeof dailyPlanJsonSchema>;
