export const trainingLoadAgentOpenAiSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'readiness',
    'adjustments',
    'reasonCodes',
    'userFacingSummary',
    'trainingGuidanceBullets',
    'exerciseCautions'
  ],
  properties: {
    readiness: {
      type: 'string',
      enum: ['NORMAL', 'CONTROLLED', 'LIGHT', 'RECOVERY_FOCUSED', 'UNKNOWN']
    },
    adjustments: {
      type: 'object',
      additionalProperties: false,
      required: ['intensity', 'volume', 'restTime'],
      properties: {
        intensity: { type: 'string', enum: ['NORMAL', 'REDUCE', 'UNKNOWN'] },
        volume: { type: 'string', enum: ['NORMAL', 'REDUCE', 'UNKNOWN'] },
        restTime: { type: 'string', enum: ['NORMAL', 'INCREASE', 'UNKNOWN'] }
      }
    },
    reasonCodes: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'NORMAL_ROUTINE',
          'LOW_SLEEP_CONTEXT',
          'HIGH_ACTIVITY_CONTEXT',
          'RECENT_WORKOUT_LOAD',
          'RECOVERY_FOCUSED_CONTEXT',
          'PRE_WORKOUT_TIRED',
          'PRE_WORKOUT_SORE',
          'PRE_WORKOUT_PAIN_OR_LIMITATION',
          'NO_RECENT_WEARABLE_DATA',
          'PARTIAL_WEARABLE_DATA',
          'SAFETY_LIMITED_CONTEXT',
          'BEGINNER_LEVEL',
          'DURATION_VOLUME_LIMIT'
        ]
      }
    },
    userFacingSummary: {
      type: 'string',
      description:
        'One calm, supportive sentence. Do not include raw health values, diagnosis, or pressure language.'
    },
    trainingGuidanceBullets: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'string',
        description:
          'Short practical guidance. Do not tell the user to push through pain or cancel automatically.'
      }
    },
    exerciseCautions: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['exerciseId', 'exerciseSlug', 'planExerciseKey', 'cautionCode', 'message'],
        properties: {
          exerciseId: {
            type: ['string', 'null'],
            description: 'Exact planned/allowed exercise id, or null for session-level caution.'
          },
          exerciseSlug: {
            type: ['string', 'null'],
            description: 'Exact planned/allowed exercise slug, or null for session-level caution.'
          },
          planExerciseKey: {
            type: ['string', 'null'],
            description: 'Exact planned exercise key if available, otherwise null.'
          },
          cautionCode: {
            type: 'string',
            enum: [
              'KEEP_CONTROLLED',
              'TAKE_LONGER_RESTS',
              'STOP_IF_PAIN_INCREASES',
              'USE_STEADY_PACE',
              'REDUCE_RANGE_IF_UNCOMFORTABLE'
            ]
          },
          message: {
            type: 'string',
            description:
              'Supportive caution. Never diagnose or say to push through pain.'
          }
        }
      }
    }
  }
} as const;
