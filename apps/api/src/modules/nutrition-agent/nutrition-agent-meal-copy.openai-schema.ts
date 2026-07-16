import { z } from 'zod';

const mealCopySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'title',
    'shortDescription',
    'prepTimeMinutes',
    'servingSummary',
    'preparationSteps'
  ],
  properties: {
    id: {
      type: 'string',
      description: 'The exact meal ID supplied in composedMeals. Do not invent or change it.'
    },
    title: { type: 'string' },
    shortDescription: { type: ['string', 'null'] },
    prepTimeMinutes: { type: ['integer', 'null'], minimum: 0, maximum: 240 },
    servingSummary: { type: 'string' },
    preparationSteps: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: { type: 'string' }
    }
  }
} as const;

export const nutritionAgentMealCopyOpenAiSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['meals'],
  properties: {
    meals: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: mealCopySchema
    }
  }
} as const;

const draftMealCopySchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  shortDescription: z.string().trim().max(240).nullable(),
  prepTimeMinutes: z.number().int().min(0).max(240).nullable(),
  servingSummary: z.string().trim().min(1).max(180),
  preparationSteps: z.array(z.string().trim().min(1).max(220)).min(1).max(10)
}).strict();

export const nutritionAgentMealCopyDraftSchema = z.object({
  meals: z.array(draftMealCopySchema).min(1).max(8)
}).strict();

export type NutritionAgentMealCopyDraft = z.infer<typeof nutritionAgentMealCopyDraftSchema>;
