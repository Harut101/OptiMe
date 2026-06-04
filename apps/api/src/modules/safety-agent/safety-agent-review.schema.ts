import { z } from 'zod';

const nonSupportiveLanguagePattern =
  /\b(shame|lazy|failure|bad body|punish|guilt|disgusting|weak)\b/i;

export const safetyAgentReviewSchema = z
  .object({
    approved: z.boolean(),
    riskLevel: z.enum(['low', 'medium', 'high']),
    reasons: z.array(z.string()),
    requiredChanges: z.array(z.string()),
    safeUserMessage: z
      .string()
      .optional()
      .refine((message) => !message || !nonSupportiveLanguagePattern.test(message), {
        message: 'safeUserMessage must use supportive, non-shaming language.'
      })
  })
  .superRefine((review, ctx) => {
    if (review.approved && review.riskLevel !== 'low') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['riskLevel'],
        message: 'approved=true requires riskLevel=low.'
      });
    }

    if (!review.approved && review.reasons.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reasons'],
        message: 'approved=false requires at least one reason.'
      });
    }
  });

export type SafetyAgentReview = z.infer<typeof safetyAgentReviewSchema>;
