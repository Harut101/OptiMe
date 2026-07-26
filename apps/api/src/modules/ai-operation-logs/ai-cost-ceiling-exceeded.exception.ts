import { HttpException, HttpStatus } from '@nestjs/common';
import type { SubscriptionPlan } from '@prisma/client';

export interface AiCostCeilingExceededResponse {
  code: 'AI_CAPACITY_LIMIT_REACHED';
  currentPlan: SubscriptionPlan;
  resetAt: string;
  upgradeSuggestion: 'PLUS' | 'PRO' | null;
}

export class AiCostCeilingExceededException extends HttpException {
  constructor(response: AiCostCeilingExceededResponse) {
    super(response, HttpStatus.TOO_MANY_REQUESTS);
  }
}
