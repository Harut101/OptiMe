import type { PlanQualityMode, PlanStatus } from '@prisma/client';

import type {
  GenerateDailyPlanExerciseFeedback,
  GenerateDailyPlanSafetyFeedback
} from '../ai/ai-provider.interface';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import type { ExerciseSelectionResult } from '../exercise-selection/exercise-selection.types';
import type { HealthPlanningContext } from '../health/health-planning.types';
import type { RecoveryProtocol } from '../protocol/protocol.types';
import type {
  FinalizeRecoveryPlanInput,
  FinalizedRecoveryPlan
} from '../recovery-plan-agent/recovery-plan-agent.interface';
import type {
  FinalizedTrainingPlan,
  TrainingPlanProviderResult
} from '../training-plan-agent/training-plan-agent.interface';
import type {
  CreateSafetyFallbackInput,
  DailyPlanSafetyOperationContext,
  DailyPlanSafetyResult,
  ValidateGeneratedDailyPlanInput,
  ValidateDailyPlanSafetyInput
} from './daily-plan-safety-orchestrator.interface';
import type {
  GenerateDailyFoodPlanInput,
  GenerateProviderDailyPlanInput
} from './daily-plan-agent-execution.interface';
import type {
  FinalizeDailyPlanGenerationInput,
  FinalizedDailyPlanGeneration,
  PrepareProviderPlanDocumentInput
} from './daily-plan-finalization.interface';
import type { ApplyDailyPlanTrainingLoadInput } from './daily-plan-training-load.interface';
import type { DailyPlanOperationContext } from './daily-plan-persistence.interface';

export interface AssembleDailyPlanInput {
  providerPlanResult: TrainingPlanProviderResult;
  foodPlan: NonNullable<DailyPlanJson['nutrition']['foodPlan']>;
  exerciseSelection: ExerciseSelectionResult;
  recoveryProtocol?: RecoveryProtocol;
  healthPlanningContext?: HealthPlanningContext;
  trainingEnabled: boolean;
  isTrainingDay: boolean;
  decorateProviderPlan: (planJson: DailyPlanJson) => DailyPlanJson;
  attachFoodPlan: (
    planJson: DailyPlanJson,
    foodPlan: NonNullable<DailyPlanJson['nutrition']['foodPlan']>
  ) => DailyPlanJson;
  applyTrainingLoad: (planJson: DailyPlanJson) => Promise<DailyPlanJson>;
  retryTrainingPlan?: (
    feedback: GenerateDailyPlanExerciseFeedback
  ) => Promise<TrainingPlanProviderResult>;
}

export interface AssembledDailyPlan {
  providerPlanResult: TrainingPlanProviderResult;
  trainingPreparation: FinalizedTrainingPlan;
}

export interface ExecuteDailyPlanGenerationWorkflowInput {
  generateProviderPlan: (input?: {
    safetyFeedback?: GenerateDailyPlanSafetyFeedback;
  }) => Promise<TrainingPlanProviderResult>;
  generateFoodPlan: (input?: {
    safetyFeedback?: GenerateDailyPlanSafetyFeedback;
  }) => Promise<
    NonNullable<DailyPlanJson['nutrition']['foodPlan']>
  >;
  buildAssemblyInput: (input: {
    providerPlanResult: TrainingPlanProviderResult;
    foodPlan: NonNullable<DailyPlanJson['nutrition']['foodPlan']>;
    isSafetyRetry: boolean;
  }) => AssembleDailyPlanInput;
  validateAttempt: (input: {
    providerPlanResult: TrainingPlanProviderResult;
    allowSafetyRetry: boolean;
    safetyRetryUsed: boolean;
  }) => DailyPlanSafetyResult | Promise<DailyPlanSafetyResult>;
  canUseSafetyRetry: (providerStatus: TrainingPlanProviderResult['status']) => boolean;
  getProviderFallbackReason: (
    providerPlanResult: TrainingPlanProviderResult
  ) => string | undefined;
  createRetryFailureFallback: (
    fallbackReason:
      | 'safety_agent_retry_invalid_output'
      | 'safety_agent_retry_failed'
  ) => DailyPlanSafetyResult;
}

export interface DailyPlanGenerationWorkflowResult {
  safePlanResult: DailyPlanSafetyResult;
  finalFoodPlan: NonNullable<DailyPlanJson['nutrition']['foodPlan']>;
  trainingPreparation: FinalizedTrainingPlan;
}

export interface DailyPlanOrchestrator {
  getProviderName(): 'mock' | 'openai';
  generateProviderPlan(
    input: GenerateProviderDailyPlanInput
  ): Promise<TrainingPlanProviderResult>;
  generateFoodPlan(
    input: GenerateDailyFoodPlanInput
  ): Promise<NonNullable<DailyPlanJson['nutrition']['foodPlan']>>;
  prepareProviderPlanDocument(
    input: PrepareProviderPlanDocumentInput
  ): DailyPlanJson;
  attachFoodPlan(
    planJson: DailyPlanJson,
    foodPlan: DailyPlanJson['nutrition']['foodPlan']
  ): DailyPlanJson;
  finalizeGenerationResult(
    input: FinalizeDailyPlanGenerationInput
  ): Promise<FinalizedDailyPlanGeneration>;
  applyTrainingLoad(
    input: ApplyDailyPlanTrainingLoadInput
  ): Promise<DailyPlanJson>;
  executeGenerationWorkflow(
    input: ExecuteDailyPlanGenerationWorkflowInput
  ): Promise<DailyPlanGenerationWorkflowResult>;
  assembleBeforeSafety(input: AssembleDailyPlanInput): Promise<AssembledDailyPlan>;
  finalizeRecoveryContext(input: FinalizeRecoveryPlanInput): FinalizedRecoveryPlan;
  validateBeforePersistence(
    input: ValidateDailyPlanSafetyInput
  ): DailyPlanSafetyResult | Promise<DailyPlanSafetyResult>;
  validateGeneratedPlan(
    input: ValidateGeneratedDailyPlanInput
  ): DailyPlanSafetyResult | Promise<DailyPlanSafetyResult>;
  canUseSafetyRetry(providerStatus: PlanStatus): boolean;
  getProviderFallbackReason(planJson: unknown): string | undefined;
  getSafetyOperationContext(): DailyPlanSafetyOperationContext;
  getOperationContext(
    planQualityMode: PlanQualityMode | null
  ): DailyPlanOperationContext;
  createSafetyFallback(input: CreateSafetyFallbackInput): DailyPlanSafetyResult;
}
