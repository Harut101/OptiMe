import { Injectable, Logger } from '@nestjs/common';
import {
  PlanStatus,
  type GoalImpactMode,
  type PlanQualityMode
} from '@prisma/client';
import type {
  ResolvedTrainingDayContext,
  SupportedLocale
} from '@optime/shared-types';

import type { GenerateDailyPlanPersonalizationContext } from '../ai/ai-provider.interface';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import { RecoveryPlanAgentService } from '../recovery-plan-agent/recovery-plan-agent.service';
import type { FinalizeRecoveryPlanInput } from '../recovery-plan-agent/recovery-plan-agent.interface';
import { TrainingPlanAgentService } from '../training-plan-agent/training-plan-agent.service';
import type {
  GenerateDailyFoodPlanInput,
  GenerateProviderDailyPlanInput
} from './daily-plan-agent-execution.interface';
import { DailyPlanAgentExecutionService } from './daily-plan-agent-execution.service';
import type {
  FinalizeDailyPlanGenerationInput,
  FinalizedDailyPlanGeneration,
  PrepareProviderPlanDocumentInput
} from './daily-plan-finalization.interface';
import { DailyPlanFinalizationService } from './daily-plan-finalization.service';
import type {
  AssembleDailyPlanInput,
  AssembledDailyPlan,
  DailyPlanGenerationWorkflowResult,
  DailyPlanOrchestrator,
  ExecuteDailyPlanGenerationWorkflowInput
} from './daily-plan-orchestrator.interface';
import type { PrepareDailyPlanGenerationContextInput } from './daily-plan-generation-context.interface';
import { DailyPlanGenerationContextService } from './daily-plan-generation-context.service';
import type { DailyPlanPlanningUser } from './daily-plan-planning-user';
import type {
  PersistGeneratedDailyPlanInput,
  RecordDailyPlanGenerationErrorInput,
  RecordDailyPlanGenerationInput
} from './daily-plan-persistence.interface';
import { DailyPlanPersistenceService } from './daily-plan-persistence.service';
import type {
  CreateSafetyFallbackInput,
  ValidateGeneratedDailyPlanInput,
  ValidateDailyPlanSafetyInput
} from './daily-plan-safety-orchestrator.interface';
import { DailyPlanSafetyOrchestratorService } from './daily-plan-safety-orchestrator.service';
import type { ApplyDailyPlanTrainingLoadInput } from './daily-plan-training-load.interface';
import { DailyPlanTrainingLoadService } from './daily-plan-training-load.service';

@Injectable()
export class DailyPlanOrchestratorService implements DailyPlanOrchestrator {
  private readonly logger = new Logger(DailyPlanOrchestratorService.name);

  constructor(
    private readonly trainingPlanAgent: TrainingPlanAgentService,
    private readonly recoveryPlanAgent: RecoveryPlanAgentService,
    private readonly safetyOrchestrator: DailyPlanSafetyOrchestratorService,
    private readonly persistence: DailyPlanPersistenceService,
    private readonly generationContext: DailyPlanGenerationContextService,
    private readonly finalization: DailyPlanFinalizationService,
    private readonly trainingLoad: DailyPlanTrainingLoadService,
    private readonly agentExecution: DailyPlanAgentExecutionService
  ) {}

  getProviderName() {
    return this.agentExecution.getProviderName();
  }

  generateProviderPlan(input: GenerateProviderDailyPlanInput) {
    return this.agentExecution.generateProviderPlan(input);
  }

  generateFoodPlan(input: GenerateDailyFoodPlanInput) {
    return this.agentExecution.generateFoodPlan(input);
  }

  prepareGenerationContext(input: PrepareDailyPlanGenerationContextInput) {
    return this.generationContext.prepare(input);
  }

  resolveAppMode(user: DailyPlanPlanningUser) {
    return this.generationContext.resolveAppMode(user);
  }

  preparePersonalizationContext(input: {
    user: DailyPlanPlanningUser;
    planQualityMode: PlanQualityMode;
    planLocalDate: string;
    resolvedTrainingDay: ResolvedTrainingDayContext;
    appMode: GoalImpactMode;
  }) {
    return this.generationContext.preparePersonalizationContext(
      input.user,
      input.planQualityMode,
      input.planLocalDate,
      input.resolvedTrainingDay,
      input.appMode
    );
  }

  buildExerciseSelectionContext(input: {
    user: DailyPlanPlanningUser;
    locale: SupportedLocale;
    planLocalDate: string;
    planQualityMode: PlanQualityMode;
    personalizationContext: GenerateDailyPlanPersonalizationContext;
    resolvedTrainingDay: ResolvedTrainingDayContext;
  }) {
    return this.generationContext.buildExerciseSelectionContext(
      input.user,
      input.locale,
      input.planLocalDate,
      input.planQualityMode,
      input.personalizationContext,
      input.resolvedTrainingDay
    );
  }

  prepareProviderPlanDocument(input: PrepareProviderPlanDocumentInput) {
    return this.finalization.prepareProviderPlanDocument(input);
  }

  attachFoodPlan(
    planJson: DailyPlanJson,
    foodPlan: DailyPlanJson['nutrition']['foodPlan']
  ) {
    return this.finalization.attachFoodPlan(planJson, foodPlan);
  }

  async finalizeGenerationResult(
    input: FinalizeDailyPlanGenerationInput
  ): Promise<FinalizedDailyPlanGeneration> {
    const finalized = await this.finalization.finalize(input);
    return {
      ...finalized,
      status: this.persistence.resolvePlanStatus(
        finalized.safePlanResult
      )
    };
  }

  applyTrainingLoad(input: ApplyDailyPlanTrainingLoadInput) {
    return this.trainingLoad.apply(input);
  }

  finalizeRecoveryContext(input: FinalizeRecoveryPlanInput) {
    return this.recoveryPlanAgent.finalizeGeneratedPlan(input);
  }

  validateBeforePersistence(input: ValidateDailyPlanSafetyInput) {
    return this.safetyOrchestrator.validate(input);
  }

  validateGeneratedPlan(input: ValidateGeneratedDailyPlanInput) {
    return this.safetyOrchestrator.validateGeneratedPlan(input);
  }

  canUseSafetyRetry(providerStatus: PlanStatus) {
    return this.safetyOrchestrator.canUseSafetyRetry(
      providerStatus,
      this.getProviderName()
    );
  }

  getProviderFallbackReason(planJson: unknown) {
    return this.safetyOrchestrator.getFallbackReason(planJson);
  }

  getSafetyOperationContext() {
    return this.safetyOrchestrator.getOperationContext();
  }

  getOperationContext() {
    return {
      provider: this.getProviderName(),
      ...this.getSafetyOperationContext()
    };
  }

  createSafetyFallback(input: CreateSafetyFallbackInput) {
    return this.safetyOrchestrator.createSafetyFallback(input);
  }

  resolvePersistenceStatus(result: Parameters<DailyPlanPersistenceService['resolvePlanStatus']>[0]) {
    return this.persistence.resolvePlanStatus(result);
  }

  persistGeneratedPlan(input: PersistGeneratedDailyPlanInput) {
    return this.persistence.persistGeneratedPlan(input);
  }

  recordGeneration(input: RecordDailyPlanGenerationInput) {
    return this.persistence.recordGeneration(input);
  }

  recordGenerationError(input: RecordDailyPlanGenerationErrorInput) {
    return this.persistence.recordGenerationError(input);
  }

  async executeGenerationWorkflow(
    input: ExecuteDailyPlanGenerationWorkflowInput
  ): Promise<DailyPlanGenerationWorkflowResult> {
    const [providerPlanResult, foodPlan] = await Promise.all([
      input.generateProviderPlan(),
      input.generateFoodPlan()
    ]);
    const initialAssembly = await this.assembleBeforeSafety(
      input.buildAssemblyInput({
        providerPlanResult,
        foodPlan,
        isSafetyRetry: false
      })
    );
    const initialTrainingPreparation = initialAssembly.trainingPreparation;
    const initialSafetyResult = await input.validateAttempt({
      providerPlanResult: initialAssembly.providerPlanResult,
      allowSafetyRetry: input.canUseSafetyRetry(
        initialAssembly.providerPlanResult.status
      ),
      safetyRetryUsed: false
    });

    if (!initialSafetyResult.safetyRetryRequest) {
      this.logger.log('safety retry triggered=false');
      return {
        safePlanResult: initialSafetyResult,
        finalFoodPlan: foodPlan,
        trainingPreparation: initialTrainingPreparation
      };
    }

    this.logger.log(
      `safety retry triggered=true; reasonCount=${initialSafetyResult.safetyRetryRequest.reasons.length}`
    );
    this.logger.log('safety retry generation started');

    const safetyFeedback = initialSafetyResult.safetyRetryRequest;
    const affectedSections = safetyFeedback.affectedSections ?? [];
    const useConservativeFullRetry = affectedSections.length === 0;
    const retryNutrition =
      useConservativeFullRetry ||
      affectedSections.includes('nutrition');
    const retryProvider =
      useConservativeFullRetry ||
      affectedSections.some((section) => section !== 'nutrition');
    this.logger.log(
      [
        'safety retry request budget',
        `affectedSections=${affectedSections.join(',') || 'unknown'}`,
        `providerRetry=${retryProvider}`,
        `nutritionRetry=${retryNutrition}`
      ].join('; ')
    );

    const [retryProviderPlanResult, retryFoodPlan] = await Promise.all([
      retryProvider
        ? input.generateProviderPlan({ safetyFeedback })
        : Promise.resolve(initialAssembly.providerPlanResult),
      retryNutrition
        ? input.generateFoodPlan({ safetyFeedback })
        : Promise.resolve(foodPlan)
    ]);
    const retryAssemblyInput = input.buildAssemblyInput({
      providerPlanResult: retryProviderPlanResult,
      foodPlan: retryFoodPlan,
      isSafetyRetry: true
    });
    const retryAssembly = retryProvider
      ? await this.assembleBeforeSafety(retryAssemblyInput)
      : this.replaceFoodPlanWithoutRebuildingTraining(
          initialAssembly,
          retryAssemblyInput,
          retryFoodPlan
        );
    const retryTrainingPreparation = retryAssembly.trainingPreparation;
    const trainingPreparation = {
      ...retryTrainingPreparation,
      usedAiRetry:
        initialTrainingPreparation.usedAiRetry ||
        retryTrainingPreparation.usedAiRetry,
      usedDeterministicFallback:
        initialTrainingPreparation.usedDeterministicFallback ||
        retryTrainingPreparation.usedDeterministicFallback
    };
    let safePlanResult = await input.validateAttempt({
      providerPlanResult: retryAssembly.providerPlanResult,
      allowSafetyRetry: false,
      safetyRetryUsed: true
    });

    if (retryTrainingPreparation.status === PlanStatus.FALLBACK) {
      const retryFallbackReason =
        input.getProviderFallbackReason(retryProviderPlanResult) ===
        'schema_validation_failed'
          ? 'safety_agent_retry_invalid_output'
          : 'safety_agent_retry_failed';
      safePlanResult =
        input.createRetryFailureFallback(retryFallbackReason);
    }

    return {
      safePlanResult,
      finalFoodPlan: retryFoodPlan,
      trainingPreparation
    };
  }

  private replaceFoodPlanWithoutRebuildingTraining(
    initialAssembly: AssembledDailyPlan,
    retryAssemblyInput: AssembleDailyPlanInput,
    foodPlan: NonNullable<DailyPlanJson['nutrition']['foodPlan']>
  ): AssembledDailyPlan {
    const planJson = retryAssemblyInput.attachFoodPlan(
      initialAssembly.providerPlanResult.planJson,
      foodPlan
    );
    this.logger.log(
      'safety retry reused provider and training output; nutritionRetry=true'
    );

    return {
      providerPlanResult: {
        ...initialAssembly.providerPlanResult,
        planJson
      },
      trainingPreparation: {
        ...initialAssembly.trainingPreparation,
        planJson
      }
    };
  }

  async assembleBeforeSafety(
    input: AssembleDailyPlanInput
  ): Promise<AssembledDailyPlan> {
    this.logger.log('daily plan orchestration started; stage=before_safety');

    const decoratedPlan = input.decorateProviderPlan(
      input.providerPlanResult.planJson
    );
    const recoveryPreparation = this.finalizeRecoveryContext({
      planJson: decoratedPlan,
      recoveryProtocol: input.recoveryProtocol,
      healthPlanningContext: input.healthPlanningContext,
      trainingEnabled: input.trainingEnabled,
      isTrainingDay: input.isTrainingDay
    });
    const providerPlanResult = {
      ...input.providerPlanResult,
      planJson: input.attachFoodPlan(
        recoveryPreparation.planJson,
        input.foodPlan
      )
    };
    const trainingPreparation = await this.trainingPlanAgent.finalizeGeneratedPlan({
      providerPlanResult,
      exerciseSelection: input.exerciseSelection,
      retry: input.retryTrainingPlan
    });
    const assembledPlan = input.attachFoodPlan(
      trainingPreparation.planJson,
      input.foodPlan
    );
    const withTrainingLoad = await input.applyTrainingLoad(assembledPlan);

    this.logger.log(
      [
        'daily plan orchestration completed',
        'stage=before_safety',
        `recoveryMode=${recoveryPreparation.mode}`,
        `trainingRetryUsed=${trainingPreparation.usedAiRetry}`,
        `trainingFallbackUsed=${trainingPreparation.usedDeterministicFallback}`
      ].join('; ')
    );

    return {
      providerPlanResult: {
        status: trainingPreparation.status,
        planJson: withTrainingLoad
      },
      trainingPreparation: {
        ...trainingPreparation,
        planJson: withTrainingLoad
      }
    };
  }
}
