import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiRequestOperation,
  DailyReadinessLevel,
  PlanCheckpointProposalStatus,
  PlanQualityMode,
  PlanStatus,
  PregnancyStatus,
  Prisma,
  UsageFeature
} from '@prisma/client';
import type {
  DailyPlanCheckpointPendingProposalResponse,
  DailyPlanCheckpointProposalResponse,
  DailyPlanCheckpointProposal,
  DailyPlanJson as SharedDailyPlanJson,
  PlanCheckpointProposalFailureReason,
  ResolveDailyPlanCheckpointProposalResponse
} from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { AiCostControlService } from '../ai-operation-logs/ai-cost-control.service';
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
import { UsageGuardService } from '../usage/usage-guard.service';
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

class StaleCheckpointProposalError extends Error {}

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
    private readonly safetyAgentConfig: SafetyAgentConfig,
    private readonly usageGuardService: UsageGuardService,
    private readonly aiCostControlService: AiCostControlService,
    private readonly configService: ConfigService
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
      userId,
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

    if (
      this.configService
        .get<string>('AI_PROVIDER', 'mock')
        .toLowerCase() === 'openai'
    ) {
      await this.aiCostControlService.assertCanStartAiOperation(
        userId
      );
      await this.usageGuardService.checkAndConsumeConfigured(
        userId,
        UsageFeature.AI_PLAN_CHECKPOINT_PROPOSAL
      );
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
      userId,
      plan: finalSchema.data,
      planQualityMode: providerInput.planQualityMode,
      user,
      blockedFoods
    });
    if (safetyReview !== null) {
      return this.failure(context.evaluation, safetyReview);
    }

    const generatedAt = new Date().toISOString();
    const persistedPlan = {
      ...finalSchema.data,
      generatedAt
    };
    const stored = await this.prisma.$transaction(async (tx) => {
      await tx.dailyPlanCheckpointProposal.updateMany({
        where: {
          userId,
          dailyPlanId,
          status: PlanCheckpointProposalStatus.PENDING
        },
        data: {
          status: PlanCheckpointProposalStatus.EXPIRED,
          resolvedAt: new Date()
        }
      });

      return tx.dailyPlanCheckpointProposal.create({
        data: {
          userId,
          dailyPlanId,
          sourcePlanUpdatedAt: new Date(context.sourcePlanUpdatedAt),
          trigger: context.evaluation.trigger,
          severity: context.evaluation.severity,
          reasonCodes: context.evaluation.reasonCodes,
          affectedSections: context.evaluation.affectedSections,
          evaluationJson: context.evaluation as unknown as Prisma.JsonObject,
          proposedPlanJson: persistedPlan as unknown as Prisma.JsonObject,
          summaryTitle: persistedPlan.summary.title,
          summaryMessage: persistedPlan.summary.message
        }
      });
    });
    this.logger.log(
      `checkpoint proposal ready; dailyPlanId=${dailyPlanId}; proposalId=${stored.id}; persisted=true`
    );
    return {
      evaluation: context.evaluation,
      status: 'READY',
      proposal: this.toProposal(stored)
    };
  }

  async getPending(
    userId: string,
    dailyPlanId: string
  ): Promise<DailyPlanCheckpointPendingProposalResponse> {
    const proposal = await this.prisma.dailyPlanCheckpointProposal.findFirst({
      where: {
        userId,
        dailyPlanId,
        status: PlanCheckpointProposalStatus.PENDING
      },
      include: {
        dailyPlan: {
          select: { updatedAt: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!proposal) return { proposal: null };
    if (
      proposal.dailyPlan.updatedAt.getTime() !==
      proposal.sourcePlanUpdatedAt.getTime()
    ) {
      await this.expireProposal(proposal.id, userId);
      return { proposal: null };
    }

    const parsedPlan = dailyPlanJsonSchema.safeParse(proposal.proposedPlanJson);
    if (!parsedPlan.success) {
      await this.expireProposal(proposal.id, userId);
      return { proposal: null };
    }

    return { proposal: this.toProposal(proposal) };
  }

  async apply(userId: string, dailyPlanId: string, proposalId: string) {
    try {
      const updatedPlan = await this.prisma.$transaction(async (tx) => {
        const proposal = await tx.dailyPlanCheckpointProposal.findFirst({
          where: { id: proposalId, userId, dailyPlanId }
        });

        if (!proposal) {
          throw new NotFoundException('Plan update proposal not found.');
        }
        if (proposal.status !== PlanCheckpointProposalStatus.PENDING) {
          throw new ConflictException({
            code: 'CHECKPOINT_PROPOSAL_NOT_PENDING',
            message: 'This plan update has already been resolved.'
          });
        }

        const parsedPlan = dailyPlanJsonSchema.safeParse(
          proposal.proposedPlanJson
        );
        if (!parsedPlan.success) {
          throw new StaleCheckpointProposalError();
        }

        const updateResult = await tx.dailyPlan.updateMany({
          where: {
            id: dailyPlanId,
            userId,
            updatedAt: proposal.sourcePlanUpdatedAt
          },
          data: {
            status: PlanStatus.READY,
            readinessLevel:
              parsedPlan.data.summary.readiness as DailyReadinessLevel,
            planJson: parsedPlan.data as unknown as Prisma.JsonObject,
            createdByAi: parsedPlan.data.debug?.provider === 'openai'
          }
        });
        if (updateResult.count !== 1) {
          throw new StaleCheckpointProposalError();
        }

        await tx.dailyPlanCheckpointProposal.update({
          where: { id: proposal.id },
          data: {
            status: PlanCheckpointProposalStatus.APPLIED,
            resolvedAt: new Date()
          }
        });

        return tx.dailyPlan.findUniqueOrThrow({
          where: { id: dailyPlanId }
        });
      });

      this.logger.log(
        `checkpoint proposal applied; dailyPlanId=${dailyPlanId}; proposalId=${proposalId}`
      );
      return this.toDailyPlanResponse(updatedPlan);
    } catch (error) {
      if (error instanceof StaleCheckpointProposalError) {
        await this.expireProposal(proposalId, userId);
        throw new ConflictException({
          code: 'CHECKPOINT_PROPOSAL_STALE',
          message:
            'This suggested update is no longer current. Your latest plan was not changed.'
        });
      }
      throw error;
    }
  }

  async keep(
    userId: string,
    dailyPlanId: string,
    proposalId: string
  ): Promise<ResolveDailyPlanCheckpointProposalResponse> {
    const proposal = await this.prisma.dailyPlanCheckpointProposal.findFirst({
      where: { id: proposalId, userId, dailyPlanId }
    });
    if (!proposal) {
      throw new NotFoundException('Plan update proposal not found.');
    }
    if (proposal.status !== PlanCheckpointProposalStatus.PENDING) {
      throw new ConflictException({
        code: 'CHECKPOINT_PROPOSAL_NOT_PENDING',
        message: 'This plan update has already been resolved.'
      });
    }

    await this.prisma.dailyPlanCheckpointProposal.update({
      where: { id: proposal.id },
      data: {
        status: PlanCheckpointProposalStatus.DISMISSED,
        resolvedAt: new Date()
      }
    });
    this.logger.log(
      `checkpoint proposal dismissed; dailyPlanId=${dailyPlanId}; proposalId=${proposalId}`
    );

    return {
      id: proposal.id,
      resolutionStatus: 'DISMISSED'
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
    userId: string;
    plan: DailyPlanJson;
    planQualityMode: PlanQualityMode;
    user: Awaited<ReturnType<PlanCheckpointProposalService['getSafetyContext']>>;
    blockedFoods: { allergies: string[]; excludedFoods: string[] };
  }): Promise<PlanCheckpointProposalFailureReason | null> {
    if (!this.safetyAgentConfig.enabled) return null;

    try {
      const review = await this.safetyAgent.reviewDailyPlan({
        userId: input.userId,
        plan: input.plan,
        planQualityMode: input.planQualityMode,
        operation: AiRequestOperation.PLAN_CHECKPOINT,
        retryAttempt: false,
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

  private toProposal(proposal: {
    id: string;
    dailyPlanId: string;
    sourcePlanUpdatedAt: Date;
    trigger: string;
    severity: string;
    reasonCodes: string[];
    affectedSections: string[];
    evaluationJson: Prisma.JsonValue;
    proposedPlanJson: Prisma.JsonValue;
    summaryTitle: string;
    summaryMessage: string;
    status: PlanCheckpointProposalStatus;
    createdAt: Date;
  }): DailyPlanCheckpointProposal {
    const evaluation =
      proposal.evaluationJson as unknown as DailyPlanCheckpointProposalResponse['evaluation'];

    return {
      id: proposal.id,
      proposalVersion: 'adaptive-checkpoint.v1',
      resolutionStatus: proposal.status,
      generatedAt: proposal.createdAt.toISOString(),
      sourceDailyPlanId: proposal.dailyPlanId,
      sourcePlanUpdatedAt: proposal.sourcePlanUpdatedAt.toISOString(),
      trigger: evaluation.trigger,
      severity: evaluation.severity,
      reasonCodes: evaluation.reasonCodes,
      affectedSections: evaluation.affectedSections,
      summary: {
        title: proposal.summaryTitle,
        message: proposal.summaryMessage
      },
      proposedPlan: proposal.proposedPlanJson as unknown as SharedDailyPlanJson
    };
  }

  private async expireProposal(proposalId: string, userId: string) {
    await this.prisma.dailyPlanCheckpointProposal.updateMany({
      where: {
        id: proposalId,
        userId,
        status: PlanCheckpointProposalStatus.PENDING
      },
      data: {
        status: PlanCheckpointProposalStatus.EXPIRED,
        resolvedAt: new Date()
      }
    });
  }

  private toDailyPlanResponse(plan: {
    id: string;
    status: PlanStatus;
    readinessLevel: DailyReadinessLevel;
    planLocalDate: string;
    planTimezone: string;
    planJson: Prisma.JsonValue;
    updatedAt: Date;
  }) {
    const parsedPlan = dailyPlanJsonSchema.parse(plan.planJson);

    return {
      id: plan.id,
      status: plan.status,
      readinessLevel: plan.readinessLevel,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      plan: parsedPlan,
      updatedAt: plan.updatedAt.toISOString()
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
