import { Injectable } from '@nestjs/common';

import { createMockDailyPlan } from '../daily-plans/templates/mock-daily-plan.factory';
import { AiProvider, GenerateDailyPlanInput } from './ai-provider.interface';

@Injectable()
export class MockAiProviderService implements AiProvider {
  async generateDailyPlan(input: GenerateDailyPlanInput) {
    return createMockDailyPlan({
      planLocalDate: input.planLocalDate,
      planTimezone: input.planTimezone,
      firstName: input.user.firstName,
      isMinor: input.safeMode
    });
  }
}
