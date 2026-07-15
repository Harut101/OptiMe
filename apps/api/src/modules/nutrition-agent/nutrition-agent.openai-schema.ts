import { z } from 'zod';

const ingredientSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'catalogFoodSlug',
    'quantity',
    'unit',
    'isOptional'
  ],
  properties: {
    catalogFoodSlug: {
      type: 'string',
      description: 'One allowed catalog food slug from the planning context. Never invent a slug.'
    },
    quantity: { type: 'number', minimum: 0.01, maximum: 10000 },
    unit: { type: 'string', enum: ['g'] },
    isOptional: { type: 'boolean' }
  }
} as const;

const substitutionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['originalItem', 'replacementItem', 'servingSummary', 'reasonCode', 'macroImpactNote'],
  properties: {
    originalItem: { type: 'string' },
    replacementItem: { type: 'string' },
    servingSummary: { type: 'string' },
    reasonCode: {
      type: 'string',
      enum: [
        'ALLERGY_SAFE_ALTERNATIVE',
        'EXCLUDED_FOOD_ALTERNATIVE',
        'PREFERENCE_SWAP',
        'SIMILAR_MACROS',
        'SIMPLER_PREP'
      ]
    },
    macroImpactNote: { type: ['string', 'null'] }
  }
} as const;

const mealSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'mealType',
    'title',
    'shortDescription',
    'prepTimeMinutes',
    'servingSummary',
    'ingredients',
    'preparationSteps',
    'substitutions',
    'explanation'
  ],
  properties: {
    id: { type: 'string', description: 'Stable kebab-case or snake_case ID within this plan.' },
    mealType: {
      type: 'string',
      enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'PRE_WORKOUT', 'POST_WORKOUT']
    },
    title: { type: 'string' },
    shortDescription: { type: ['string', 'null'] },
    prepTimeMinutes: { type: ['integer', 'null'], minimum: 0, maximum: 240 },
    servingSummary: { type: 'string' },
    ingredients: { type: 'array', minItems: 1, maxItems: 20, items: ingredientSchema },
    preparationSteps: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'string' } },
    substitutions: { type: 'array', maxItems: 8, items: substitutionSchema },
    explanation: {
      type: 'object',
      additionalProperties: false,
      required: ['reasonCodes', 'params'],
      properties: {
        reasonCodes: {
          type: 'array',
          minItems: 1,
          maxItems: 6,
          items: {
            type: 'string',
            enum: [
              'TARGET_ALIGNED',
              'PREFERENCE_ALIGNED',
              'TRAINING_SUPPORT',
              'RECOVERY_SUPPORT',
              'SIMPLE_PREP',
              'SAFETY_ADJUSTED',
              'BALANCED_ENERGY'
            ]
          }
        },
        params: {
          type: 'object',
          additionalProperties: false,
          properties: {},
          required: []
        }
      }
    }
  }
} as const;

export const nutritionAgentFoodPlanOpenAiSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['meals'],
  properties: {
    meals: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: mealSchema
    }
  }
} as const;

const draftIngredientSchema = z.object({
  catalogFoodSlug: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(10000),
  unit: z.literal('g'),
  isOptional: z.boolean()
}).strict();

const draftSubstitutionSchema = z.object({
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
}).strict();

const draftMealSchema = z.object({
  id: z.string().trim().min(1).max(80),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'PRE_WORKOUT', 'POST_WORKOUT']),
  title: z.string().trim().min(1).max(120),
  shortDescription: z.string().trim().max(240).nullable(),
  prepTimeMinutes: z.number().int().min(0).max(240).nullable(),
  servingSummary: z.string().trim().min(1).max(180),
  ingredients: z.array(draftIngredientSchema).min(1).max(20),
  preparationSteps: z.array(z.string().trim().min(1).max(220)).min(1).max(10),
  substitutions: z.array(draftSubstitutionSchema).max(8),
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
    params: z.record(z.string(), z.unknown())
  }).strict()
}).strict();

// The model selects only catalog IDs and gram quantities. The backend resolves food names
// and nutrition values, then creates the public DailyFoodPlan contract.
export const nutritionAgentFoodPlanDraftSchema = z.object({
  meals: z.array(draftMealSchema).min(1).max(8)
}).strict();

export type NutritionAgentFoodPlanDraft = z.infer<typeof nutritionAgentFoodPlanDraftSchema>;
