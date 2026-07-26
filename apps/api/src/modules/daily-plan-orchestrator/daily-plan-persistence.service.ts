import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiOperationFeature,
  AiOperationProvider,
  AiOperationStatus,
  DailyReadinessLevel,
  PlanStatus,
  Prisma
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AiOperationLogsService } from '../ai-operation-logs/ai-operation-logs.service';
import { OpenAiProviderError } from '../ai/open-ai-provider.error';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import { SafetyAgentError } from '../safety-agent/safety-agent.error';
import type {
  DailyPlanOperationContext,
  PersistGeneratedDailyPlanInput,
  RecordDailyPlanGenerationErrorInput,
  RecordDailyPlanGenerationInput
} from './daily-plan-persistence.interface';
import type { DailyPlanSafetyResult } from './daily-plan-safety-orchestrator.interface';

@Injectable()
export class DailyPlanPersistenceService {
  private readonly logger = new Logger(DailyPlanPersistenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiOperationLogs: AiOperationLogsService
  ) {}

  resolvePlanStatus(result: DailyPlanSafetyResult) {
    // A complete deterministic replacement remains usable while its provenance
    // is retained in debug metadata and operational logs.
    return result.planJson.debug?.generation?.isComplete
      ? PlanStatus.READY
      : result.status;
  }

  async persistGeneratedPlan(input: PersistGeneratedDailyPlanInput) {
    const status = this.resolvePlanStatus(input.result);
    const planJson = input.result.planJson as Prisma.JsonObject;
    const plan = input.existingPlanId
      ? await this.prisma.dailyPlan.update({
          where: { id: input.existingPlanId },
          data: {
            status,
            readinessLevel: DailyReadinessLevel.MAINTAIN,
            planJson,
            createdByAi: false
          }
        })
      : await this.prisma.dailyPlan.create({
          data: {
            userId: input.userId,
            planLocalDate: input.planLocalDate,
            planTimezone: input.planTimezone,
            status,
            readinessLevel: DailyReadinessLevel.MAINTAIN,
            planJson,
            createdByAi: false
          }
        });

    await this.recordGeneration({
      userId: input.userId,
      status,
      planJson: input.result.planJson,
      latencyMs: Date.now() - input.operationStartedAt,
      operation: input.operation
    });

    return { plan, status };
  }

  async recordGeneration(input: RecordDailyPlanGenerationInput) {
    const adjustedSections =
      input.planJson.debug?.generation?.adjustedSections ?? [];
    const fallbackReason =
      this.getFallbackReason(input.planJson) ??
      this.getSectionFallbackReason(input.planJson, adjustedSections);

    await this.recordAiOperationSafely({
      userId: input.userId,
      feature: AiOperationFeature.DAILY_PLAN,
      provider: this.getProvider(input.operation),
      model: this.getModel(input.operation),
      status:
        input.status === PlanStatus.READY && adjustedSections.length === 0
          ? AiOperationStatus.SUCCESS
          : AiOperationStatus.FALLBACK,
      latencyMs: input.latencyMs,
      retryCount: this.getRetryUsed(input.planJson) ? 1 : 0,
      safetyAgentEnabled: input.operation.safetyAgentEnabled,
      safetyAgentProvider: input.operation.safetyAgentProvider,
      safetyAgentApproved: this.getSafetyAgentApproved(input.planJson),
      fallbackReason,
      errorReason: null
    });
  }

  async recordGenerationError(input: RecordDailyPlanGenerationErrorInput) {
    await this.recordAiOperationSafely({
      userId: input.userId,
      feature: AiOperationFeature.DAILY_PLAN,
      provider: this.getProvider(input.operation),
      model: this.getModel(input.operation),
      status: AiOperationStatus.ERROR,
      latencyMs: input.latencyMs,
      retryCount: 0,
      safetyAgentEnabled: input.operation.safetyAgentEnabled,
      safetyAgentProvider: input.operation.safetyAgentProvider,
      safetyAgentApproved: null,
      fallbackReason: null,
      errorReason: this.getSafeErrorReason(input.error)
    });
  }

  private async recordAiOperationSafely(
    input: Parameters<AiOperationLogsService['record']>[0]
  ) {
    try {
      await this.aiOperationLogs.record(input);
    } catch {
      this.logger.warn(
        'AI operation log write failed; daily plan generation continued.'
      );
    }
  }

  private getProvider(operation: DailyPlanOperationContext) {
    return operation.provider === 'openai'
      ? AiOperationProvider.OPENAI
      : AiOperationProvider.MOCK;
  }

  private getModel(operation: DailyPlanOperationContext) {
    return operation.provider === 'openai'
      ? this.configService.get<string>('OPENAI_DEFAULT_MODEL') ?? null
      : null;
  }

  private getFallbackReason(planJson: DailyPlanJson) {
    const fallbackReason = planJson.debug?.fallbackReason;
    return typeof fallbackReason === 'string' ? fallbackReason : undefined;
  }

  private getSafetyAgentApproved(planJson: DailyPlanJson) {
    const approved = planJson.debug?.safetyAgent?.approved;
    return typeof approved === 'boolean' ? approved : null;
  }

  private getRetryUsed(planJson: DailyPlanJson) {
    return (
      planJson.debug?.safetyAgent?.retryUsed === true ||
      planJson.debug?.exerciseSelection?.usedAiRetry === true
    );
  }

  private getSectionFallbackReason(
    planJson: DailyPlanJson,
    adjustedSections: Array<'CORE' | 'NUTRITION' | 'TRAINING' | 'RECOVERY'>
  ) {
    const foodPlanReason =
      planJson.nutrition.foodPlan?.validation.status === 'FALLBACK'
        ? planJson.nutrition.foodPlan.validation.reasons[0]
        : null;
    if (foodPlanReason) return foodPlanReason;
    if (adjustedSections.includes('TRAINING')) {
      return 'deterministic_training_section_adjustment';
    }
    if (adjustedSections.length > 0) {
      return 'deterministic_section_adjustment';
    }
    return null;
  }

  private getSafeErrorReason(error: unknown) {
    if (error instanceof OpenAiProviderError) {
      return error.fallbackReason;
    }

    if (error instanceof SafetyAgentError) {
      return error.fallbackReason;
    }

    return 'daily_plan_generation_error';
  }
}
