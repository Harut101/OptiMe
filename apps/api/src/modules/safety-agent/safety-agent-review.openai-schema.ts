export const safetyAgentReviewOpenAiSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['approved', 'riskLevel', 'reasons', 'requiredChanges', 'safeUserMessage'],
  properties: {
    approved: { type: 'boolean' },
    riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
    reasons: {
      type: 'array',
      items: { type: 'string' },
      description: 'Specific semantic safety reasons. Empty only when approved=true.'
    },
    requiredChanges: {
      type: 'array',
      items: { type: 'string' },
      description: 'Specific changes needed to make the plan safe enough for a future retry.'
    },
    safeUserMessage: {
      type: 'string',
      description: 'Supportive non-shaming user-safe message. Use an empty string if not needed.'
    }
  }
} as const;
