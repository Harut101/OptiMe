import { Module } from '@nestjs/common';

import { AiOperationLogsModule } from '../ai-operation-logs/ai-operation-logs.module';
import { AiModule } from '../ai/ai.module';
import { DailyPlanCheckInsModule } from '../daily-plan-check-ins/daily-plan-check-ins.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { SafetyAgentModule } from '../safety-agent/safety-agent.module';
import { SafetyModule } from '../safety/safety.module';
import { UsageModule } from '../usage/usage.module';
import { DailyPlansController } from './daily-plans.controller';
import { DailyPlansService } from './daily-plans.service';

@Module({
  imports: [
    AiOperationLogsModule,
    AiModule,
    DailyPlanCheckInsModule,
    EntitlementsModule,
    OnboardingModule,
    SafetyModule,
    SafetyAgentModule,
    UsageModule
  ],
  controllers: [DailyPlansController],
  providers: [DailyPlansService],
  exports: [DailyPlansService]
})
export class DailyPlansModule {}
