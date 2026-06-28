const nutritionTotalsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['caloriesKcal', 'proteinGrams', 'carbsGrams', 'fatGrams'],
  properties: {
    caloriesKcal: { type: 'integer', minimum: 0, maximum: 10000 },
    proteinGrams: { type: 'number', minimum: 0, maximum: 1000 },
    carbsGrams: { type: 'number', minimum: 0, maximum: 1500 },
    fatGrams: { type: 'number', minimum: 0, maximum: 1000 }
  }
} as const;

const ingredientSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name',
    'quantity',
    'unit',
    'caloriesKcal',
    'proteinGrams',
    'carbsGrams',
    'fatGrams',
    'isOptional'
  ],
  properties: {
    name: {
      type: 'string',
      description:
        'Clean ingredient name only. Never include allergies/excluded foods or parenthetical restriction text.'
    },
    quantity: { type: 'number', minimum: 0.01, maximum: 10000 },
    unit: { type: 'string', enum: ['g', 'ml', 'piece', 'tbsp', 'tsp', 'cup', 'serving'] },
    caloriesKcal: { type: 'integer', minimum: 0, maximum: 10000 },
    proteinGrams: { type: 'number', minimum: 0, maximum: 1000 },
    carbsGrams: { type: 'number', minimum: 0, maximum: 1500 },
    fatGrams: { type: 'number', minimum: 0, maximum: 1000 },
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
    'caloriesKcal',
    'proteinGrams',
    'carbsGrams',
    'fatGrams',
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
    ...nutritionTotalsSchema.properties,
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
  required: ['totals', 'meals'],
  properties: {
    totals: nutritionTotalsSchema,
    meals: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: mealSchema
    }
  }
} as const;
