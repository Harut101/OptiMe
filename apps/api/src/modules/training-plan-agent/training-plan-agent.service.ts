import { Injectable, Logger } from '@nestjs/common';
import { PlanStatus } from '@prisma/client';

import {
  composeDeterministicFallbackWorkout,
  validateAndNormalizePlannedExercises
} from '../exercise-selection/exercise-plan-validator';
import { ExerciseSelectionService } from '../exercise-selection/exercise-selection.service';
import type { ExerciseSelectionContext } from '../exercise-selection/exercise-selection.types';
import { dailyPlanJsonSchema } from '../daily-plans/daily-plan-json.schema';
import type {
  FinalizeTrainingPlanInput,
  FinalizedTrainingPlan,
  TrainingPlanAgent
} from './training-plan-agent.interface';

@Injectable()
export class TrainingPlanAgentService implements TrainingPlanAgent {
  private readonly logger = new Logger(TrainingPlanAgentService.name);

  constructor(private readonly exerciseSelectionService: ExerciseSelectionService) {}

  selectCandidates(context: ExerciseSelectionContext) {
    return this.exerciseSelectionService.selectCandidates(context);
  }

  composeDeterministicFallback(
    planJson: FinalizeTrainingPlanInput['providerPlanResult']['planJson'],
    exerciseSelection: FinalizeTrainingPlanInput['exerciseSelection']
  ) {
    return composeDeterministicFallbackWorkout(planJson, exerciseSelection);
  }

  async finalizeGeneratedPlan(
    input: FinalizeTrainingPlanInput
  ): Promise<FinalizedTrainingPlan> {
    const unchanged: FinalizedTrainingPlan = {
      ...input.providerPlanResult,
      usedAiRetry: false,
      usedDeterministicFallback: false,
      validationReasonCodes: []
    };

    if (input.providerPlanResult.status === PlanStatus.FALLBACK) {
      return unchanged;
    }

    const parsed = dailyPlanJsonSchema.safeParse(input.providerPlanResult.planJson);
    if (!parsed.success) {
      return unchanged;
    }

    const validation = validateAndNormalizePlannedExercises(
      parsed.data,
      input.exerciseSelection
    );
    if (validation.valid) {
      return { ...unchanged, planJson: validation.planJson };
    }

    this.logger.warn(
      `training plan validation failed; reasons=${validation.reasonCodes.join(',')}`
    );

    let retryValidationReasonCodes: string[] = [];
    if (input.retry) {
      this.logger.log(
        `training plan retry triggered=true; reasonCount=${validation.reasonCodes.length}`
      );
      const retry = await input.retry({
        reasonCodes: validation.reasonCodes,
        ...validation.repairFeedback
      });

      if (retry.status === PlanStatus.READY) {
        const retryParsed = dailyPlanJsonSchema.safeParse(retry.planJson);
        if (retryParsed.success) {
          const retryValidation = validateAndNormalizePlannedExercises(
            retryParsed.data,
            input.exerciseSelection
          );
          if (retryValidation.valid) {
            this.logger.log('training plan retry validation passed=true');
            return {
              status: PlanStatus.READY,
              planJson: retryValidation.planJson,
              usedAiRetry: true,
              usedDeterministicFallback: false,
              validationReasonCodes: []
            };
          }

          retryValidationReasonCodes = retryValidation.reasonCodes;
          this.logger.warn(
            `training plan retry validation passed=false; reasons=${retryValidation.reasonCodes.join(',')}`
          );
        }
      }
    } else {
      this.logger.log('training plan retry triggered=false');
    }

    const validationReasonCodes =
      input.retry && retryValidationReasonCodes.length > 0
        ? retryValidationReasonCodes
        : validation.reasonCodes;
    this.logger.warn('deterministic training plan fallback used=true');
    return {
      status: PlanStatus.READY,
      planJson: this.composeDeterministicFallback(parsed.data, input.exerciseSelection),
      usedAiRetry: Boolean(input.retry),
      usedDeterministicFallback: true,
      validationReasonCodes
    };
  }
}
