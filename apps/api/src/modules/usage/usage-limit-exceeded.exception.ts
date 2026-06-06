import { HttpException, HttpStatus } from '@nestjs/common';
import { SubscriptionPlan, UsageFeature, UsagePeriodType } from '@prisma/client';

export interface UsageLimitExceededResponse {
  code: 'USAGE_LIMIT_REACHED';
  feature: UsageFeature;
  currentPlan: SubscriptionPlan;
  limit: number;
  periodType: UsagePeriodType;
  resetAt: string;
  upgradeSuggestion: 'PLUS' | 'PRO' | null;
}

export class UsageLimitExceededException extends HttpException {
  constructor(response: UsageLimitExceededResponse) {
    super(response, HttpStatus.TOO_MANY_REQUESTS);
  }
}
