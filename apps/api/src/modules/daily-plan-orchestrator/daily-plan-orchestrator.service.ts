import { Injectable, Logger } from '@nestjs/common';

import { RecoveryPlanAgentService } from '../recovery-plan-agent/recovery-plan-agent.service';
import type { FinalizeRecoveryPlanInput } from '../recovery-plan-agent/recovery-plan-agent.interface';
import { TrainingPlanAgentService } from '../training-plan-agent/training-plan-agent.service';
import type {
  AssembleDailyPlanInput,
  AssembledDailyPlan,
  DailyPlanOrchestrator
} from './daily-plan-orchestrator.interface';
import type {
  PersistGeneratedDailyPlanInput,
  RecordDailyPlanGenerationErrorInput,
  RecordDailyPlanGenerationInput
} from './daily-plan-persistence.interface';
import { DailyPlanPersistenceService } from './daily-plan-persistence.service';
import type {
  CreateSafetyFallbackInput,
  ValidateDailyPlanSafetyInput
} from './daily-plan-safety-orchestrator.interface';
import { DailyPlanSafetyOrchestratorService } from './daily-plan-safety-orchestrator.service';

@Injectable()
export class DailyPlanOrchestratorService implements DailyPlanOrchestrator {
  private readonly logger = new Logger(DailyPlanOrchestratorService.name);

  constructor(
    private readonly trainingPlanAgent: TrainingPlanAgentService,
    private readonly recoveryPlanAgent: RecoveryPlanAgentService,
    private readonly safetyOrchestrator: DailyPlanSafetyOrchestratorService,
    private readonly persistence: DailyPlanPersistenceService
  ) {}

  finalizeRecoveryContext(input: FinalizeRecoveryPlanInput) {
    return this.recoveryPlanAgent.finalizeGeneratedPlan(input);
  }

  validateBeforePersistence(input: ValidateDailyPlanSafetyInput) {
    return this.safetyOrchestrator.validate(input);
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
