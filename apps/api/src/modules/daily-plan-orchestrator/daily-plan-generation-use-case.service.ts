import {
  BadRequestException,
  Injectable,
  Logger
} from '@nestjs/common';
import {
  type DailyPlan,
  PlanStatus,
  UsageFeature
} from '@prisma/client';

import { AiCostControlService } from '../ai-operation-logs/ai-cost-control.service';
import { dailyPlanJsonSchema } from '../daily-plans/daily-plan-json.schema';
import { OnboardingService } from '../onboarding/onboarding.service';
import { UsageGuardService } from '../usage/usage-guard.service';
import type { GenerateDailyPlanUseCaseInput } from './daily-plan-generation-use-case.interface';
import { DailyPlanOrchestratorService } from './daily-plan-orchestrator.service';

@Injectable()
export class DailyPlanGenerationUseCaseService {
  private readonly logger = new Logger(
    DailyPlanGenerationUseCaseService.name
  );

  constructor(
    private readonly orchestrator: DailyPlanOrchestratorService,
    private readonly usageGuardService: UsageGuardService,
    private readonly onboardingService: OnboardingService,
    private readonly aiCostControlService: AiCostControlService
  ) {}

  async generate(
    input: GenerateDailyPlanUseCaseInput
  ): Promise<DailyPlan> {
    const existingResult = this.resolveExistingPlan(input);

    if (existingResult) {
      return existingResult;
    }

    this.assertReadyToGenerate(input);

    const operationStartedAt = Date.now();
    const consumedUsage: Array<{ id: string; amount: number }> = [];

    try {
      if (this.orchestrator.getProviderName() === 'openai') {
        await this.aiCostControlService.assertCanStartAiOperation(
          input.userId
        );
      }

      if (!input.recreateForCurrentLanguage) {
        consumedUsage.push(
          ...(await this.consumeUsage(
            input.userId,
            Boolean(input.existingPlan && input.forceRegenerate)
          ))
        );
      } else {
        this.logger.log(
          `daily plan language recreation started; targetLocale=${input.locale}`
        );
      }

      this.logger.log(
        `daily plan generation started; provider=${this.orchestrator.getProviderName()}`
      );
      const generationContext =
        await this.orchestrator.prepareGenerationContext({
          user: input.user,
          planLocalDate: input.planLocalDate
        });
      const {
        planQualityMode,
        availableFoodSlugs,
        appMode,
        trainingEnabled,
        resolvedTrainingDay,
        nutritionTarget,
        personalizationContext,
        exerciseSelection,
        blockedFoods
      } = generationContext;
      const generationWorkflow =
        await this.orchestrator.executeGenerationWorkflow({
          generateProviderPlan: ({ safetyFeedback } = {}) =>
            this.orchestrator.generateProviderPlan({
              user: input.user,
              locale: input.locale,
              planLocalDate: input.planLocalDate,
              planTimezone: input.planTimezone,
              planQualityMode,
              personalizationContext,
              exerciseSelection,
              safetyFeedback
            }),
          generateFoodPlan: () =>
            this.orchestrator.generateFoodPlan({
              user: input.user,
              planLocalDate: input.planLocalDate,
              locale: input.locale,
              planQualityMode,
              appMode,
              nutritionTarget,
              personalizationContext,
              availableFoodSlugs,
              resolvedTrainingDay
            }),
          buildAssemblyInput: ({
            providerPlanResult,
            foodPlan,
            isSafetyRetry
          }) => ({
            providerPlanResult,
            foodPlan,
            exerciseSelection,
            recoveryProtocol:
              personalizationContext.selectedProtocols
                ?.recoveryProtocol,
            healthPlanningContext:
              personalizationContext.healthPlanningContext,
            trainingEnabled,
            isTrainingDay: resolvedTrainingDay.isTrainingDay,
            decorateProviderPlan: (planJson) =>
              this.orchestrator.prepareProviderPlanDocument({
                planJson,
                resolvedTrainingDay,
                nutritionTarget,
                appMode,
                locale: input.locale
              }),
            attachFoodPlan: (planJson, foodPlanToAttach) =>
              this.orchestrator.attachFoodPlan(
                planJson,
                foodPlanToAttach
              ),
            applyTrainingLoad: (planJson) =>
              this.orchestrator.applyTrainingLoad({
                planJson,
                user: input.user,
                locale: input.locale,
                planLocalDate: input.planLocalDate,
                planQualityMode,
                personalizationContext,
                exerciseSelection,
                resolvedTrainingDay,
                appMode,
                provider: this.orchestrator.getProviderName()
              }),
            retryTrainingPlan:
              !isSafetyRetry &&
              this.orchestrator.getProviderName() === 'openai'
                ? (exerciseFeedback) =>
                    this.orchestrator.generateProviderPlan({
                      user: input.user,
                      locale: input.locale,
                      planLocalDate: input.planLocalDate,
                      planTimezone: input.planTimezone,
                      planQualityMode,
                      personalizationContext,
                      exerciseSelection,
                      exerciseFeedback
                    })
                : undefined
          }),
          validateAttempt: ({
            providerPlanResult,
            allowSafetyRetry,
            safetyRetryUsed
          }) =>
            this.orchestrator.validateGeneratedPlan({
              providerPlan: providerPlanResult.planJson,
              blockedFoods,
              planLocalDate: input.planLocalDate,
              planTimezone: input.planTimezone,
              locale: input.locale,
              planQualityMode,
              user: input.user,
              personalizationContext,
              forcedFallback:
                providerPlanResult.status === PlanStatus.FALLBACK,
              allowSafetyRetry,
              safetyRetryUsed
            }),
          canUseSafetyRetry: (providerStatus) =>
            this.orchestrator.canUseSafetyRetry(providerStatus),
          getProviderFallbackReason: (providerPlanResult) =>
            this.orchestrator.getProviderFallbackReason(
              providerPlanResult.planJson
            ),
          createRetryFailureFallback: (fallbackReason) =>
            this.orchestrator.createSafetyFallback({
              planLocalDate: input.planLocalDate,
              planTimezone: input.planTimezone,
              locale: input.locale,
              fallbackReason,
              retryUsed: true,
              retryResult: 'failed'
            })
        });
      const finalizedGeneration =
        await this.orchestrator.finalizeGenerationResult({
          userId: input.userId,
          planLocalDate: input.planLocalDate,
          existingPlanId: input.existingPlan?.id,
          safePlanResult: generationWorkflow.safePlanResult,
          finalFoodPlan: generationWorkflow.finalFoodPlan,
          trainingPreparation:
            generationWorkflow.trainingPreparation,
          exerciseSelection,
          resolvedTrainingDay,
          nutritionTarget,
          planQualityMode,
          selectedProtocols:
            personalizationContext.selectedProtocols,
          healthPlanningContext:
            personalizationContext.healthPlanningContext,
          trainingEnabled
        });
      const finalizedPlanResult =
        finalizedGeneration.safePlanResult;
      const status = finalizedGeneration.status;

      this.logger.log(
        `daily plan generation completed; safe replacement used: ${finalizedPlanResult.status === PlanStatus.FALLBACK}; persisted status=${status}`
      );

      if (
        input.recreateForCurrentLanguage &&
        input.existingPlan &&
        finalizedPlanResult.status === PlanStatus.FALLBACK
      ) {
        this.logger.warn(
          'daily plan language recreation did not produce a ready plan; existing plan preserved'
        );
        await this.orchestrator.recordGeneration({
          userId: input.userId,
          status,
          planJson: finalizedPlanResult.planJson,
          latencyMs: Date.now() - operationStartedAt,
          operation: this.orchestrator.getOperationContext()
        });
        return input.existingPlan;
      }

      const { plan } =
        await this.orchestrator.persistGeneratedPlan({
          userId: input.userId,
          existingPlanId: input.existingPlan?.id,
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          result: finalizedPlanResult,
          operationStartedAt,
          operation: this.orchestrator.getOperationContext()
        });

      return plan;
    } catch (error) {
      await this.refundUsage(consumedUsage);
      await this.orchestrator.recordGenerationError({
        userId: input.userId,
        latencyMs: Date.now() - operationStartedAt,
        error,
        operation: this.orchestrator.getOperationContext()
      });
      throw error;
    }
  }

  private resolveExistingPlan(
    input: GenerateDailyPlanUseCaseInput
  ) {
    if (
      input.recreateForCurrentLanguage &&
      !input.existingPlan
    ) {
      throw new BadRequestException(
        'A current daily plan is required before it can be recreated in another language.'
      );
    }

    const existingPlanParsed = input.existingPlan
      ? dailyPlanJsonSchema.safeParse(input.existingPlan.planJson)
      : null;
    const existingPlanLocale = existingPlanParsed?.success
      ? existingPlanParsed.data.contentLocale
      : undefined;

    if (
      input.existingPlan &&
      existingPlanLocale === input.locale &&
      input.recreateForCurrentLanguage
    ) {
      return input.existingPlan;
    }

    if (
      input.existingPlan &&
      !input.forceRegenerate &&
      !input.recreateForCurrentLanguage
    ) {
      return input.existingPlan;
    }

    return null;
  }

  private assertReadyToGenerate(
    input: GenerateDailyPlanUseCaseInput
  ) {
    const readiness =
      this.onboardingService.evaluateStage1Readiness(input.user);

    if (!readiness.canGenerateFirstPlan) {
      throw new BadRequestException({
        message:
          'Please complete the required onboarding basics before generating a daily plan.',
        code: 'ONBOARDING_STAGE_1_INCOMPLETE',
        missingStage1Fields: readiness.missingStage1Fields
      });
    }
  }

  private async consumeUsage(userId: string, isRefresh: boolean) {
    const productFeature = isRefresh
      ? UsageFeature.DAILY_PLAN_REFRESH
      : UsageFeature.DAILY_PLAN_GENERATION;
    const usageChecks: UsageFeature[] = [productFeature];

    if (
      !isRefresh &&
      this.orchestrator.getProviderName() === 'openai'
    ) {
      usageChecks.push(
        UsageFeature.AI_DAILY_PLAN_GENERATION
      );
    }

    await Promise.all(
      usageChecks.map((feature) =>
        this.usageGuardService.assertCanUseConfigured(
          userId,
          feature
        )
      )
    );

    const consumed: Array<{ id: string; amount: number }> = [];

    for (const feature of usageChecks) {
      const usage =
        await this.usageGuardService.checkAndConsumeConfigured(
          userId,
          feature
        );
      consumed.push({ id: usage.id, amount: 1 });
    }

    return consumed;
  }

  private async refundUsage(
    consumedUsage: Array<{ id: string; amount: number }>
  ) {
    for (const usage of consumedUsage.reverse()) {
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
}
