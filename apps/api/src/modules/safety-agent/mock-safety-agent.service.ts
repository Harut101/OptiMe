import { Injectable } from '@nestjs/common';

import { SafetyAgent, ReviewDailyPlanInput } from './safety-agent.interface';
import { SafetyAgentReview } from './safety-agent-review.schema';

@Injectable()
export class MockSafetyAgentService implements SafetyAgent {
  async reviewDailyPlan(_input: ReviewDailyPlanInput): Promise<SafetyAgentReview> {
    return {
      approved: true,
      riskLevel: 'low',
      reasons: [],
      requiredChanges: []
    };
  }
}
