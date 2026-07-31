import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionPlan } from '@prisma/client';

import { AiModelRoutingModule } from '../ai-model-routing/ai-model-routing.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { AiCostControlService } from './ai-cost-control.service';
import { AiBenchmarkBudgetService } from './ai-benchmark-budget.service';
import {
  AI_COST_CONTROL_CONFIG,
  type AiCostControlConfig
} from './ai-cost-control.token';
import { AiOperationLogsService } from './ai-operation-logs.service';
import { AiRequestTelemetryService } from './ai-request-telemetry.service';

@Module({
  imports: [AiModelRoutingModule, EntitlementsModule],
  providers: [
    {
      provide: AI_COST_CONTROL_CONFIG,
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService
      ): AiCostControlConfig => {
        const enforcementRequested =
          configService
            .get<string>(
              'AI_COST_CEILING_ENFORCEMENT_ENABLED',
              'false'
            )
            .toLowerCase() === 'true';
        const enforcementEnabled =
          enforcementRequested &&
          configService
            .get<string>('AI_PROVIDER', 'mock')
            .toLowerCase() === 'openai';
        const monthlyCeilingMicrousd = {
          [SubscriptionPlan.FREE]: readUsdAsMicrousd(
            configService,
            'AI_MONTHLY_COST_CEILING_FREE_USD',
            enforcementEnabled
          ),
          [SubscriptionPlan.PLUS]: readUsdAsMicrousd(
            configService,
            'AI_MONTHLY_COST_CEILING_PLUS_USD',
            enforcementEnabled
          ),
          [SubscriptionPlan.PRO]: readUsdAsMicrousd(
            configService,
            'AI_MONTHLY_COST_CEILING_PRO_USD',
            enforcementEnabled
          )
        };

        if (enforcementEnabled) {
          [
            'OPENAI_LUNA_INPUT_COST_PER_1M_USD',
            'OPENAI_LUNA_OUTPUT_COST_PER_1M_USD',
            'OPENAI_TERRA_INPUT_COST_PER_1M_USD',
            'OPENAI_TERRA_OUTPUT_COST_PER_1M_USD',
            'OPENAI_SOL_INPUT_COST_PER_1M_USD',
            'OPENAI_SOL_OUTPUT_COST_PER_1M_USD'
          ].forEach((key) =>
            readPositiveNumber(configService, key, true)
          );
        }

        return {
          enforcementEnabled,
          monthlyCeilingMicrousd
        };
      }
    },
    AiBenchmarkBudgetService,
    AiCostControlService,
    AiOperationLogsService,
    AiRequestTelemetryService
  ],
  exports: [
    AiBenchmarkBudgetService,
    AiCostControlService,
    AiOperationLogsService,
    AiRequestTelemetryService
  ]
})
export class AiOperationLogsModule {}

function readUsdAsMicrousd(
  configService: ConfigService,
  key: string,
  required: boolean
) {
  return Math.round(
    readPositiveNumber(configService, key, required) * 1_000_000
  );
}

function readPositiveNumber(
  configService: ConfigService,
  key: string,
  required: boolean
) {
  const raw = configService.get<string>(key)?.trim();

  if (!raw && !required) return 0;

  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value <= 0) {
    throw new Error(
      `${key} must be a positive number when AI cost ceiling enforcement is enabled.`
    );
  }

  return value;
}
