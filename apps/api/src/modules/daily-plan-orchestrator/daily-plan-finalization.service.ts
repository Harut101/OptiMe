import { Injectable, Logger } from '@nestjs/common';
import { GoalImpactMode, type PlanQualityMode } from '@prisma/client';
import type {
  NutritionTarget,
  ResolvedTrainingDayContext,
  SupportedLocale
} from '@optime/shared-types';

import type { GenerateDailyPlanPersonalizationContext } from '../ai/ai-provider.interface';
import { getSafeFallbackCopy } from '../daily-plans/daily-plan-copy';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import type { ExerciseSelectionResult } from '../exercise-selection/exercise-selection.types';
import { NutritionTargetsService } from '../nutrition-targets/nutrition-targets.service';
import { PlanCheckpointService } from '../plan-checkpoint/plan-checkpoint.service';
import type { SelectedProtocols } from '../protocol/protocol.types';
import { RecoveryPlanAgentService } from '../recovery-plan-agent/recovery-plan-agent.service';
import { TrainingPlanAgentService } from '../training-plan-agent/training-plan-agent.service';
import type {
  FinalizeDailyPlanGenerationInput,
  PrepareProviderPlanDocumentInput
} from './daily-plan-finalization.interface';

@Injectable()
export class DailyPlanFinalizationService {
  private readonly logger = new Logger(DailyPlanFinalizationService.name);

  constructor(
    private readonly nutritionTargetsService: NutritionTargetsService,
    private readonly planCheckpointService: PlanCheckpointService,
    private readonly recoveryPlanAgent: RecoveryPlanAgentService,
    private readonly trainingPlanAgent: TrainingPlanAgentService
  ) {}

  prepareProviderPlanDocument(
    input: PrepareProviderPlanDocumentInput
  ): DailyPlanJson {
    return this.withTrainingStateForAppMode(
      this.withNutritionTargetSnapshot(
        this.withTrainingScheduleSnapshot(
          input.planJson,
          input.resolvedTrainingDay
        ),
        input.nutritionTarget
      ),
      input.appMode,
      input.locale
    );
  }

  attachFoodPlan(
    planJson: DailyPlanJson,
    foodPlan: DailyPlanJson['nutrition']['foodPlan']
  ): DailyPlanJson {
    if (!foodPlan) return planJson;

    return {
      ...planJson,
      nutrition: {
        ...planJson.nutrition,
        // Keep legacy rendering fields aligned with the catalog-backed plan so
        // safety and clients never see two different daily menus.
        meals: foodPlan.meals.map((meal) => ({
          name: meal.title,
          purpose: meal.shortDescription ?? meal.servingSummary,
          foods: meal.ingredients.map((ingredient) => ({
            name: ingredient.name,
            portion: `${ingredient.quantity} ${ingredient.unit}`
          }))
        })),
        foodPlan
      }
    };
  }

  async finalize(
    input: FinalizeDailyPlanGenerationInput
  ): Promise<{
    safePlanResult: FinalizeDailyPlanGenerationInput['safePlanResult'];
    finalExerciseIds: string[];
  }> {
    const planWithSafeTraining = this.withSafeTrainingDayFallback({
      planJson: input.safePlanResult.planJson,
      resolvedTrainingDay: input.resolvedTrainingDay,
      exerciseSelection: input.exerciseSelection,
      trainingEnabled: input.trainingEnabled
    });
    const recoveryPlan = this.recoveryPlanAgent.finalizeGeneratedPlan({
      planJson: this.withNutritionTargetSnapshot(
        this.ensureFoodPlan(planWithSafeTraining, input.finalFoodPlan),
        input.nutritionTarget
      ),
      recoveryProtocol: input.selectedProtocols?.recoveryProtocol,
      healthPlanningContext: input.healthPlanningContext,
      trainingEnabled: input.trainingEnabled,
      isTrainingDay: input.resolvedTrainingDay.isTrainingDay
    }).planJson;
    const planWithContext = this.withTrainingScheduleSnapshot(
      this.withPlanDebugContext(
        recoveryPlan,
        input.planQualityMode,
        input.selectedProtocols,
        input.healthPlanningContext
      ),
      input.resolvedTrainingDay
    );
    const planWithExerciseDebug = this.withExerciseSelectionDebug(
      planWithContext,
      input.exerciseSelection,
      input.trainingPreparation.usedAiRetry,
      input.trainingPreparation.usedDeterministicFallback
    );
    const planWithGenerationDebug = this.withGenerationSectionDebug(
      planWithExerciseDebug,
      input.trainingPreparation.usedDeterministicFallback
    );
    const planJson: DailyPlanJson = {
      ...planWithGenerationDebug,
      checkpointBaseline:
        await this.planCheckpointService.captureGenerationBaseline(
          input.userId,
          input.planLocalDate,
          input.existingPlanId
        )
    };
    const safePlanResult = {
      ...input.safePlanResult,
      planJson
    };
    const finalExerciseIds = (planJson.training.exercises ?? [])
      .map((exercise) => exercise.exerciseId)
      .filter((exerciseId): exerciseId is string => Boolean(exerciseId));

    this.logger.log(
      `exercise selection finalized; exerciseIds=${JSON.stringify(finalExerciseIds)}`
    );
    this.logger.log(
      `plan completion finalized; complete=${planJson.debug?.generation?.isComplete ?? false}; adjustedSections=${planJson.debug?.generation?.adjustedSections.join(',') || 'none'}`
    );

    return { safePlanResult, finalExerciseIds };
  }

  private withPlanDebugContext(
    planJson: DailyPlanJson,
    planQualityMode: PlanQualityMode,
    selectedProtocols?: SelectedProtocols,
    healthPlanningContext?: GenerateDailyPlanPersonalizationContext['healthPlanningContext']
  ): DailyPlanJson {
    if (!planJson.debug) return planJson;

    return {
      ...planJson,
      debug: {
        ...planJson.debug,
        planQualityMode,
        ...(selectedProtocols
          ? {
              protocols: {
                nutritionProtocolId: selectedProtocols.nutritionProtocol.id,
                trainingProtocolId: selectedProtocols.trainingProtocol.id,
                recoveryProtocolId: selectedProtocols.recoveryProtocol.id
              }
            }
          : {}),
        ...(healthPlanningContext?.available
          ? {
              healthSignals: {
                lowSleep: healthPlanningContext.signals.lowSleep,
                highActivityYesterday:
                  healthPlanningContext.signals.highActivityYesterday,
                recentWorkout:
                  healthPlanningContext.signals.recentWorkout,
                lowStepTrend:
                  healthPlanningContext.signals.lowStepTrend
              },
              ...(healthPlanningContext.wearableContext
                ? {
                    wearableContext: {
                      source: healthPlanningContext.wearableContext.source,
                      hasRecentData:
                        healthPlanningContext.wearableContext.hasRecentData,
                      isStale:
                        healthPlanningContext.wearableContext.isStale,
                      localDate:
                        healthPlanningContext.wearableContext.localDate
                    }
                  }
                : {}),
              trainingLoadContext: {
                hasTrainingLoadContext:
                  healthPlanningContext.trainingLoadContext
                    .hasTrainingLoadContext,
                readinessHint:
                  healthPlanningContext.trainingLoadContext.readinessHint,
                reasons:
                  healthPlanningContext.trainingLoadContext.reasons
              }
            }
          : {})
      }
    };
  }

  private withExerciseSelectionDebug(
    planJson: DailyPlanJson,
    selection: ExerciseSelectionResult,
    usedAiRetry: boolean,
    usedDeterministicFallback: boolean
  ): DailyPlanJson {
    if (!planJson.debug) return planJson;

    return {
      ...planJson,
      debug: {
        ...planJson.debug,
        exerciseSelection: {
          candidateCount: selection.candidates.length,
          requestedExerciseCount: selection.requestedExerciseCount,
          minExerciseCount: selection.minExerciseCount,
          maxExerciseCount: selection.maxExerciseCount,
          workoutDurationMinutes: selection.workoutDurationMinutes,
          volumeReasonCodes: selection.volumePlan.volumeReasonCodes,
          fallbackMode: selection.fallbackMode,
          usedAiRetry,
          usedDeterministicFallback,
          resolvedLocale:
            selection.candidates[0]?.resolvedLocale ?? 'en-US'
        }
      }
    };
  }

  private withGenerationSectionDebug(
    planJson: DailyPlanJson,
    usedDeterministicExerciseFallback: boolean
  ): DailyPlanJson {
    if (!planJson.debug) return planJson;

    const adjustedSections = new Set(
      planJson.debug.generation?.adjustedSections ?? []
    );
    if (planJson.debug.provider === 'fallback') {
      adjustedSections.add('CORE');
      adjustedSections.add('TRAINING');
      adjustedSections.add('RECOVERY');
    }
    if (
      planJson.nutrition.foodPlan?.source ===
      'DETERMINISTIC_FALLBACK'
    ) {
      adjustedSections.add('NUTRITION');
    }
    if (usedDeterministicExerciseFallback) {
      adjustedSections.add('TRAINING');
    }

    return {
      ...planJson,
      debug: {
        ...planJson.debug,
        generation: {
          isComplete: true,
          adjustedSections: [...adjustedSections]
        }
      }
    };
  }

  private withTrainingScheduleSnapshot(
    planJson: DailyPlanJson,
    resolvedTrainingDay: ResolvedTrainingDayContext
  ): DailyPlanJson {
    return {
      ...planJson,
      trainingScheduleSnapshot: resolvedTrainingDay
    };
  }

  private withSafeTrainingDayFallback(input: {
    planJson: DailyPlanJson;
    resolvedTrainingDay: ResolvedTrainingDayContext;
    exerciseSelection: ExerciseSelectionResult;
    trainingEnabled: boolean;
  }): DailyPlanJson {
    if (
      !input.trainingEnabled ||
      !input.resolvedTrainingDay.isTrainingDay ||
      input.exerciseSelection.requestedExerciseCount === 0 ||
      input.planJson.debug?.provider !== 'fallback'
    ) {
      return input.planJson;
    }

    const conservativePlan: DailyPlanJson = {
      ...input.planJson,
      training: {
        ...input.planJson.training,
        recommendation:
          'Follow your planned session at a light, controlled pace.',
        intensity: 'LIGHT',
        notes:
          'This version uses your saved routine and safer exercise options. Stop if discomfort increases.'
      }
    };

    this.logger.warn(
      `safe training-day fallback restored; exerciseCount=${input.exerciseSelection.requestedExerciseCount}`
    );
    return this.trainingPlanAgent.composeDeterministicFallback(
      conservativePlan,
      input.exerciseSelection
    );
  }

  private withNutritionTargetSnapshot(
    planJson: DailyPlanJson,
    nutritionTarget: NutritionTarget
  ): DailyPlanJson {
    return {
      ...planJson,
      nutritionTargetSnapshot:
        this.nutritionTargetsService.toSnapshot(nutritionTarget)
    };
  }

  private ensureFoodPlan(
    planJson: DailyPlanJson,
    foodPlan: NonNullable<DailyPlanJson['nutrition']['foodPlan']>
  ): DailyPlanJson {
    return planJson.nutrition.foodPlan
      ? planJson
      : this.attachFoodPlan(planJson, foodPlan);
  }

  private withTrainingStateForAppMode(
    planJson: DailyPlanJson,
    appMode: GoalImpactMode,
    locale: SupportedLocale
  ): DailyPlanJson {
    if (appMode !== GoalImpactMode.NUTRITION_ONLY) return planJson;

    const copy = getSafeFallbackCopy(locale);
    return {
      ...planJson,
      training: {
        recommendation: copy.trainingOffRecommendation,
        intensity: 'REST',
        notes: copy.trainingOffNotes,
        exercises: []
      }
    };
  }
}
