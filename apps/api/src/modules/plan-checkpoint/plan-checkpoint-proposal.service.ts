import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PlanQualityMode, PregnancyStatus } from '@prisma/client';
import type {
  DailyPlanCheckpointProposalResponse,
  DailyPlanJson as SharedDailyPlanJson,
  PlanCheckpointProposalFailureReason
} from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import {
  AiProvider,
  GeneratePlanCheckpointProposalInput
} from '../ai/ai-provider.interface';
import { AI_PROVIDER } from '../ai/ai-provider.token';
import {
  DailyPlanJson,
  dailyPlanJsonSchema
} from '../daily-plans/daily-plan-json.schema';
import { normalizeDailyPlanFoodNames } from '../daily-plans/daily-plan-food-name-normalizer';
import { SafetyService } from '../safety/safety.service';
import { SafetyAgent } from '../safety-agent/safety-agent.interface';
import { safetyAgentReviewSchema } from '../safety-agent/safety-agent-review.schema';
import {
  SAFETY_AGENT,
  SAFETY_AGENT_CONFIG,
  SafetyAgentConfig
} from '../safety-agent/safety-agent.token';
import { EvaluateDailyPlanCheckpointDto } from './dto/evaluate-daily-plan-checkpoint.dto';
import { PlanCheckpointService } from './plan-checkpoint.service';

const SUPPORTIVE_PROPOSAL_MESSAGES: Record<
  PlanCheckpointProposalFailureReason,
  string
> = {
  provider_unavailable:
    'Your current plan is still available. We could not prepare a safe update right now.',
  schema_validation_failed:
    'Your current plan is unchanged because the suggested update could not be validated.',
  deterministic_safety_rejected:
    'Your current plan is unchanged because the suggested update did not pass our safety checks.',
  safety_agent_rejected:
    'Your current plan is unchanged because the suggested update needs a safer revision.',
  safety_agent_invalid_review:
    'Your current plan is unchanged because the safety review could not be validated.',
  safety_agent_unavailable:
    'Your current plan is still available. Safety review is temporarily unavailable.'
};

@Injectable()
export class PlanCheckpointProposalService {
  private readonly logger = new Logger(PlanCheckpointProposalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkpointService: PlanCheckpointService,
    private readonly safetyService: SafetyService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
    @Inject(SAFETY_AGENT) private readonly safetyAgent: SafetyAgent,
    @Inject(SAFETY_AGENT_CONFIG)
    private readonly safetyAgentConfig: SafetyAgentConfig
  ) {}

  async propose(
    userId: string,
    dailyPlanId: string,
    dto: EvaluateDailyPlanCheckpointDto
  ): Promise<DailyPlanCheckpointProposalResponse> {
    const context = await this.checkpointService.evaluateWithContext(
      userId,
      dailyPlanId,
      dto
    );

    if (
      context.evaluation.baselineInitialized ||
      !context.evaluation.materialChangeDetected
    ) {
      this.logger.log(
        `checkpoint proposal skipped; dailyPlanId=${dailyPlanId}; materialChange=false`
      );
      return {
        evaluation: context.evaluation,
        status: 'NOT_NEEDED',
        proposal: null
      };
    }

    const user = await this.getSafetyContext(userId);
    const blockedFoods = {
      allergies: user.nutritionPref?.allergies.map((food) => food.name) ?? [],
      excludedFoods:
        user.nutritionPref?.excludedFoods.map((food) => food.name) ?? []
    };
    const providerInput: GeneratePlanCheckpointProposalInput = {
      currentPlan: context.sourcePlan,
      evaluation: context.evaluation,
      currentFacts: context.currentFacts,
      planLocalDate: context.evaluation.planLocalDate,
      planTimezone: context.sourcePlanTimezone,
      locale: context.sourcePlan.contentLocale ?? 'en-US',
      planQualityMode:
        context.sourcePlan.debug?.planQualityMode ?? PlanQualityMode.BASIC,
      safetyContext: {
        safeMode: user.safeMode,
        isMinor: user.isMinor,
        pregnancyStatus:
          user.profile?.pregnancyStatus ?? PregnancyStatus.UNKNOWN,
        allergies: blockedFoods.allergies,
        excludedFoods: blockedFoods.excludedFoods,
        trainingLevel: user.trainingPreference?.trainingLevel ?? null,
        limitationsOrPainAreas:
          user.trainingPreference?.limitationsOrPainAreas ?? []
      }
    };

    if (!this.aiProvider.generatePlanCheckpointProposal) {
      return this.failure(context.evaluation, 'provider_unavailable');
    }

    let providerPlan: DailyPlanJson;
    try {
      this.logger.log(
        [
          'checkpoint proposal provider called',
          `dailyPlanId=${dailyPlanId}`,
          `reasonCount=${context.evaluation.reasonCodes.length}`,
          `severity=${context.evaluation.severity}`
        ].join('; ')
      );
      providerPlan =
        await this.aiProvider.generatePlanCheckpointProposal(providerInput);
    } catch {
      this.logger.warn(
        `checkpoint proposal provider unavailable; dailyPlanId=${dailyPlanId}`
      );
      return this.failure(context.evaluation, 'provider_unavailable');
    }

    const parsedProviderPlan = dailyPlanJsonSchema.safeParse(providerPlan);
    if (!parsedProviderPlan.success) {
      this.logger.warn(
        `checkpoint proposal schema validation failed; dailyPlanId=${dailyPlanId}`
      );
      return this.failure(context.evaluation, 'schema_validation_failed');
    }

    const proposedPlan = this.normalizeBackendOwnedFields({
      candidate: parsedProviderPlan.data,
      source: context.sourcePlan,
      currentFacts: context.currentFacts,
      safeMode: user.safeMode,
      safetyCritical:
        context.evaluation.severity === 'SAFETY_CRITICAL'
    });
    const normalizedFoodNames = normalizeDailyPlanFoodNames(
      proposedPlan,
      blockedFoods
    );
    const finalSchema = dailyPlanJsonSchema.safeParse(
      normalizedFoodNames.planJson
    );

    if (!finalSchema.success) {
      this.logger.warn(
        `checkpoint proposal normalized schema validation failed; dailyPlanId=${dailyPlanId}`
      );
      return this.failure(context.evaluation, 'schema_validation_failed');
    }

    const deterministicSafety = this.validateDeterministicSafety({
      plan: finalSchema.data,
      user,
      blockedFoods,
      currentFacts: context.currentFacts
    });
    if (!deterministicSafety) {
      this.logger.warn(
        `checkpoint proposal deterministic safety failed; dailyPlanId=${dailyPlanId}`
      );
      return this.failure(
        context.evaluation,
        'deterministic_safety_rejected'
      );
    }

    const safetyReview = await this.reviewWithSafetyAgent({
      plan: finalSchema.data,
      user,
      blockedFoods
    });
    if (safetyReview !== null) {
      return this.failure(context.evaluation, safetyReview);
    }

    const generatedAt = new Date().toISOString();
    this.logger.log(
      `checkpoint proposal ready; dailyPlanId=${dailyPlanId}; persisted=false`
    );
    return {
      evaluation: context.evaluation,
      status: 'READY',
      proposal: {
        proposalVersion: 'adaptive-checkpoint.v1',
        generatedAt,
        sourceDailyPlanId: dailyPlanId,
        sourcePlanUpdatedAt: context.sourcePlanUpdatedAt,
        trigger: context.evaluation.trigger,
        severity: context.evaluation.severity,
        reasonCodes: context.evaluation.reasonCodes,
        affectedSections: context.evaluation.affectedSections,
        summary: {
          title: finalSchema.data.summary.title,
          message: finalSchema.data.summary.message
        },
        proposedPlan: {
          ...finalSchema.data,
          generatedAt
        } as unknown as SharedDailyPlanJson
      }
    };
  }

  private normalizeBackendOwnedFields(input: {
    candidate: DailyPlanJson;
    source: DailyPlanJson;
    currentFacts: GeneratePlanCheckpointProposalInput['currentFacts'];
    safeMode: boolean;
    safetyCritical: boolean;
  }): DailyPlanJson {
    const candidateExercises = input.candidate.training.exercises ?? [];
    const sourceExercises = input.source.training.exercises ?? [];
    const mayRestForSafety =
      input.safetyCritical && candidateExercises.length === 0;
    const exercises = mayRestForSafety
      ? []
      : sourceExercises.map((sourceExercise) => {
          const candidateExercise = candidateExercises.find(
            (exercise) =>
              (sourceExercise.exerciseId &&
                exercise.exerciseId === sourceExercise.exerciseId) ||
              (sourceExercise.slug && exercise.slug === sourceExercise.slug)
          );

          if (!candidateExercise) return sourceExercise;

          return {
            ...sourceExercise,
            sets: candidateExercise.sets,
            reps: candidateExercise.reps,
            rest: candidateExercise.rest,
            duration: candidateExercise.duration,
            intensityCue: candidateExercise.intensityCue,
            notes: candidateExercise.notes,
            safetyNotes: candidateExercise.safetyNotes
          };
        });

    return {
      ...input.candidate,
      schemaVersion: 'sprint-2.v1',
      generatedAt: new Date().toISOString(),
      mockVersion: input.source.mockVersion,
      contentLocale: input.source.contentLocale,
      safety: {
        ...input.candidate.safety,
        safeMode: input.safeMode
      },
      nutrition: {
        ...input.candidate.nutrition,
        calorieGuidance: input.source.nutrition.calorieGuidance,
        macroGuidance: input.source.nutrition.macroGuidance,
        meals: input.source.nutrition.meals,
        menuOptions: input.source.nutrition.menuOptions,
        foodPlan: input.source.nutrition.foodPlan
      },
      training: {
        ...input.candidate.training,
        exercises
      },
      trainingLoadAgentSnapshot: input.source.trainingLoadAgentSnapshot,
      trainingAdjustmentSnapshot: input.source.trainingAdjustmentSnapshot,
      trainingScheduleSnapshot: input.source.trainingScheduleSnapshot,
      nutritionTargetSnapshot: input.source.nutritionTargetSnapshot,
      checkpointBaseline: input.currentFacts,
      contextNotes: input.source.contextNotes,
      debug: input.candidate.debug
    };
  }

  private validateDeterministicSafety(input: {
    plan: DailyPlanJson;
    user: Awaited<ReturnType<PlanCheckpointProposalService['getSafetyContext']>>;
    blockedFoods: { allergies: string[]; excludedFoods: string[] };
    currentFacts: GeneratePlanCheckpointProposalInput['currentFacts'];
  }) {
    const foodSafety = this.safetyService.validatePlanFoodSafety(
      input.plan,
      input.blockedFoods
    );
    if (!foodSafety.passed) return false;

    const pregnancySafety =
      this.safetyService.validatePregnancySensitivePlanSafety(
        input.plan,
        input.user.profile?.pregnancyStatus
      );
    if (!pregnancySafety.passed) return false;

    const exerciseSafety = this.safetyService.validatePlanExerciseSafety({
      planJson: input.plan,
      safeMode: input.user.safeMode,
      isMinor: input.user.isMinor,
      pregnancyStatus: input.user.profile?.pregnancyStatus,
      trainingLevel: input.user.trainingPreference?.trainingLevel,
      limitationsOrPainAreas:
        input.user.trainingPreference?.limitationsOrPainAreas ?? [],
      painOrDiscomfortReported:
        input.currentFacts.safetySignals.painOrLimitation,
      highTirednessReported:
        (input.currentFacts.checkIn.tirednessLevel ?? 0) >= 8 ||
        input.currentFacts.safetySignals.exhaustion
    });

    return exerciseSafety.passed;
  }

  private async reviewWithSafetyAgent(input: {
    plan: DailyPlanJson;
    user: Awaited<ReturnType<PlanCheckpointProposalService['getSafetyContext']>>;
    blockedFoods: { allergies: string[]; excludedFoods: string[] };
  }): Promise<PlanCheckpointProposalFailureReason | null> {
    if (!this.safetyAgentConfig.enabled) return null;

    try {
      const review = await this.safetyAgent.reviewDailyPlan({
        plan: input.plan,
        safeMode: input.user.safeMode,
        goalSummary: input.user.goal
          ? {
              goalType: input.user.goal.goalType,
              targetWeightKg: input.user.goal.targetWeightKg,
              targetTimelineDays: input.user.goal.targetTimelineDays,
              impactMode: input.user.goal.impactMode
            }
          : null,
        deterministicSafetyContext: {
          safeMode: input.user.safeMode,
          isMinor: input.user.isMinor,
          gender: input.user.profile?.gender ?? null,
          pregnancyStatus:
            input.user.profile?.pregnancyStatus ?? PregnancyStatus.UNKNOWN,
          allergies: input.blockedFoods.allergies,
          excludedFoods: input.blockedFoods.excludedFoods,
          deterministicSafetyPassed: true
        }
      });
      const parsedReview = safetyAgentReviewSchema.safeParse(review);
      if (!parsedReview.success) return 'safety_agent_invalid_review';
      if (!parsedReview.data.approved) return 'safety_agent_rejected';

      return null;
    } catch {
      return 'safety_agent_unavailable';
    }
  }

  private failure(
    evaluation: DailyPlanCheckpointProposalResponse['evaluation'],
    failureReason: PlanCheckpointProposalFailureReason
  ): DailyPlanCheckpointProposalResponse {
    return {
      evaluation,
      status:
        failureReason === 'provider_unavailable' ||
        failureReason === 'safety_agent_unavailable'
          ? 'UNAVAILABLE'
          : failureReason === 'schema_validation_failed' ||
              failureReason === 'safety_agent_invalid_review'
            ? 'INVALID'
            : 'UNSAFE',
      proposal: null,
      failureReason,
      safeUserMessage: SUPPORTIVE_PROPOSAL_MESSAGES[failureReason]
    };
  }

  private async getSafetyContext(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        safeMode: true,
        isMinor: true,
        profile: {
          select: {
            gender: true,
            pregnancyStatus: true
          }
        },
        goal: {
          select: {
            goalType: true,
            targetWeightKg: true,
            targetTimelineDays: true,
            impactMode: true
          }
        },
        nutritionPref: {
          select: {
            allergies: { select: { name: true } },
            excludedFoods: { select: { name: true } }
          }
        },
        trainingPreference: {
          select: {
            trainingLevel: true,
            limitationsOrPainAreas: true
          }
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException(
        'Your session is no longer valid. Please log in again.'
      );
    }

    return user;
  }
}
