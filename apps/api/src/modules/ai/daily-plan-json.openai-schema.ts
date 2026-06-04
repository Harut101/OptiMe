export const dailyPlanJsonOpenAiSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'safety',
    'summary',
    'nutrition',
    'training',
    'recovery',
    'reminders'
  ],
  properties: {
    safety: {
      type: 'object',
      additionalProperties: false,
      required: ['safeMode', 'adjustedForSafety', 'reasons'],
      properties: {
        safeMode: { type: 'boolean' },
        adjustedForSafety: { type: 'boolean' },
        reasons: { type: 'array', items: { type: 'string' } }
      }
    },
    summary: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'message', 'readiness'],
      properties: {
        title: { type: 'string' },
        message: { type: 'string' },
        readiness: { type: 'string', enum: ['PUSH', 'MAINTAIN', 'RECOVER'] }
      }
    },
    nutrition: {
      type: 'object',
      additionalProperties: false,
      required: ['calorieGuidance', 'macroGuidance', 'meals', 'hydration'],
      properties: {
        calorieGuidance: {
          type: 'object',
          additionalProperties: false,
          required: ['label', 'notes'],
          properties: {
            label: { type: 'string' },
            notes: { type: 'string' }
          }
        },
        macroGuidance: {
          type: 'object',
          additionalProperties: false,
          required: ['protein', 'carbs', 'fat', 'notes'],
          properties: {
            protein: { type: 'string' },
            carbs: { type: 'string' },
            fat: { type: 'string' },
            notes: { type: 'string' }
          }
        },
        meals: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'purpose', 'foods'],
            properties: {
              name: { type: 'string' },
              purpose: { type: 'string' },
              foods: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['name', 'portion', 'notes'],
                  properties: {
                    name: {
                      type: 'string',
                      description:
                        'Clean food or dish name only. Do not include allergy/exclusion explanations, parenthetical restrictions, no-avocado/no-pork wording, free-from wording, or without wording.'
                    },
                    portion: { type: 'string' },
                    notes: {
                      type: 'string',
                      description:
                        'Preparation or practical note. If mentioning avoided allergies/excluded foods, use safe avoidance language such as Prepared without avocado.'
                    }
                  }
                }
              }
            }
          }
        },
        hydration: {
          type: 'object',
          additionalProperties: false,
          required: ['guidance', 'notes'],
          properties: {
            guidance: { type: 'string' },
            notes: { type: 'string' }
          }
        }
      }
    },
    training: {
      type: 'object',
      additionalProperties: false,
      required: ['recommendation', 'intensity', 'notes'],
      properties: {
        recommendation: { type: 'string' },
        intensity: { type: 'string', enum: ['REST', 'LIGHT', 'MODERATE', 'HARD'] },
        notes: { type: 'string' }
      }
    },
    recovery: {
      type: 'object',
      additionalProperties: false,
      required: ['recommendation', 'sleepTip', 'mobilityTip'],
      properties: {
        recommendation: { type: 'string' },
        sleepTip: { type: 'string' },
        mobilityTip: { type: 'string' }
      }
    },
    reminders: { type: 'array', items: { type: 'string' } }
  }
} as const;
