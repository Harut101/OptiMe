import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import {
  GoalImpactMode,
  PreferredLocale,
  Prisma,
  TargetMuscleGroup
} from '@prisma/client';
import {
  resolveSupportedLocale,
  type SupportedLocale
} from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import {
  DailyPlanJson,
  dailyPlanJsonSchema
} from '../daily-plans/daily-plan-json.schema';
import { normalizeDailyPlanJson } from '../daily-plans/daily-plan-normalizer';
import {
  getExerciseMuscles,
  getPlanExerciseKey,
  PainAwareExerciseReplacementService,
  type TrainingReplacementProposalResult
} from '../daily-plans/pain-aware-exercise-replacement.service';
import { FeatureAccessService } from '../entitlements/feature-access.service';
import { TrainingPlanAgentService } from '../training-plan-agent/training-plan-agent.service';
import { TrainingScheduleResolverService } from '../training-schedule/training-schedule-resolver.service';
import {
  mapPainAreasToMuscles,
  normalizePainAreas
} from '../workout-sessions/workout-pain-mapping';
import {
  dailyPlanPlanningUserSelect,
  type DailyPlanPlanningUser
} from './daily-plan-planning-user';
import type {
  AdjustDailyPlanTrainingInput,
  ApplyTrainingReplacementsInput,
  GetTrainingReplacementProposalsInput
} from './daily-plan-training-adjustment-use-case.interface';
import { DailyPlanOrchestratorService } from './daily-plan-orchestrator.service';

@Injectable()
export class DailyPlanTrainingAdjustmentUseCaseService {
  private readonly logger = new Logger(
    DailyPlanTrainingAdjustmentUseCaseService.name
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureAccessService: FeatureAccessService,
    private readonly trainingPlanAgent: TrainingPlanAgentService,
    private readonly trainingScheduleResolver: TrainingScheduleResolverService,
    private readonly painAwareExerciseReplacement: PainAwareExerciseReplacementService,
    private readonly orchestrator: DailyPlanOrchestratorService
  ) {}

  async adjustForPreWorkout(
    input: AdjustDailyPlanTrainingInput
  ) {
    const proposalResult =
      await this.buildTrainingReplacementProposalResult({
        ...input,
        preWorkoutCheck: {
          ...input.preWorkoutCheck,
          painAreas: input.preWorkoutCheck.painAreas ?? []
        },
        conflictingExerciseKeys: []
      });

    if (proposalResult.proposals.length > 0) {
      return this.applyReplacements({
        ...input,
        preWorkoutCheck: {
          ...input.preWorkoutCheck,
          painAreas: input.preWorkoutCheck.painAreas ?? []
        },
        conflictingExerciseKeys:
          proposalResult.proposals.map(
            (proposal) =>
              proposal.originalPlanExerciseKey
          ),
        acceptedOriginalPlanExerciseKeys:
          proposalResult.proposals.map(
            (proposal) =>
              proposal.originalPlanExerciseKey
          )
      });
    }

    const [plan, existingSession] = await Promise.all([
      this.getOwnedPlanOrThrow(
        input.userId,
        input.dailyPlanId
      ),
      this.prisma.workoutSession.findUnique({
        where: {
          userId_dailyPlanId: {
            userId: input.userId,
            dailyPlanId: input.dailyPlanId
          }
        },
        select: { id: true }
      })
    ]);

    if (existingSession) {
      throw new BadRequestException(
        'Workout already started. Today’s plan was not changed.'
      );
    }

    const painAreas = normalizePainAreas(
      input.preWorkoutCheck.painAreas ?? []
    );
    const avoidedMuscleGroups =
      mapPainAreasToMuscles(painAreas);

    if (
      input.preWorkoutCheck.readinessStatus !==
        'PAIN_OR_LIMITATION' ||
      avoidedMuscleGroups.length === 0
    ) {
      throw new BadRequestException(
        'Choose a pain or limitation area before adjusting today’s workout.'
      );
    }

    const avoided = new Set<TargetMuscleGroup>(
      avoidedMuscleGroups
    );
    const currentPlan = normalizeDailyPlanJson({
      planJson: plan.planJson,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      readinessLevel: plan.readinessLevel
    });
    const exercises = currentPlan.training.exercises ?? [];
    const safeExercises = exercises.filter(
      (exercise) =>
        !this.getPlanExerciseMuscles(exercise).some(
          (muscle) => avoided.has(muscle)
        )
    );
    const removedCount =
      exercises.length - safeExercises.length;

    if (removedCount === 0) {
      return plan;
    }

    if (safeExercises.length < 1) {
      throw new BadRequestException(
        'Not enough safe exercises remain for today. Consider resting today instead.'
      );
    }

    const nextPlan: DailyPlanJson = {
      ...currentPlan,
      training: {
        ...currentPlan.training,
        exercises: safeExercises,
        recommendation:
          'Use the adjusted workout for today and keep the session controlled.',
        notes:
          'Adjusted from your pre-workout check. Stop if pain increases, dizziness appears, or anything feels unusual.'
      },
      trainingAdjustmentSnapshot: {
        source: 'PRE_WORKOUT_PAIN_ADJUSTMENT',
        painAreas,
        avoidedMuscleGroups,
        adjustedAt: new Date().toISOString(),
        reasonCodes: [
          'PRE_WORKOUT_PAIN_CONFLICT',
          'CONFLICTING_EXERCISES_REMOVED'
        ]
      }
    };

    const parsed = dailyPlanJsonSchema.safeParse(nextPlan);

    if (!parsed.success) {
      throw new BadRequestException(
        'Could not safely adjust today’s workout. Your current plan was kept.'
      );
    }

    const updated = await this.prisma.dailyPlan.update({
      where: { id: plan.id },
      data: {
        planJson: parsed.data as Prisma.JsonObject
      }
    });

    this.logger.log(
      `daily plan training adjusted for pre-workout pain; planId=${input.dailyPlanId}; removedExercises=${removedCount}; avoidedMuscles=${avoidedMuscleGroups.length}`
    );

    return updated;
  }

  async getReplacementProposals(
    input: GetTrainingReplacementProposalsInput
  ) {
    const proposalResult =
      await this.buildTrainingReplacementProposalResult(
        input
      );

    return this.toTrainingReplacementProposalResponse(
      proposalResult
    );
  }

  async applyReplacements(
    input: ApplyTrainingReplacementsInput
  ) {
    const { plan, currentPlan, proposalResult } =
      await this.buildTrainingReplacementContext(input);

    if (proposalResult.proposals.length === 0) {
      throw new BadRequestException(
        'Could not find safe replacement exercises for today.'
      );
    }

    const accepted = new Set(
      input.acceptedOriginalPlanExerciseKeys ?? []
    );

    if (accepted.size === 0) {
      throw new BadRequestException(
        'Choose at least one replacement to apply.'
      );
    }

    const proposalKeys = new Set(
      proposalResult.proposals.map(
        (proposal) =>
          proposal.originalPlanExerciseKey
      )
    );
    const invalidAccepted = [...accepted].filter(
      (key) => !proposalKeys.has(key)
    );

    if (invalidAccepted.length > 0) {
      throw new BadRequestException(
        'One or more replacement selections are no longer available.'
      );
    }

    const nextPlan =
      this.painAwareExerciseReplacement.applyProposals({
        dailyPlanId: input.dailyPlanId,
        planJson: currentPlan,
        proposalResult,
        acceptedOriginalPlanExerciseKeys: [...accepted]
      });
    const parsed = dailyPlanJsonSchema.safeParse(nextPlan);

    if (!parsed.success) {
      throw new BadRequestException(
        'Could not safely apply today’s workout replacements. Your current plan was kept.'
      );
    }

    const updated = await this.prisma.dailyPlan.update({
      where: { id: plan.id },
      data: {
        planJson: parsed.data as Prisma.JsonObject
      }
    });

    this.logger.log(
      `daily plan training replacements applied; planId=${input.dailyPlanId}; replacements=${accepted.size}; unresolved=${proposalResult.unresolvedConflicts.length}`
    );

    return updated;
  }

  private async buildTrainingReplacementProposalResult(
    input: GetTrainingReplacementProposalsInput
  ): Promise<TrainingReplacementProposalResult> {
    const { proposalResult } =
      await this.buildTrainingReplacementContext(input);

    return proposalResult;
  }

  private async buildTrainingReplacementContext(
    input: GetTrainingReplacementProposalsInput
  ) {
    const [user, plan, existingSession] =
      await Promise.all([
        this.getPlanningUser(input.userId),
        this.getOwnedPlanOrThrow(
          input.userId,
          input.dailyPlanId
        ),
        this.prisma.workoutSession.findUnique({
          where: {
            userId_dailyPlanId: {
              userId: input.userId,
              dailyPlanId: input.dailyPlanId
            }
          },
          select: { id: true }
        })
      ]);

    if (existingSession) {
      throw new BadRequestException(
        'Workout already started. Today’s plan was not changed.'
      );
    }

    const painAreas = normalizePainAreas(
      input.preWorkoutCheck.painAreas ?? []
    );
    const avoidedMuscleGroups =
      mapPainAreasToMuscles(painAreas);

    if (
      input.preWorkoutCheck.readinessStatus !==
        'PAIN_OR_LIMITATION' ||
      avoidedMuscleGroups.length === 0
    ) {
      throw new BadRequestException(
        'Choose a pain or limitation area before adjusting today’s workout.'
      );
    }

    const currentPlan = normalizeDailyPlanJson({
      planJson: plan.planJson,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      readinessLevel: plan.readinessLevel
    });
    const exercises = currentPlan.training.exercises ?? [];

    if (exercises.length === 0) {
      throw new BadRequestException(
        'Workout is unavailable for this plan.'
      );
    }

    const avoided = new Set<TargetMuscleGroup>(
      avoidedMuscleGroups
    );
    const allKeys = new Set(
      exercises.map((exercise, index) =>
        getPlanExerciseKey(
          input.dailyPlanId,
          exercise,
          index
        )
      )
    );
    const requestedKeys = [
      ...new Set(input.conflictingExerciseKeys ?? [])
    ];
    const invalidKeys = requestedKeys.filter(
      (key) => !allKeys.has(key)
    );

    if (invalidKeys.length > 0) {
      throw new BadRequestException(
        'One or more exercise keys are not part of this plan.'
      );
    }

    const derivedConflictKeys = exercises
      .map((exercise, index) => ({
        key: getPlanExerciseKey(
          input.dailyPlanId,
          exercise,
          index
        ),
        muscles: getExerciseMuscles(exercise)
      }))
      .filter((entry) =>
        entry.muscles.some((muscle) =>
          avoided.has(muscle)
        )
      )
      .map((entry) => entry.key);
    const conflictingExerciseKeys =
      requestedKeys.length > 0
        ? requestedKeys
        : derivedConflictKeys;

    if (conflictingExerciseKeys.length === 0) {
      throw new BadRequestException(
        'No conflicting planned exercises were found for the selected area.'
      );
    }

    const planQualityMode =
      await this.featureAccessService.getPlanQualityMode(
        input.userId
      );
    const appMode = this.orchestrator.resolveAppMode(user);
    const resolvedTrainingDay =
      currentPlan.trainingScheduleSnapshot ??
      (await this.trainingScheduleResolver.resolveForUser({
        userId: input.userId,
        planLocalDate: plan.planLocalDate,
        trainingPreference: user.trainingPreference,
        legacyScheduleItems: user.schedules,
        noTrainingPlanned:
          appMode !==
            GoalImpactMode.NUTRITION_AND_TRAINING ||
          user.noTrainingPlanned
      }));
    const personalizationContext =
      await this.orchestrator.preparePersonalizationContext(
        {
          user,
          planQualityMode,
          planLocalDate: plan.planLocalDate,
          resolvedTrainingDay,
          appMode
        }
      );
    const selectionContext =
      this.orchestrator.buildExerciseSelectionContext({
        user,
        locale: this.resolvePlanningLocale(user),
        planLocalDate: plan.planLocalDate,
        planQualityMode,
        personalizationContext,
        resolvedTrainingDay
      });
    const selection =
      await this.trainingPlanAgent.selectCandidates({
        ...selectionContext,
        limitationsPresent: true
      });
    const proposalResult =
      this.painAwareExerciseReplacement.buildProposals({
        dailyPlanId: input.dailyPlanId,
        exercises,
        conflictingExerciseKeys,
        painAreas,
        avoidedMuscleGroups,
        selection
      });

    return {
      user,
      plan,
      currentPlan,
      proposalResult
    };
  }

  private toTrainingReplacementProposalResponse(
    result: TrainingReplacementProposalResult
  ) {
    return {
      status: result.status,
      painAreas: result.painAreas,
      avoidedMuscleGroups: result.avoidedMuscleGroups,
      proposals: result.proposals.map(
        ({
          replacementExercise: _replacementExercise,
          ...proposal
        }) => proposal
      ),
      unresolvedConflicts: result.unresolvedConflicts
    };
  }

  private getPlanExerciseMuscles(
    exercise: NonNullable<
      DailyPlanJson['training']['exercises']
    >[number]
  ) {
    const values = [
      ...(exercise.exerciseSnapshot?.targetMuscles ?? []),
      ...(exercise.exerciseSnapshot?.secondaryMuscles ?? []),
      ...(exercise.targetMuscles ?? [])
    ];

    return [
      ...new Set(
        values
          .map((value) =>
            String(value).trim().toUpperCase()
          )
          .filter(
            (value): value is TargetMuscleGroup =>
              Object.values(TargetMuscleGroup).includes(
                value as TargetMuscleGroup
              )
          )
      )
    ];
  }

  private async getPlanningUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: dailyPlanPlanningUserSelect
    });

    if (!user) {
      throw new UnauthorizedException(
        'Your session is no longer valid. Please log in again.'
      );
    }

    return user;
  }

  private async getOwnedPlanOrThrow(
    userId: string,
    dailyPlanId: string
  ) {
    const plan = await this.prisma.dailyPlan.findFirst({
      where: {
        id: dailyPlanId,
        userId
      }
    });

    if (!plan) {
      throw new NotFoundException('Daily plan not found.');
    }

    return plan;
  }

  private resolvePlanningLocale(
    user: DailyPlanPlanningUser
  ): SupportedLocale {
    switch (user.settings?.preferredLocale) {
      case PreferredLocale.RU_RU:
        return 'ru-RU';
      case PreferredLocale.FR_FR:
        return 'fr-FR';
      case PreferredLocale.ZH_CN:
        return 'zh-CN';
      case PreferredLocale.EN_US:
        return 'en-US';
      default:
        return resolveSupportedLocale(user.locale);
    }
  }
}
