import type {
  PlanFeedbackRating,
  PlanFeedbackTag
} from '@prisma/client';

export interface GetDailyPlanHistoryInput {
  userId: string;
  limit?: string;
}

export interface SubmitDailyPlanFeedbackInput {
  userId: string;
  dailyPlanId: string;
  rating?: PlanFeedbackRating;
  tags?: PlanFeedbackTag[];
  notes?: string;
}
