import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiOperationFeature,
  AiOperationProvider,
  AiOperationStatus,
  DailyReadinessLevel,
  GoalImpactMode,
  PlanFeedbackRating,
  PlanQualityMode,
  PlanStatus,
  Prisma,
  PreferredLocale,
  TrainingLevel,
  UsageFeature,
  UsagePeriodType
} from '@prisma/client';
import {
  resolveSupportedLocale,
  type NutritionTarget,
  type ResolvedTrainingDayContext,
  type SupportedLocale
} from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { AiOperationLogsService } from '../ai-operation-logs/ai-operation-logs.service';
import {
  AiProvider,
  GenerateDailyPlanExerciseFeedback,
  GenerateDailyPlanPersonalizationContext,
  GenerateDailyPlanSafetyFeedback
} from '../ai/ai-provider.interface';
import { AI_PROVIDER } from '../ai/ai-provider.token';
import { OpenAiProviderError } from '../ai/open-ai-provider.error';
import { DailyPlanCheckInsService } from '../daily-plan-check-ins/daily-plan-check-ins.service';
import { FeatureAccessService } from '../entitlements/feature-access.service';
import {
  composeDeterministicFallbackWorkout,
  validateAndNormalizePlannedExercises
} from '../exercise-selection/exercise-plan-validator';
import { ExerciseSelectionService } from '../exercise-selection/exercise-selection.service';
import type { ExerciseSelectionContext, ExerciseSelectionResult } from '../exercise-selection/exercise-selection.types';
import { HealthService } from '../health/health.service';
import { NutritionTargetsService } from '../nutrition-targets/nutrition-targets.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { ProtocolSelectorService } from '../protocol/protocol-selector.service';
import { SelectedProtocols } from '../protocol/protocol.types';
import { createSafeFallbackPlan } from '../safety/safe-fallback-plan.factory';
import { SafetyService } from '../safety/safety.service';
import { SafetyAgent, ReviewDailyPlanInput } from '../safety-agent/safety-agent.interface';
import { SafetyAgentError } from '../safety-agent/safety-agent.error';
import { safetyAgentReviewSchema } from '../safety-agent/safety-agent-review.schema';
import {
  SAFETY_AGENT,
  SAFETY_AGENT_CONFIG,
  SafetyAgentConfig
} from '../safety-agent/safety-agent.token';
import { UsageGuardService } from '../usage/usage-guard.service';
import { TrainingScheduleResolverService } from '../training-schedule/training-schedule-resolver.service';
import { normalizeDailyPlanFoodNames } from './daily-plan-food-name-normalizer';
import { DailyPlanJson, dailyPlanJsonSchema } from './daily-plan-json.schema';
import { normalizeDailyPlanJson } from './daily-plan-normalizer';
import { GenerateDailyPlanDto } from './dto/generate-daily-plan.dto';
import { SubmitDailyPlanFeedbackDto } from './dto/submit-daily-plan-feedback.dto';

interface DailyPlanValidationResult {
  status: PlanStatus;
  planJson: DailyPlanJson;
  safetyRetryRequest?: GenerateDailyPlanSafetyFeedback;
}

@Injectable()
export class DailyPlansService {
  private readonly logger = new Logger(DailyPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly safetyService: SafetyService,
    private readonly aiOperationLogs: AiOperationLogsService,
    private readonly featureAccessService: FeatureAccessService,
    private readonly exerciseSelectionService: ExerciseSelectionService,
    private readonly usageGuardService: UsageGuardService,
    private readonly onboardingService: OnboardingService,
    private readonly checkInsService: DailyPlanCheckInsService,
    private readonly healthService: HealthService,
    private readonly nutritionTargetsService: NutritionTargetsService,
    private readonly protocolSelector: ProtocolSelectorService,
    private readonly trainingScheduleResolver: TrainingScheduleResolverService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
    @Inject(SAFETY_AGENT) private readonly safetyAgent: SafetyAgent,
    @Inject(SAFETY_AGENT_CONFIG) private readonly safetyAgentConfig: SafetyAgentConfig
  ) {}

  async getTodayPlan(userId: string) {
    const user = await this.getPlanningUser(userId);
    const { planLocalDate, planTimezone } = this.getLocalPlanDate(user.timezone);

    const plan = await this.prisma.dailyPlan.findUnique({
      where: {
        userId_planLocalDate_planTimezone: {
          userId,
          planLocalDate,
          planTimezone
        }
      }
    });

    return plan ? this.toResponse(plan) : null;
  }

  async getHistory(userId: string, limit?: string) {
    const take = this.normalizeHistoryLimit(limit);
    const plans = await this.prisma.dailyPlan.findMany({
      where: { userId },
      orderBy: [{ planLocalDate: 'desc' }, { updatedAt: 'desc' }],
      take
    });

    return {
      items: plans.map((plan) => this.toResponse(plan))
    };
  }

  async generateTodayPlan(userId: string, dto: GenerateDailyPlanDto) {
    const user = await this.getPlanningUser(userId);
    const { planLocalDate, planTimezone } = this.getLocalPlanDate(user.timezone);

    const existingPlan = await this.prisma.dailyPlan.findUnique({
      where: {
        userId_planLocalDate_planTimezone: {
          userId,
          planLocalDate,
          planTimezone
        }
      }
    });

    if (existingPlan && !dto.forceRegenerate) {
      return this.toResponse(existingPlan);
    }

    this.assertReadyToGenerate(user);
    await this.consumeDailyPlanUsage(userId, Boolean(existingPlan && dto.forceRegenerate));

    const operationStartedAt = Date.now();

    try {
      this.logger.log(`daily plan generation started; provider=${this.getProviderDebugName()}`);
      const planQualityMode = await this.featureAccessService.getPlanQualityMode(userId);
      const appMode = this.resolveAppMode(user);
      const trainingEnabled = appMode === GoalImpactMode.NUTRITION_AND_TRAINING;
      const resolvedTrainingDay = await this.trainingScheduleResolver.resolveForUser({
        userId,
        planLocalDate,
        trainingPreference: user.trainingPreference,
        legacyScheduleItems: user.schedules,
        noTrainingPlanned: !trainingEnabled || user.noTrainingPlanned
      });
      const nutritionTarget = await this.nutritionTargetsService.getPreview(userId, planLocalDate);
      const personalizationContext = await this.buildPersonalizationContext(
        user,
        planQualityMode,
        planLocalDate,
        resolvedTrainingDay,
        appMode
      );
      personalizationContext.nutritionTarget = nutritionTarget;
      const exerciseSelection = trainingEnabled
        ? await this.exerciseSelectionService.selectCandidates(
            this.buildExerciseSelectionContext(user, planLocalDate, planQualityMode, personalizationContext, resolvedTrainingDay)
          )
        : this.createEmptyExerciseSelection();
      if (trainingEnabled) {
        this.logExerciseSelection(exerciseSelection, personalizationContext);
      } else {
        this.logger.log('exercise selection skipped; appMode=NUTRITION_ONLY');
      }
      const blockedFoods = {
        allergies: user.nutritionPref?.allergies.map((food) => food.name) ?? [],
        excludedFoods: user.nutritionPref?.excludedFoods.map((food) => food.name) ?? []
      };
      let providerPlanResult = await this.generateProviderPlanOrFallback({
        user,
        planLocalDate,
        planTimezone,
        planQualityMode,
        personalizationContext,
        exerciseSelection
      });
      providerPlanResult = {
        ...providerPlanResult,
        planJson: this.withTrainingStateForAppMode(
          this.withNutritionTargetSnapshot(
            this.withTrainingScheduleSnapshot(providerPlanResult.planJson, resolvedTrainingDay),
            nutritionTarget
          ),
          appMode
        )
      };
      let exercisePreparation = await this.prepareLibraryBackedExercises({
        providerPlanResult,
        user,
        planLocalDate,
        planTimezone,
        planQualityMode,
        personalizationContext,
        exerciseSelection,
        allowAiRetry: this.getProviderDebugName() === 'openai'
      });
      providerPlanResult = {
        status: exercisePreparation.status,
        planJson: exercisePreparation.planJson
      };
      let safePlanResult = await this.validateProviderPlan({
        providerPlan: providerPlanResult.planJson,
        blockedFoods,
        planLocalDate,
        planTimezone,
        user,
        personalizationContext,
        forcedFallback: providerPlanResult.status === PlanStatus.FALLBACK,
        allowSafetyRetry: this.canUseSafetyFeedbackRetry(providerPlanResult.status)
      });

      if (safePlanResult.safetyRetryRequest) {
        this.logger.log(
          `safety retry triggered=true; reasonCount=${safePlanResult.safetyRetryRequest.reasons.length}`
        );
        this.logger.log('safety retry generation started');
        const retryProviderPlanResult = await this.generateProviderPlanOrFallback({
          user,
          planLocalDate,
          planTimezone,
          planQualityMode,
          personalizationContext,
          exerciseSelection,
          safetyFeedback: safePlanResult.safetyRetryRequest
        });
        retryProviderPlanResult.planJson = this.withTrainingScheduleSnapshot(
          retryProviderPlanResult.planJson,
          resolvedTrainingDay
        );
        retryProviderPlanResult.planJson = this.withNutritionTargetSnapshot(
          retryProviderPlanResult.planJson,
          nutritionTarget
        );
        retryProviderPlanResult.planJson = this.withTrainingStateForAppMode(
          retryProviderPlanResult.planJson,
          appMode
        );
        const retryExercisePreparation = await this.prepareLibraryBackedExercises({
          providerPlanResult: retryProviderPlanResult,
          user,
          planLocalDate,
          planTimezone,
          planQualityMode,
          personalizationContext,
          exerciseSelection,
          allowAiRetry: false
        });
        exercisePreparation = {
          ...retryExercisePreparation,
          usedAiRetry: exercisePreparation.usedAiRetry || retryExercisePreparation.usedAiRetry,
          usedDeterministicFallback:
            exercisePreparation.usedDeterministicFallback ||
            retryExercisePreparation.usedDeterministicFallback
        };

        safePlanResult = await this.validateProviderPlan({
          providerPlan: retryExercisePreparation.planJson,
          blockedFoods,
          planLocalDate,
          planTimezone,
          user,
          personalizationContext,
          forcedFallback: retryExercisePreparation.status === PlanStatus.FALLBACK,
          allowSafetyRetry: false,
          safetyRetryUsed: true
        });

        if (retryExercisePreparation.status === PlanStatus.FALLBACK) {
          const retryFallbackReason =
            this.getFallbackReason(retryProviderPlanResult.planJson) === 'schema_validation_failed'
              ? 'safety_agent_retry_invalid_output'
              : 'safety_agent_retry_failed';
          safePlanResult = {
            status: PlanStatus.FALLBACK,
            planJson: this.createSafetyAgentFallback({
              planLocalDate,
              planTimezone,
              fallbackReason: retryFallbackReason,
              retryUsed: true,
              retryResult: 'failed'
            }).planJson
          };
        }
      } else {
        this.logger.log('safety retry triggered=false');
      }
      safePlanResult = {
        ...safePlanResult,
        planJson: this.withPlanDebugContext(
          this.withNutritionTargetSnapshot(safePlanResult.planJson, nutritionTarget),
          planQualityMode,
          personalizationContext.selectedProtocols,
          personalizationContext.healthPlanningContext
        )
      };
      safePlanResult.planJson = this.withExerciseSelectionDebug(
        safePlanResult.planJson,
        exerciseSelection,
        exercisePreparation.usedAiRetry,
        exercisePreparation.usedDeterministicFallback
      );
      const planJson = safePlanResult.planJson as Prisma.JsonObject;
      const status = safePlanResult.status;
      const finalExerciseIds = (safePlanResult.planJson.training.exercises ?? [])
        .map((exercise) => exercise.exerciseId)
        .filter((exerciseId): exerciseId is string => Boolean(exerciseId));
      this.logger.log(`exercise selection finalized; exerciseIds=${JSON.stringify(finalExerciseIds)}`);
      this.logger.log(
        `daily plan generation completed; fallback used: ${status === PlanStatus.FALLBACK}; final status=${status}`
      );

      const plan = existingPlan
        ? await this.prisma.dailyPlan.update({
            where: { id: existingPlan.id },
            data: {
              status,
              readinessLevel: DailyReadinessLevel.MAINTAIN,
              planJson,
              createdByAi: false
            }
          })
        : await this.prisma.dailyPlan.create({
            data: {
              userId,
              planLocalDate,
              planTimezone,
              status,
              readinessLevel: DailyReadinessLevel.MAINTAIN,
              planJson,
              createdByAi: false
            }
          });

      await this.recordDailyPlanAiOperation({
        userId,
        status,
        planJson: safePlanResult.planJson,
        latencyMs: Date.now() - operationStartedAt
      });

      return this.toResponse(plan);
    } catch (error) {
      await this.recordDailyPlanAiOperationError({
        userId,
        latencyMs: Date.now() - operationStartedAt,
        error
      });
      throw error;
    }
  }

  async submitFeedback(userId: string, dailyPlanId: string, dto: SubmitDailyPlanFeedbackDto) {
    const plan = await this.prisma.dailyPlan.findFirst({
      where: {
        id: dailyPlanId,
        userId
      },
      select: { id: true }
    });

    if (!plan) {
      throw new NotFoundException('Daily plan not found.');
    }

    const feedback = await this.prisma.dailyPlanFeedback.upsert({
      where: {
        userId_dailyPlanId: {
          userId,
          dailyPlanId
        }
      },
      update: {
        rating: dto.rating,
        tags: dto.tags ?? [],
        notes: dto.notes?.trim() || null
      },
      create: {
        userId,
        dailyPlanId,
        rating: dto.rating,
        tags: dto.tags ?? [],
        notes: dto.notes?.trim() || null
      }
    });

    return {
      id: feedback.id,
      dailyPlanId: feedback.dailyPlanId,
      rating: feedback.rating,
      tags: feedback.tags,
      notes: feedback.notes,
      createdAt: feedback.createdAt.toISOString(),
      updatedAt: feedback.updatedAt.toISOString()
    };
  }

  private async getPlanningUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        timezone: true,
        locale: true,
        isMinor: true,
        safeMode: true,
        noTrainingPlanned: true,
        privacyConsentedAt: true,
        settings: { select: { preferredLocale: true } },
        profile: {
          select: {
            gender: true,
            pregnancyStatus: true,
            dateOfBirth: true,
            heightCm: true,
            weightKg: true,
            activityLevel: true
          }
        },
        goal: {
          select: {
            goalType: true,
            primaryGoal: true,
            targetWeightKg: true,
            targetTimelineDays: true,
            impactMode: true
          }
        },
        nutritionPref: {
          select: {
            dietType: true,
            mealsPerDay: true,
            notes: true,
            noKnownAllergiesConfirmed: true,
            allergies: {
              select: { name: true }
            },
            excludedFoods: {
              select: { name: true }
            },
            preferredFoods: {
              select: { name: true }
            }
          }
        },
        schedules: {
          select: {
            dayOfWeek: true,
            localTime: true,
            sportType: true,
            durationMinutes: true,
            intensity: true,
            description: true
          },
          orderBy: [{ dayOfWeek: 'asc' }, { localTime: 'asc' }]
        },
        weeklyTrainingSchedule: {
          select: { isActive: true }
        },
        trainingPreference: {
          select: {
            targetMuscleGroups: true,
            trainingOutcome: true,
            equipment: true,
            trainingLevel: true,
            limitationsOrPainAreas: true,
            preferredTrainingDays: true
          }
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException('Your session is no longer valid. Please log in again.');
    }

    return user;
  }

  private getLocalPlanDate(timezone: string) {
    const safeTimezone = this.normalizeTimezone(timezone);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return {
      planLocalDate: `${year}-${month}-${day}`,
      planTimezone: safeTimezone
    };
  }

  private normalizeTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
      return timezone;
    } catch {
      return 'UTC';
    }
  }

  private normalizeHistoryLimit(limit?: string) {
    const parsedLimit = Number(limit);

    if (!Number.isFinite(parsedLimit)) {
      return 10;
    }

    return Math.min(Math.max(Math.trunc(parsedLimit), 1), 30);
  }

  private assertReadyToGenerate(user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>) {
    const readiness = this.onboardingService.evaluateStage1Readiness(user);

    if (!readiness.canGenerateFirstPlan) {
      throw new BadRequestException({
        message: 'Please complete the required onboarding basics before generating a daily plan.',
        code: 'ONBOARDING_STAGE_1_INCOMPLETE',
        missingStage1Fields: readiness.missingStage1Fields
      });
    }
  }

  private async consumeDailyPlanUsage(userId: string, isRefresh: boolean) {
    const productFeature = isRefresh
      ? UsageFeature.DAILY_PLAN_REFRESH
      : UsageFeature.DAILY_PLAN_GENERATION;
    const usageChecks: Array<{ feature: UsageFeature; periodType: UsagePeriodType }> = [
      {
        feature: productFeature,
        periodType: UsagePeriodType.DAILY
      }
    ];

    if (this.getProviderDebugName() === 'openai') {
      usageChecks.push({
        feature: UsageFeature.AI_DAILY_PLAN_GENERATION,
        periodType: UsagePeriodType.DAILY
      });
    }

    await Promise.all(
      usageChecks.map((check) =>
        this.usageGuardService.assertCanUse(userId, check.feature, check.periodType)
      )
    );

    for (const check of usageChecks) {
      await this.usageGuardService.checkAndConsume(userId, check.feature, check.periodType);
    }
  }

  private async generateProviderPlanOrFallback(input: {
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>;
    planLocalDate: string;
    planTimezone: string;
    planQualityMode: PlanQualityMode;
    personalizationContext: GenerateDailyPlanPersonalizationContext;
    exerciseSelection: ExerciseSelectionResult;
    exerciseFeedback?: GenerateDailyPlanExerciseFeedback;
    safetyFeedback?: GenerateDailyPlanSafetyFeedback;
  }) {
    try {
      this.logger.log(`provider called: ${this.getProviderDebugName()}`);
      const planJson = await this.aiProvider.generateDailyPlan({
        user: {
          id: input.user.id,
          firstName: input.user.firstName,
          timezone: input.user.timezone,
          isMinor: input.user.isMinor,
          safeMode: input.user.safeMode
        },
        profile: input.user.profile,
        goal: input.user.goal,
        nutritionPreference: input.user.nutritionPref
          ? {
              dietType: input.user.nutritionPref.dietType,
              mealsPerDay: input.user.nutritionPref.mealsPerDay,
              notes: input.user.nutritionPref.notes,
              allergies: input.user.nutritionPref.allergies.map((food) => food.name),
              excludedFoods: input.user.nutritionPref.excludedFoods.map((food) => food.name),
              preferredFoods: input.user.nutritionPref.preferredFoods.map((food) => food.name)
            }
          : null,
        trainingSchedule: input.user.schedules,
        safeMode: input.user.safeMode,
        planLocalDate: input.planLocalDate,
        planTimezone: input.planTimezone,
        planQualityMode: input.planQualityMode,
        personalizationContext: input.personalizationContext,
        exerciseSelection: {
          candidates: input.exerciseSelection.candidates.map(({
            internalScore: _score,
            internalReasonCodes: _reasons,
            contraindicationTags: _tags,
            exerciseUpdatedAt: _updatedAt,
            ...candidate
          }) => candidate),
          requestedExerciseCount: input.exerciseSelection.requestedExerciseCount,
          workoutDurationMinutes: input.exerciseSelection.workoutDurationMinutes
        },
        exerciseFeedback: input.exerciseFeedback,
        safetyFeedback: input.safetyFeedback
      });

      return {
        status: PlanStatus.READY,
        planJson
      };
    } catch (error) {
      if (error instanceof OpenAiProviderError) {
        this.logger.warn(`fallback used: true; fallback reason=${error.fallbackReason}`);
        return {
          status: PlanStatus.FALLBACK,
          planJson: createSafeFallbackPlan({
            planLocalDate: input.planLocalDate,
            planTimezone: input.planTimezone,
            reasons: [error.fallbackReason]
          })
        };
      }

      throw error;
    }
  }

  private async prepareLibraryBackedExercises(input: {
    providerPlanResult: { status: PlanStatus; planJson: DailyPlanJson };
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>;
    planLocalDate: string;
    planTimezone: string;
    planQualityMode: PlanQualityMode;
    personalizationContext: GenerateDailyPlanPersonalizationContext;
    exerciseSelection: ExerciseSelectionResult;
    allowAiRetry: boolean;
  }) {
    const unchanged = {
      status: input.providerPlanResult.status,
      planJson: input.providerPlanResult.planJson,
      usedAiRetry: false,
      usedDeterministicFallback: false
    };
    if (input.providerPlanResult.status === PlanStatus.FALLBACK) return unchanged;

    const parsed = dailyPlanJsonSchema.safeParse(input.providerPlanResult.planJson);
    if (!parsed.success) return unchanged;
    const validation = validateAndNormalizePlannedExercises(parsed.data, input.exerciseSelection);
    if (validation.valid) return { ...unchanged, planJson: validation.planJson };

    this.logger.warn(`exercise selection validation failed; reasons=${validation.reasonCodes.join(',')}`);
    if (input.allowAiRetry) {
      this.logger.log(`exercise selection retry triggered=true; reasonCount=${validation.reasonCodes.length}`);
      const retry = await this.generateProviderPlanOrFallback({
        user: input.user,
        planLocalDate: input.planLocalDate,
        planTimezone: input.planTimezone,
        planQualityMode: input.planQualityMode,
        personalizationContext: input.personalizationContext,
        exerciseSelection: input.exerciseSelection,
        exerciseFeedback: { reasonCodes: validation.reasonCodes }
      });
      if (retry.status === PlanStatus.READY) {
        const retryParsed = dailyPlanJsonSchema.safeParse(retry.planJson);
        if (retryParsed.success) {
          const retryValidation = validateAndNormalizePlannedExercises(retryParsed.data, input.exerciseSelection);
          if (retryValidation.valid) {
            this.logger.log('exercise selection retry validation passed=true');
            return { status: PlanStatus.READY, planJson: retryValidation.planJson, usedAiRetry: true, usedDeterministicFallback: false };
          }
          this.logger.warn(`exercise selection retry validation passed=false; reasons=${retryValidation.reasonCodes.join(',')}`);
        }
      }
    } else {
      this.logger.log('exercise selection retry triggered=false');
    }

    this.logger.warn('deterministic exercise fallback used=true');
    return {
      status: PlanStatus.READY,
      planJson: composeDeterministicFallbackWorkout(parsed.data, input.exerciseSelection),
      usedAiRetry: input.allowAiRetry,
      usedDeterministicFallback: true
    };
  }

  private validateProviderPlan(input: {
    providerPlan: unknown;
    blockedFoods: { allergies: string[]; excludedFoods: string[] };
    planLocalDate: string;
    planTimezone: string;
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>;
    personalizationContext: GenerateDailyPlanPersonalizationContext;
    forcedFallback?: boolean;
    allowSafetyRetry?: boolean;
    safetyRetryUsed?: boolean;
  }): DailyPlanValidationResult | Promise<DailyPlanValidationResult> {
    const parsedPlan = dailyPlanJsonSchema.safeParse(input.providerPlan);

    if (!parsedPlan.success) {
      this.logger.warn('schema validation passed: false; fallback used: true');
      const fallbackPlan = createSafeFallbackPlan({
        planLocalDate: input.planLocalDate,
        planTimezone: input.planTimezone,
        reasons: [
          input.safetyRetryUsed
            ? 'safety_agent_retry_invalid_output'
            : 'The generated plan could not be safely validated.'
        ]
      });

      return {
        status: PlanStatus.FALLBACK,
        planJson: input.safetyRetryUsed
          ? this.withSafetyAgentDebug(fallbackPlan, {
              retryUsed: true,
              retryResult: 'failed'
            })
          : fallbackPlan
      };
    }

    const normalizedFoodNames = normalizeDailyPlanFoodNames(parsedPlan.data, input.blockedFoods);

    normalizedFoodNames.normalizedPaths.forEach((path) => {
      this.logger.log(`Food name normalized: path=${path}`);
    });

    const planSafety = this.safetyService.validatePlanFoodSafety(
      normalizedFoodNames.planJson,
      input.blockedFoods
    );

    if (!planSafety.passed) {
      const firstConflict = planSafety.conflicts[0];
      this.logger.warn(
        [
          'SafetyService failed',
          firstConflict
            ? `${firstConflict.conflictType} conflict at ${firstConflict.matchedPath}; restrictedFood=${firstConflict.restrictedFood}; matchedFoodName=${firstConflict.matchedFoodName ?? 'unknown'}`
            : `fallback reason=${planSafety.reasons.join(' | ')}`
        ].join(': ')
      );
      return {
        status: PlanStatus.FALLBACK,
        planJson: createSafeFallbackPlan({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          reasons: planSafety.reasons
        })
      };
    }

    const pregnancyPlanSafety = this.safetyService.validatePregnancySensitivePlanSafety(
      normalizedFoodNames.planJson,
      input.user.profile?.pregnancyStatus
    );

    if (!pregnancyPlanSafety.passed) {
      this.logger.warn(
        [
          'SafetyService failed',
          `pregnancy-sensitive conflict at ${pregnancyPlanSafety.matchedPath ?? 'unknown'}; matchedText=${pregnancyPlanSafety.matchedText ?? 'unknown'}`
        ].join(': ')
      );
      return {
        status: PlanStatus.FALLBACK,
        planJson: createSafeFallbackPlan({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          reasons: pregnancyPlanSafety.reasons
        })
      };
    }

    const exercisePlanSafety = this.safetyService.validatePlanExerciseSafety({
      planJson: normalizedFoodNames.planJson,
      safeMode: input.user.safeMode,
      isMinor: input.user.isMinor,
      pregnancyStatus: input.user.profile?.pregnancyStatus,
      trainingLevel: input.user.trainingPreference?.trainingLevel,
      limitationsOrPainAreas: input.user.trainingPreference?.limitationsOrPainAreas ?? [],
      painOrDiscomfortReported:
        input.personalizationContext.checkInSummary?.painOrDiscomfortReported ?? false,
      highTirednessReported:
        input.personalizationContext.checkInSummary?.highTirednessReported ?? false
    });

    if (!exercisePlanSafety.passed) {
      const firstConflict = exercisePlanSafety.conflicts[0];
      this.logger.warn(
        [
          'SafetyService failed',
          firstConflict
            ? `exercise conflict at ${firstConflict.matchedPath}; reason=${firstConflict.reason}; matchedText=${firstConflict.matchedText}`
            : `fallback reason=${exercisePlanSafety.reasons.join(' | ')}`
        ].join(': ')
      );
      return {
        status: PlanStatus.FALLBACK,
        planJson: createSafeFallbackPlan({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          reasons: exercisePlanSafety.reasons
        })
      };
    }

    this.logger.log('schema validation passed: true');
    this.logger.log('SafetyService passed: true');

    if (input.forcedFallback) {
      return {
        status: PlanStatus.FALLBACK,
        planJson: normalizedFoodNames.planJson
      };
    }

    return this.reviewPlanWithSafetyAgent({
      planJson: normalizedFoodNames.planJson,
      user: input.user,
      blockedFoods: input.blockedFoods,
      planLocalDate: input.planLocalDate,
      planTimezone: input.planTimezone,
      allowSafetyRetry: Boolean(input.allowSafetyRetry),
      retryUsed: Boolean(input.safetyRetryUsed)
    });
  }

  private async reviewPlanWithSafetyAgent(input: {
    planJson: DailyPlanJson;
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>;
    blockedFoods: { allergies: string[]; excludedFoods: string[] };
    planLocalDate: string;
    planTimezone: string;
    allowSafetyRetry: boolean;
    retryUsed: boolean;
  }): Promise<DailyPlanValidationResult> {
    this.logger.log(
      `SafetyAgent enabled=${this.safetyAgentConfig.enabled}; provider=${this.safetyAgentConfig.provider}`
    );

    if (!this.safetyAgentConfig.enabled) {
      return {
        status: PlanStatus.READY,
        planJson: input.retryUsed
          ? this.withSafetyAgentDebug(input.planJson, {
              retryUsed: true,
              retryResult: 'approved'
            })
          : input.planJson
      };
    }

    try {
      const review = await this.safetyAgent.reviewDailyPlan(
        this.buildSafetyAgentReviewInput(input)
      );
      const parsedReview = safetyAgentReviewSchema.safeParse(review);

      if (!parsedReview.success) {
        this.logger.warn(
          `SafetyAgent review invalid; provider=${this.safetyAgentConfig.provider}; fallback reason=safety_agent_invalid_review`
        );
        return this.createSafetyAgentFallback({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          fallbackReason: 'safety_agent_invalid_review'
        });
      }

      this.logger.log(
        [
          'SafetyAgent review completed',
          `provider=${this.safetyAgentConfig.provider}`,
          `approved=${parsedReview.data.approved}`,
          `riskLevel=${parsedReview.data.riskLevel}`,
          `reasonCount=${parsedReview.data.reasons.length}`
        ].join('; ')
      );

      if (!parsedReview.data.approved) {
        if (
          input.allowSafetyRetry &&
          parsedReview.data.requiredChanges.some((change) => change.trim().length > 0)
        ) {
          this.logger.warn(
            `SafetyAgent rejected plan; safety retry available=true; reasonCount=${parsedReview.data.reasons.length}`
          );
          return {
            status: PlanStatus.FALLBACK,
            planJson: this.withSafetyAgentDebug(input.planJson, {
              approved: false,
              riskLevel: parsedReview.data.riskLevel,
              retryUsed: false,
              retryResult: 'not_used'
            }),
            safetyRetryRequest: {
              riskLevel: parsedReview.data.riskLevel,
              reasons: parsedReview.data.reasons,
              requiredChanges: parsedReview.data.requiredChanges
            }
          };
        }

        const fallbackReason = input.retryUsed
          ? 'safety_agent_retry_rejected'
          : 'safety_agent_rejected';
        this.logger.warn(`fallback used: true; fallback reason=${fallbackReason}`);
        return this.createSafetyAgentFallback({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          fallbackReason,
          approved: false,
          riskLevel: parsedReview.data.riskLevel,
          retryUsed: input.retryUsed,
          retryResult: input.retryUsed ? 'rejected' : 'not_used'
        });
      }

      if (input.retryUsed) {
        this.logger.log('retry SafetyAgent approved=true');
      }

      return {
        status: PlanStatus.READY,
        planJson: this.withSafetyAgentDebug(input.planJson, {
          approved: true,
          riskLevel: parsedReview.data.riskLevel,
          retryUsed: input.retryUsed,
          retryResult: input.retryUsed ? 'approved' : 'not_used'
        })
      };
    } catch (error) {
      if (error instanceof SafetyAgentError) {
        this.logger.warn(
          `SafetyAgent failed; provider=${this.safetyAgentConfig.provider}; fallback reason=${error.fallbackReason}`
        );
        return this.createSafetyAgentFallback({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          fallbackReason: input.retryUsed ? 'safety_agent_retry_failed' : error.fallbackReason,
          retryUsed: input.retryUsed,
          retryResult: input.retryUsed ? 'failed' : 'not_used'
        });
      }

      this.logger.warn('SafetyAgent unavailable; fallback reason=safety_agent_unavailable');
      return this.createSafetyAgentFallback({
        planLocalDate: input.planLocalDate,
        planTimezone: input.planTimezone,
        fallbackReason: input.retryUsed ? 'safety_agent_retry_failed' : 'safety_agent_unavailable',
        retryUsed: input.retryUsed,
        retryResult: input.retryUsed ? 'failed' : 'not_used'
      });
    }
  }

  private buildSafetyAgentReviewInput(input: {
    planJson: DailyPlanJson;
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>;
    blockedFoods: { allergies: string[]; excludedFoods: string[] };
  }): ReviewDailyPlanInput {
    return {
      plan: input.planJson,
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
        pregnancyStatus: input.user.profile?.pregnancyStatus ?? 'UNKNOWN',
        allergies: input.blockedFoods.allergies,
        excludedFoods: input.blockedFoods.excludedFoods,
        deterministicSafetyPassed: true
      }
    };
  }

  private createSafetyAgentFallback(input: {
    planLocalDate: string;
    planTimezone: string;
    fallbackReason: string;
    approved?: boolean;
    riskLevel?: 'low' | 'medium' | 'high';
    retryUsed?: boolean;
    retryResult?: 'approved' | 'rejected' | 'failed' | 'not_used';
  }): DailyPlanValidationResult {
    return {
      status: PlanStatus.FALLBACK,
      planJson: this.withSafetyAgentDebug(
        createSafeFallbackPlan({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          reasons: [input.fallbackReason]
        }),
        {
          approved: input.approved,
          riskLevel: input.riskLevel,
          retryUsed: input.retryUsed,
          retryResult: input.retryResult
        }
      )
    };
  }

  private withSafetyAgentDebug(
    planJson: DailyPlanJson,
    review?: {
      approved?: boolean;
      riskLevel?: 'low' | 'medium' | 'high';
      retryUsed?: boolean;
      retryResult?: 'approved' | 'rejected' | 'failed' | 'not_used';
    }
  ): DailyPlanJson {
    if (!planJson.debug) {
      return planJson;
    }

    const safetyAgentDebug = {
      enabled: this.safetyAgentConfig.enabled,
      provider: this.safetyAgentConfig.provider,
      ...(review?.approved !== undefined ? { approved: review.approved } : {}),
      ...(review?.riskLevel !== undefined ? { riskLevel: review.riskLevel } : {}),
      ...(review?.retryUsed !== undefined ? { retryUsed: review.retryUsed } : {}),
      ...(review?.retryResult !== undefined ? { retryResult: review.retryResult } : {})
    };

    return {
      ...planJson,
      debug: {
        provider: planJson.debug.provider,
        generatedBy: planJson.debug.generatedBy,
        ...(planJson.debug.fallbackReason ? { fallbackReason: planJson.debug.fallbackReason } : {}),
        ...(planJson.debug.planQualityMode ? { planQualityMode: planJson.debug.planQualityMode } : {}),
        ...(planJson.debug.protocols ? { protocols: planJson.debug.protocols } : {}),
        safetyAgent: safetyAgentDebug
      }
    };
  }

  private withPlanDebugContext(
    planJson: DailyPlanJson,
    planQualityMode: PlanQualityMode,
    selectedProtocols?: SelectedProtocols,
    healthPlanningContext?: GenerateDailyPlanPersonalizationContext['healthPlanningContext']
  ): DailyPlanJson {
    if (!planJson.debug) {
      return planJson;
    }

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
                highActivityYesterday: healthPlanningContext.signals.highActivityYesterday,
                recentWorkout: healthPlanningContext.signals.recentWorkout,
                lowStepTrend: healthPlanningContext.signals.lowStepTrend
              }
            }
          : {})
      }
    };
  }

  private buildExerciseSelectionContext(
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>,
    planLocalDate: string,
    planQualityMode: PlanQualityMode,
    personalizationContext: GenerateDailyPlanPersonalizationContext,
    resolvedTrainingDay: ResolvedTrainingDayContext
  ): ExerciseSelectionContext {
    const healthSignals = personalizationContext.healthPlanningContext?.signals;
    return {
      locale: this.resolvePlanningLocale(user),
      planDate: planLocalDate,
      protocol: personalizationContext.selectedProtocols!.trainingProtocol,
      environment: resolvedTrainingDay.environment ?? undefined,
      availableEquipment: resolvedTrainingDay.availableEquipment,
      trainingLevel: user.trainingPreference?.trainingLevel ?? TrainingLevel.BEGINNER,
      targetMuscles: resolvedTrainingDay.targetMuscles,
      workoutDurationMinutes: resolvedTrainingDay.isTrainingDay ? resolvedTrainingDay.durationMinutes : 0,
      limitationsPresent: (user.trainingPreference?.limitationsOrPainAreas.length ?? 0) > 0,
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

  private resolvePlanningLocale(user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>): SupportedLocale {
    switch (user.settings?.preferredLocale) {
      case PreferredLocale.RU_RU: return 'ru-RU';
      case PreferredLocale.FR_FR: return 'fr-FR';
      case PreferredLocale.ZH_CN: return 'zh-CN';
      case PreferredLocale.EN_US: return 'en-US';
      default: return resolveSupportedLocale(user.locale);
    }
  }

  private logExerciseSelection(
    selection: ExerciseSelectionResult,
    personalizationContext: GenerateDailyPlanPersonalizationContext
  ) {
    this.logger.log([
      `exercise selection completed; protocol=${personalizationContext.selectedProtocols?.trainingProtocol.id ?? 'unknown'}`,
      `qualityMode=${personalizationContext.mode}`,
      `candidateCount=${selection.candidates.length}`,
      `requestedExerciseCount=${selection.requestedExerciseCount}`,
      `fallbackMode=${selection.fallbackMode}`,
      `resolvedLocale=${selection.candidates[0]?.resolvedLocale ?? 'en-US'}`,
      `exclusions=${JSON.stringify(selection.internalExclusionSummary)}`
    ].join('; '));
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
          fallbackMode: selection.fallbackMode,
          usedAiRetry,
          usedDeterministicFallback,
          resolvedLocale: selection.candidates[0]?.resolvedLocale ?? 'en-US'
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

  private withNutritionTargetSnapshot(
    planJson: DailyPlanJson,
    nutritionTarget: NutritionTarget
  ): DailyPlanJson {
    return {
      ...planJson,
      nutritionTargetSnapshot: this.nutritionTargetsService.toSnapshot(nutritionTarget)
    };
  }

  private withTrainingStateForAppMode(planJson: DailyPlanJson, appMode: GoalImpactMode): DailyPlanJson {
    if (appMode !== GoalImpactMode.NUTRITION_ONLY) return planJson;

    return {
      ...planJson,
      training: {
        recommendation: 'Training is off for this plan.',
        intensity: 'REST',
        notes: 'OptiMe will focus on nutrition today. You can enable training whenever it fits your goals.',
        exercises: []
      }
    };
  }

  private resolveAppMode(user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>) {
    return user.goal?.impactMode ?? (user.noTrainingPlanned ? GoalImpactMode.NUTRITION_ONLY : GoalImpactMode.NUTRITION_AND_TRAINING);
  }

  private createEmptyExerciseSelection(): ExerciseSelectionResult {
    return {
      candidates: [],
      requestedExerciseCount: 0,
      candidatePoolLimit: 0,
      workoutDurationMinutes: 0,
      normalizedTargetMuscles: [],
      fallbackMode: 'NONE',
      internalExclusionSummary: {}
    };
  }

  private getProviderDebugName() {
    return this.aiProvider.constructor?.name === 'OpenAiProviderService' ? 'openai' : 'mock';
  }

  private canUseSafetyFeedbackRetry(providerStatus: PlanStatus) {
    return (
      providerStatus === PlanStatus.READY &&
      this.getProviderDebugName() === 'openai' &&
      this.safetyAgentConfig.enabled
    );
  }

  private getFallbackReason(planJson: unknown) {
    const debug = (planJson as { debug?: { fallbackReason?: unknown } })?.debug;
    return typeof debug?.fallbackReason === 'string' ? debug.fallbackReason : undefined;
  }

  private async buildPersonalizationContext(
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>,
    planQualityMode: PlanQualityMode,
    planLocalDate: string,
    resolvedTrainingDay: ResolvedTrainingDayContext,
    appMode: GoalImpactMode
  ): Promise<GenerateDailyPlanPersonalizationContext> {
    const trainingEnabled = appMode === GoalImpactMode.NUTRITION_AND_TRAINING;
    const checkInSummary = await this.checkInsService.getRecentSummary(user.id);
    const healthPlanningContext = await this.healthService.getRecentHealthSummariesForPlanning(
      user.id,
      {
        planLocalDate,
        days: 7
      }
    );
    const trainingPreference = user.trainingPreference;
    const selectedProtocols = this.protocolSelector.select({
      profile: user.profile,
      goal: user.goal,
      safeMode: user.safeMode,
      isMinor: user.isMinor,
      noTrainingPlanned: !trainingEnabled || !resolvedTrainingDay.isTrainingDay,
      trainingSchedule: trainingEnabled && resolvedTrainingDay.isTrainingDay
        ? [{
            durationMinutes: resolvedTrainingDay.durationMinutes,
            intensity: 'MODERATE',
            description: resolvedTrainingDay.source === 'WEEKLY_SCHEDULE'
              ? `Weekly schedule: ${resolvedTrainingDay.dayOfWeek}`
              : null
          }]
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
              limitationsOrPainAreas: trainingPreference.limitationsOrPainAreas,
              preferredTrainingDays: trainingPreference.preferredTrainingDays,
              limitationsAreSafetySensitive: trainingPreference.limitationsOrPainAreas.length > 0
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

    const feedbackLimit = planQualityMode === PlanQualityMode.ADAPTIVE ? 10 : 5;
    const historyLimit = planQualityMode === PlanQualityMode.ADAPTIVE ? 10 : 5;
    const [recentFeedback, recentPlans] = await Promise.all([
      this.prisma.dailyPlanFeedback.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        take: feedbackLimit,
        select: {
          rating: true,
          tags: true
        }
      }),
      this.prisma.dailyPlan.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        take: historyLimit,
        select: {
          status: true,
          readinessLevel: true
        }
      })
    ]);

    return {
      ...baseContext,
      feedbackSummary: {
        helpfulCount: recentFeedback.filter(
          (feedback) => feedback.rating === PlanFeedbackRating.HELPFUL
        ).length,
        notHelpfulCount: recentFeedback.filter(
          (feedback) => feedback.rating === PlanFeedbackRating.NOT_HELPFUL
        ).length,
        commonTags: this.getCommonFeedbackTags(recentFeedback.flatMap((feedback) => feedback.tags))
      },
      historySummary: {
        recentPlanCount: recentPlans.length,
        readinessLevels: [...new Set(recentPlans.map((plan) => plan.readinessLevel))],
        fallbackCount: recentPlans.filter((plan) => plan.status === PlanStatus.FALLBACK).length
      }
    };
  }

  private getContextLevel(planQualityMode: PlanQualityMode) {
    switch (planQualityMode) {
      case PlanQualityMode.ADAPTIVE:
        return 'adaptive' as const;
      case PlanQualityMode.PERSONALIZED:
        return 'personalized' as const;
      case PlanQualityMode.BASIC:
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
      case PlanQualityMode.BASIC:
      default:
        return [
          'Keep the plan simple, safe, and practical.',
          'Use limited context and avoid advanced progression.'
        ];
    }
  }

  private getTrainingPersonalizationContext(planQualityMode: PlanQualityMode) {
    switch (planQualityMode) {
      case PlanQualityMode.ADAPTIVE:
        return {
          usesSchedule: true,
          usesTrainingDescriptions: true,
          exerciseDetailLevel: 'adaptive' as const,
          futureSignals: [
            'targetMuscleGroups',
            'trainingOutcome',
            'equipment',
            'trainingLevel',
            'limitationsOrPainAreas',
            'whoopRecovery',
            'whoopSleep',
            'whoopStrain'
          ]
        };
      case PlanQualityMode.PERSONALIZED:
        return {
          usesSchedule: true,
          usesTrainingDescriptions: true,
          exerciseDetailLevel: 'sets_reps_rest' as const,
          futureSignals: [
            'targetMuscleGroups',
            'trainingOutcome',
            'equipment',
            'trainingLevel',
            'limitationsOrPainAreas'
          ]
        };
      case PlanQualityMode.BASIC:
      default:
        return {
          usesSchedule: true,
          usesTrainingDescriptions: false,
          exerciseDetailLevel: 'simple' as const,
          futureSignals: [
            'targetMuscleGroups',
            'trainingOutcome',
            'equipment',
            'trainingLevel',
            'limitationsOrPainAreas'
          ]
        };
    }
  }

  private getCommonFeedbackTags(tags: string[]) {
    const counts = new Map<string, number>();

    tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
  }

  private async recordDailyPlanAiOperation(input: {
    userId: string;
    status: PlanStatus;
    planJson: DailyPlanJson;
    latencyMs: number;
  }) {
    await this.recordAiOperationSafely({
      userId: input.userId,
      feature: AiOperationFeature.DAILY_PLAN,
      provider: this.getAiOperationProvider(),
      model: this.getAiOperationModel(),
      status:
        input.status === PlanStatus.READY
          ? AiOperationStatus.SUCCESS
          : AiOperationStatus.FALLBACK,
      latencyMs: input.latencyMs,
      retryCount: this.getSafetyRetryUsed(input.planJson) ? 1 : 0,
      safetyAgentEnabled: this.safetyAgentConfig.enabled,
      safetyAgentProvider: this.safetyAgentConfig.provider,
      safetyAgentApproved: this.getSafetyAgentApproved(input.planJson),
      fallbackReason: this.getFallbackReason(input.planJson) ?? null,
      errorReason: null
    });
  }

  private async recordDailyPlanAiOperationError(input: {
    userId: string;
    latencyMs: number;
    error: unknown;
  }) {
    await this.recordAiOperationSafely({
      userId: input.userId,
      feature: AiOperationFeature.DAILY_PLAN,
      provider: this.getAiOperationProvider(),
      model: this.getAiOperationModel(),
      status: AiOperationStatus.ERROR,
      latencyMs: input.latencyMs,
      retryCount: 0,
      safetyAgentEnabled: this.safetyAgentConfig.enabled,
      safetyAgentProvider: this.safetyAgentConfig.provider,
      safetyAgentApproved: null,
      fallbackReason: null,
      errorReason: this.getSafeAiOperationErrorReason(input.error)
    });
  }

  private async recordAiOperationSafely(
    input: Parameters<AiOperationLogsService['record']>[0]
  ) {
    try {
      await this.aiOperationLogs.record(input);
    } catch {
      this.logger.warn('AI operation log write failed; daily plan generation continued.');
    }
  }

  private getAiOperationProvider() {
    return this.getProviderDebugName() === 'openai'
      ? AiOperationProvider.OPENAI
      : AiOperationProvider.MOCK;
  }

  private getAiOperationModel() {
    return this.getProviderDebugName() === 'openai'
      ? this.configService.get<string>('OPENAI_DEFAULT_MODEL') ?? null
      : null;
  }

  private getSafetyAgentApproved(planJson: DailyPlanJson) {
    const approved = planJson.debug?.safetyAgent?.approved;
    return typeof approved === 'boolean' ? approved : null;
  }

  private getSafetyRetryUsed(planJson: DailyPlanJson) {
    return planJson.debug?.safetyAgent?.retryUsed === true || planJson.debug?.exerciseSelection?.usedAiRetry === true;
  }

  private getSafeAiOperationErrorReason(error: unknown) {
    if (error instanceof OpenAiProviderError) {
      return error.fallbackReason;
    }

    if (error instanceof SafetyAgentError) {
      return error.fallbackReason;
    }

    return 'daily_plan_generation_error';
  }

  private toResponse(plan: {
    id: string;
    status: string;
    readinessLevel: string;
    planLocalDate: string;
    planTimezone: string;
    planJson: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const normalizedPlan = normalizeDailyPlanJson({
      planJson: plan.planJson,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      readinessLevel: plan.readinessLevel
    });

    return {
      id: plan.id,
      status: plan.status,
      readinessLevel: plan.readinessLevel,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      plan: normalizedPlan,
      updatedAt: plan.updatedAt.toISOString()
    };
  }
}
