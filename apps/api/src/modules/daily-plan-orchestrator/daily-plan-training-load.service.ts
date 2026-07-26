import { Injectable, Logger } from '@nestjs/common';
import {
  UsageFeature
} from '@prisma/client';

import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import { FeatureAccessService } from '../entitlements/feature-access.service';
import {
  TrainingLoadAgentService,
  type GenerateTrainingLoadAgentInput
} from '../training-load-agent/training-load-agent.service';
import { UsageGuardService } from '../usage/usage-guard.service';
import type { ApplyDailyPlanTrainingLoadInput } from './daily-plan-training-load.interface';

@Injectable()
export class DailyPlanTrainingLoadService {
  private readonly logger = new Logger(DailyPlanTrainingLoadService.name);

  constructor(
    private readonly featureAccessService: FeatureAccessService,
    private readonly trainingLoadAgent: TrainingLoadAgentService,
    private readonly usageGuardService: UsageGuardService
  ) {}

  async apply(
    input: ApplyDailyPlanTrainingLoadInput
  ): Promise<DailyPlanJson> {
    const agentInput = this.buildAgentInput(input);
    const canUseAiTrainingLoadAgent =
      input.provider === 'openai' &&
      (await this.featureAccessService.canUseAiTrainingLoadAgent(
        input.user.id
      ));

    if (!canUseAiTrainingLoadAgent) {
      return this.withSnapshot(
        input.planJson,
        this.trainingLoadAgent.createFallback(agentInput, [
          'tier_basic_guidance'
        ])
      );
    }

    let consumedUsage: { id: string; amount: number } | null = null;
    try {
      const usage = await this.usageGuardService.checkAndConsumeConfigured(
        input.user.id,
        UsageFeature.AI_TRAINING_LOAD_AGENT
      );
      consumedUsage = { id: usage.id, amount: 1 };
    } catch (error) {
      this.logger.warn(
        `AI TrainingLoadAgent gated; using deterministic fallback; reason=${error instanceof Error ? error.name : 'unknown'}`
      );
      return this.withSnapshot(
        input.planJson,
        this.trainingLoadAgent.createFallback(agentInput, [
          'ai_training_load_agent_limit_reached'
        ])
      );
    }

    const snapshot = await this.trainingLoadAgent.generate(agentInput);
    if (
      consumedUsage &&
      snapshot.source === 'DETERMINISTIC_FALLBACK' &&
      snapshot.validation.reasons.includes(
        'training_load_agent_request_failed'
      )
    ) {
      await this.refundUsage(consumedUsage);
    }

    return this.withSnapshot(input.planJson, snapshot);
  }

  private buildAgentInput(
    input: ApplyDailyPlanTrainingLoadInput
  ): GenerateTrainingLoadAgentInput {
    return {
      userId: input.user.id,
      planLocalDate: input.planLocalDate,
      locale: input.locale,
      appMode: input.appMode,
      safeMode: input.user.safeMode,
      isMinor: input.user.isMinor,
      planQualityMode: input.planQualityMode,
      trainingLevel:
        input.user.trainingPreference?.trainingLevel ?? null,
      resolvedTrainingDay: input.resolvedTrainingDay,
      personalizationContext: input.personalizationContext,
      exerciseSelection: input.exerciseSelection,
      planTraining: input.planJson.training
    };
  }

  private withSnapshot(
    planJson: DailyPlanJson,
    trainingLoadAgentSnapshot: DailyPlanJson['trainingLoadAgentSnapshot']
  ): DailyPlanJson {
    return {
      ...planJson,
      trainingLoadAgentSnapshot
    };
  }

  private async refundUsage(usage: { id: string; amount: number }) {
    try {
      await this.usageGuardService.refundById(
        usage.id,
        usage.amount
      );
    } catch (error) {
      this.logger.warn(
        `usage refund failed; usageLedgerId=${usage.id}; reason=${error instanceof Error ? error.name : 'unknown'}`
      );
    }
  }
}
