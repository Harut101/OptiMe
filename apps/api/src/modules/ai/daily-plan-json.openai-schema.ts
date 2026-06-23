const foodItemSchema = {
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
} as const;

const mealSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'purpose', 'foods'],
  properties: {
    name: { type: 'string' },
    purpose: { type: 'string' },
    foods: {
      type: 'array',
      items: foodItemSchema
    }
  }
} as const;

const exerciseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'exerciseId',
    'slug',
    'name',
    'targetMuscles',
    'equipment',
    'sets',
    'reps',
    'rest',
    'duration',
    'intensityCue',
    'safetyNotes',
    'notes'
  ],
  properties: {
    exerciseId: { type: 'string', description: 'Exact exerciseId from allowedExerciseCandidates.' },
    slug: { type: 'string', description: 'Exact matching slug from allowedExerciseCandidates.' },
    name: {
      type: 'string',
      description:
        'Clean exercise name only. Do not include pain/injury disclaimers or progression notes in the name.'
    },
    targetMuscles: {
      type: 'array',
      description: 'Up to 5 simple target muscle labels.',
      items: { type: 'string' }
    },
    equipment: {
      type: 'array',
      description: 'Up to 5 simple equipment labels; use bodyweight when no equipment is needed.',
      items: { type: 'string' }
    },
    sets: { type: 'string' },
    reps: { type: 'string' },
    rest: { type: 'string' },
    duration: { type: 'string' },
    intensityCue: {
      type: 'string',
      description:
        'Supportive effort cue. Never say max effort, all-out, to failure, no pain no gain, or push through symptoms.'
    },
    safetyNotes: {
      type: 'string',
      description:
        'Short safety note. Reduce intensity for pain, dizziness, illness, exhaustion, pregnancy/postpartum, under-18 safeMode, or beginner context.'
    },
    notes: { type: 'string', description: 'Concise plan-specific note only; do not alter exercise identity or technique.' }
  }
} as const;

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
      required: ['calorieGuidance', 'macroGuidance', 'meals', 'menuOptions', 'hydration'],
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
          items: mealSchema
        },
        menuOptions: {
          type: 'array',
          description:
            'Menu choices by plan quality. BASIC: exactly 1 option. PERSONALIZED: exactly 2 options. ADAPTIVE: exactly 3 options. The first option should align with the primary meals field.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'focus', 'meals'],
            properties: {
              label: { type: 'string' },
              focus: { type: 'string' },
              meals: {
                type: 'array',
                items: mealSchema
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
      required: ['recommendation', 'intensity', 'notes', 'exercises'],
      properties: {
        recommendation: { type: 'string' },
        intensity: { type: 'string', enum: ['REST', 'LIGHT', 'MODERATE', 'HARD'] },
        notes: { type: 'string' },
        exercises: {
          type: 'array',
          description:
            'Choose only from allowedExerciseCandidates. Use exact exerciseId and slug. Return the requested exercise count, or [] when requestedExerciseCount is zero.',
          items: exerciseSchema
        }
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
