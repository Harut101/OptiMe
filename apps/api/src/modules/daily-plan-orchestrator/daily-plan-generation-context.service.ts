import { Injectable, Logger } from '@nestjs/common';
import {
  GoalImpactMode,
  PlanFeedbackRating,
  PlanQualityMode,
  PlanStatus,
  PreferredLocale,
  TrainingLevel
} from '@prisma/client';
import {
  resolveSupportedLocale,
  type SupportedLocale
} from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import type { GenerateDailyPlanPersonalizationContext } from '../ai/ai-provider.interface';
import { DailyPlanCheckInsService } from '../daily-plan-check-ins/daily-plan-check-ins.service';
import { normalizeDailyPlanJson } from '../daily-plans/daily-plan-normalizer';
import { FeatureAccessService } from '../entitlements/feature-access.service';
import type {
  ExerciseSelectionContext,
  ExerciseSelectionResult
} from '../exercise-selection/exercise-selection.types';
import { FoodAvailabilityService } from '../food-availability/food-availability.service';
import { FoodLogsService } from '../food-logs/food-logs.service';
import { HealthService } from '../health/health.service';
import { NutritionTargetsService } from '../nutrition-targets/nutrition-targets.service';
import { ProtocolSelectorService } from '../protocol/protocol-selector.service';
import { TrainingPlanAgentService } from '../training-plan-agent/training-plan-agent.service';
import { TrainingScheduleResolverService } from '../training-schedule/training-schedule-resolver.service';
import type {
  DailyPlanGenerationContext,
  PrepareDailyPlanGenerationContextInput
} from './daily-plan-generation-context.interface';
import {
  type DailyPlanPlanningUser
} from './daily-plan-planning-user';

@Injectable()
export class DailyPlanGenerationContextService {
  private readonly logger = new Logger(
    DailyPlanGenerationContextService.name
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkInsService: DailyPlanCheckInsService,
    private readonly featureAccessService: FeatureAccessService,
    private readonly foodAvailabilityService: FoodAvailabilityService,
    private readonly foodLogsService: FoodLogsService,
    private readonly healthService: HealthService,
    private readonly nutritionTargetsService: NutritionTargetsService,
    private readonly protocolSelector: ProtocolSelectorService,
    private readonly trainingPlanAgent: TrainingPlanAgentService,
    private readonly trainingScheduleResolver: TrainingScheduleResolverService
  ) {}

  async prepare(
    input: PrepareDailyPlanGenerationContextInput
  ): Promise<DailyPlanGenerationContext> {
    const user = input.user;
    const locale = this.resolvePlanningLocale(user);
    const planQualityMode =
      await this.featureAccessService.getPlanQualityMode(user.id);
    const availableFoodSlugs =
      await this.foodAvailabilityService.getAvailableFoodSlugs(
        user.id,
        input.planLocalDate
      );
    const appMode = this.resolveAppMode(user);
    const trainingEnabled =
      appMode === GoalImpactMode.NUTRITION_AND_TRAINING;
    const resolvedTrainingDay =
      await this.trainingScheduleResolver.resolveForUser({
        userId: user.id,
        planLocalDate: input.planLocalDate,
        trainingPreference: user.trainingPreference,
        legacyScheduleItems: user.schedules,
        noTrainingPlanned: !trainingEnabled || user.noTrainingPlanned
      });
    const nutritionTarget = await this.nutritionTargetsService.getPreview(
      user.id,
      input.planLocalDate
    );
    const personalizationContext = await this.preparePersonalizationContext(
      user,
      planQualityMode,
      input.planLocalDate,
      resolvedTrainingDay,
      appMode
    );
    personalizationContext.nutritionTarget = nutritionTarget;
    const exerciseSelection = trainingEnabled
      ? await this.trainingPlanAgent.selectCandidates(
          this.buildExerciseSelectionContext(
            user,
            locale,
            input.planLocalDate,
            planQualityMode,
            personalizationContext,
            resolvedTrainingDay
          )
        )
      : this.createEmptyExerciseSelection();

    if (trainingEnabled) {
      this.logExerciseSelection(exerciseSelection, personalizationContext);
    } else {
      this.logger.log('exercise selection skipped; appMode=NUTRITION_ONLY');
    }

    return {
      locale,
      planQualityMode,
      availableFoodSlugs,
      appMode,
      trainingEnabled,
      resolvedTrainingDay,
      nutritionTarget,
      personalizationContext,
      exerciseSelection,
      blockedFoods: {
        allergies:
          user.nutritionPref?.allergies.map((food) => food.name) ?? [],
        excludedFoods:
          user.nutritionPref?.excludedFoods.map((food) => food.name) ?? []
      }
    };
  }

  async preparePersonalizationContext(
    user: DailyPlanPlanningUser,
    planQualityMode: PlanQualityMode,
    planLocalDate: string,
    resolvedTrainingDay: DailyPlanGenerationContext['resolvedTrainingDay'],
    appMode: GoalImpactMode
  ): Promise<GenerateDailyPlanPersonalizationContext> {
    const trainingEnabled =
      appMode === GoalImpactMode.NUTRITION_AND_TRAINING;
    const [checkInSummary, foodAdherenceSummary, healthPlanningContext] =
      await Promise.all([
        this.checkInsService.getRecentSummary(user.id),
        this.foodLogsService.getRecentSummary(user.id, planLocalDate),
        this.healthService.getRecentHealthSummariesForPlanning(user.id, {
          planLocalDate,
          days: 7
        })
      ]);
    this.logger.log(
      [
        'daily plan health context resolved',
        `available=${healthPlanningContext.available}`,
        `wearableContextUsed=${Boolean(healthPlanningContext.wearableContext)}`,
        `wearableStale=${healthPlanningContext.wearableContext?.isStale ?? false}`,
        `trainingLoadReadiness=${healthPlanningContext.trainingLoadContext.readinessHint}`
      ].join('; ')
    );
    const trainingPreference = user.trainingPreference;
    const selectedProtocols = this.protocolSelector.select({
      profile: user.profile,
      goal: user.goal,
      safeMode: user.safeMode,
      isMinor: user.isMinor,
      noTrainingPlanned:
        !trainingEnabled || !resolvedTrainingDay.isTrainingDay,
      trainingSchedule:
        trainingEnabled && resolvedTrainingDay.isTrainingDay
          ? [
              {
                durationMinutes: resolvedTrainingDay.durationMinutes,
                intensity: 'MODERATE',
                description:
                  resolvedTrainingDay.source === 'DAILY_OVERRIDE'
                    ? `Daily override: ${resolvedTrainingDay.dayOfWeek}`
                    : resolvedTrainingDay.source === 'WEEKLY_SCHEDULE'
                      ? `Weekly schedule: ${resolvedTrainingDay.dayOfWeek}`
                      : null
              }
            ]
          : [],
      trainingPreference,
      checkInSummary,
      healthPlanningContext,
      planQualityMode
    });
    const baseContext: GenerateDailyPlanPersonalizationContext = {
      mode: planQualityMode,
      contextLevel: this.getContextLevel(planQualityMode),
      guidance: this.getPersonalizationGuidance(planQualityMode),
      appMode,
      trainingEnabled,
      ...(trainingPreference
        ? {
            trainingPreference: {
              targetMuscleGroups: trainingPreference.targetMuscleGroups,
              trainingOutcome: trainingPreference.trainingOutcome,
              equipment: trainingPreference.equipment,
              trainingLevel: trainingPreference.trainingLevel,
              limitationsOrPainAreas:
                trainingPreference.limitationsOrPainAreas,
              preferredTrainingDays:
                trainingPreference.preferredTrainingDays,
              limitationsAreSafetySensitive:
                trainingPreference.limitationsOrPainAreas.length > 0
            }
          }
        : {}),
      trainingPersonalization: trainingEnabled
        ? this.getTrainingPersonalizationContext(planQualityMode)
        : {
            usesSchedule: false,
            usesTrainingDescriptions: false,
            exerciseDetailLevel: 'simple' as const,
            futureSignals: []
          },
      selectedProtocols,
      checkInSummary,
      healthPlanningContext
    };

    if (planQualityMode === PlanQualityMode.BASIC) {
      return baseContext;
    }

    const feedbackLimit =
      planQualityMode === PlanQualityMode.ADAPTIVE ? 10 : 5;
    const historyLimit =
      planQualityMode === PlanQualityMode.ADAPTIVE ? 10 : 5;
    const [recentFeedback, recentPlans] = await Promise.all([
      this.prisma.dailyPlanFeedback.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        take: feedbackLimit,
        select: { rating: true, tags: true }
      }),
      this.prisma.dailyPlan.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        take: historyLimit,
        select: {
          status: true,
          readinessLevel: true,
          planLocalDate: true,
          planTimezone: true,
          planJson: true
        }
      })
    ]);

    return {
      ...baseContext,
      ...(foodAdherenceSummary ? { foodAdherenceSummary } : {}),
      feedbackSummary: {
        helpfulCount: recentFeedback.filter(
          (feedback) => feedback.rating === PlanFeedbackRating.HELPFUL
        ).length,
        notHelpfulCount: recentFeedback.filter(
          (feedback) => feedback.rating === PlanFeedbackRating.NOT_HELPFUL
        ).length,
        commonTags: this.getCommonFeedbackTags(
          recentFeedback.flatMap((feedback) => feedback.tags)
        )
      },
      historySummary: {
        recentPlanCount: recentPlans.length,
        readinessLevels: [
          ...new Set(recentPlans.map((plan) => plan.readinessLevel))
        ],
        fallbackCount: recentPlans.filter((plan) =>
          this.wasSafelyAdjustedPlan(plan)
        ).length
      }
    };
  }

  buildExerciseSelectionContext(
    user: DailyPlanPlanningUser,
    locale: SupportedLocale,
    planLocalDate: string,
    planQualityMode: PlanQualityMode,
    personalizationContext: GenerateDailyPlanPersonalizationContext,
    resolvedTrainingDay: DailyPlanGenerationContext['resolvedTrainingDay']
  ): ExerciseSelectionContext {
    const healthSignals =
      personalizationContext.healthPlanningContext?.signals;
    return {
      locale,
      planDate: planLocalDate,
      protocol: personalizationContext.selectedProtocols!.trainingProtocol,
      environment: resolvedTrainingDay.environment ?? undefined,
      availableEquipment: resolvedTrainingDay.availableEquipment,
      trainingLevel:
        user.trainingPreference?.trainingLevel ?? TrainingLevel.BEGINNER,
      targetMuscles: resolvedTrainingDay.targetMuscles,
      workoutDurationMinutes: resolvedTrainingDay.isTrainingDay
        ? resolvedTrainingDay.durationMinutes
        : 0,
      limitationsPresent:
        (user.trainingPreference?.limitationsOrPainAreas.length ?? 0) > 0,
      pregnancyStatus: user.profile?.pregnancyStatus,
      safeMode: user.safeMode,
      isMinor: user.isMinor,
      healthSignals: {
        lowSleep: healthSignals?.lowSleep ?? false,
        highActivity: healthSignals?.highActivityYesterday ?? false,
        lowStepTrend: healthSignals?.lowStepTrend ?? false
      },
      qualityMode: planQualityMode
    };
  }

  private resolvePlanningLocale(user: DailyPlanPlanningUser): SupportedLocale {
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

  resolveAppMode(user: DailyPlanPlanningUser) {
    return (
      user.goal?.impactMode ??
      (user.noTrainingPlanned
        ? GoalImpactMode.NUTRITION_ONLY
        : GoalImpactMode.NUTRITION_AND_TRAINING)
    );
  }

  private createEmptyExerciseSelection(): ExerciseSelectionResult {
    return {
      candidates: [],
      requestedExerciseCount: 0,
      minExerciseCount: 0,
      maxExerciseCount: 0,
      candidatePoolLimit: 0,
      workoutDurationMinutes: 0,
      volumePlan: {
        targetExerciseCount: 0,
        minExerciseCount: 0,
        maxExerciseCount: 0,
        suggestedSetsPerExercise: 0,
        suggestedRestSeconds: 0,
        estimatedSessionMinutes: 0,
        warmupMinutes: 0,
        cooldownMinutes: 0,
        transitionSecondsPerExercise: 0,
        volumeReasonCodes: ['REST_DAY']
      },
      normalizedTargetMuscles: [],
      fallbackMode: 'NONE',
      internalExclusionSummary: {}
    };
  }

  private logExerciseSelection(
    selection: ExerciseSelectionResult,
    personalizationContext: GenerateDailyPlanPersonalizationContext
  ) {
    this.logger.log(
      [
        `exercise selection completed; protocol=${personalizationContext.selectedProtocols?.trainingProtocol.id ?? 'unknown'}`,
        `qualityMode=${personalizationContext.mode}`,
        `candidateCount=${selection.candidates.length}`,
        `requestedExerciseCount=${selection.requestedExerciseCount}`,
        `minExerciseCount=${selection.minExerciseCount}`,
        `maxExerciseCount=${selection.maxExerciseCount}`,
        `durationMinutes=${selection.workoutDurationMinutes}`,
        `sets=${selection.volumePlan.suggestedSetsPerExercise}`,
        `restSeconds=${selection.volumePlan.suggestedRestSeconds}`,
        `volumeReasons=${selection.volumePlan.volumeReasonCodes.join(',') || 'none'}`,
        `fallbackMode=${selection.fallbackMode}`,
        `resolvedLocale=${selection.candidates[0]?.resolvedLocale ?? 'en-US'}`,
        `exclusions=${JSON.stringify(selection.internalExclusionSummary)}`
      ].join('; ')
    );
  }

  private wasSafelyAdjustedPlan(plan: {
    status: PlanStatus;
    planLocalDate: string;
    planTimezone: string;
    readinessLevel: string;
    planJson: unknown;
  }) {
    if (plan.status === PlanStatus.FALLBACK) return true;
    const normalized = normalizeDailyPlanJson({
      planJson: plan.planJson,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      readinessLevel: plan.readinessLevel
    });
    return (normalized.debug?.generation?.adjustedSections.length ?? 0) > 0;
  }

  private getContextLevel(planQualityMode: PlanQualityMode) {
    switch (planQualityMode) {
      case PlanQualityMode.ADAPTIVE:
        return 'adaptive' as const;
      case PlanQualityMode.PERSONALIZED:
        return 'personalized' as const;
      default:
        return 'minimal' as const;
    }
  }

  private getPersonalizationGuidance(planQualityMode: PlanQualityMode) {
    switch (planQualityMode) {
      case PlanQualityMode.ADAPTIVE:
        return [
          'Use recent feedback and plan history summaries to adapt the plan.',
          'Time meals around scheduled training when helpful.',
          'Use readiness placeholders for future recovery, sleep, strain, and WHOOP signals.',
          'Make training guidance adaptive without inventing unavailable recovery data.'
        ];
      case PlanQualityMode.PERSONALIZED:
        return [
          'Use preferences, schedule, goal, and feedback summaries more strongly.',
          'Make meals and training more specific than BASIC.',
          'Suggest practical exercises from current schedule and descriptions when safe.'
        ];
      default:
        return [
          'Keep the plan simple, safe, and practical.',
          'Use limited context and avoid advanced progression.'
        ];
    }
  }

  private getTrainingPersonalizationContext(
    planQualityMode: PlanQualityMode
  ) {
    const futureSignals = [
      'targetMuscleGroups',
      'trainingOutcome',
      'equipment',
      'trainingLevel',
      'limitationsOrPainAreas'
    ];
    if (planQualityMode === PlanQualityMode.ADAPTIVE) {
      return {
        usesSchedule: true,
        usesTrainingDescriptions: true,
        exerciseDetailLevel: 'adaptive' as const,
        futureSignals: [
          ...futureSignals,
          'whoopRecovery',
          'whoopSleep',
          'whoopStrain'
        ]
      };
    }
    return {
      usesSchedule: true,
      usesTrainingDescriptions:
        planQualityMode === PlanQualityMode.PERSONALIZED,
      exerciseDetailLevel:
        planQualityMode === PlanQualityMode.PERSONALIZED
          ? ('sets_reps_rest' as const)
          : ('simple' as const),
      futureSignals
    };
  }

  private getCommonFeedbackTags(tags: string[]) {
    const counts = new Map<string, number>();
    tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
  }
}
