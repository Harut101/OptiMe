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
  ProgressiveProfilePromptKey,
  ProgressiveProfilePromptStatus,
  TargetMuscleGroup,
  TrainingLevel,
  UsageFeature,
  UsagePeriodType
} from '@prisma/client';
import {
  resolveSupportedLocale,
  type DailyFoodPlan,
  type NutritionTarget,
  type NutritionTargetExplanation,
  type NutritionTargetSnapshot,
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
import { FoodLogsService } from '../food-logs/food-logs.service';
import { HealthService } from '../health/health.service';
import { NutritionAgentService } from '../nutrition-agent/nutrition-agent.service';
import { NutritionTargetsService } from '../nutrition-targets/nutrition-targets.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { ProtocolSelectorService } from '../protocol/protocol-selector.service';
import { SelectedProtocols } from '../protocol/protocol.types';
import { createSafeFallbackPlan } from '../safety/safe-fallback-plan.factory';
import { SafetyService } from '../safety/safety.service';
import { SafetyAgent, ReviewDailyPlanInput } from '../safety-agent/safety-agent.interface';
import { SafetyAgentError } from '../safety-agent/safety-agent.error';
import {
  safetyAgentReviewSchema,
  type SafetyAgentReview
} from '../safety-agent/safety-agent-review.schema';
import {
  SAFETY_AGENT,
  SAFETY_AGENT_CONFIG,
  SafetyAgentConfig
} from '../safety-agent/safety-agent.token';
import { UsageGuardService } from '../usage/usage-guard.service';
import { TrainingLoadAgentService } from '../training-load-agent/training-load-agent.service';
import { TrainingScheduleResolverService } from '../training-schedule/training-schedule-resolver.service';
import { mapPainAreasToMuscles, normalizePainAreas } from '../workout-sessions/workout-pain-mapping';
import { normalizeDailyPlanFoodNames } from './daily-plan-food-name-normalizer';
import { withRecoveryAwareContextNotes } from './daily-plan-context-notes';
import { DailyPlanJson, dailyPlanJsonSchema } from './daily-plan-json.schema';
import { normalizeDailyPlanJson } from './daily-plan-normalizer';
import { GenerateDailyPlanDto } from './dto/generate-daily-plan.dto';
import { ExcludeFoodIngredientDto } from './dto/exclude-food-ingredient.dto';
import { RegenerateFoodPlanDto } from './dto/regenerate-food-plan.dto';
import { AdjustTrainingForPreWorkoutDto } from './dto/adjust-training-for-pre-workout.dto';
import {
  ApplyTrainingReplacementsDto,
  TrainingReplacementProposalsDto
} from './dto/training-replacement-proposals.dto';
import { SubmitDailyPlanFeedbackDto } from './dto/submit-daily-plan-feedback.dto';
import {
  getExerciseMuscles,
  getPlanExerciseKey,
  PainAwareExerciseReplacementService,
  TrainingReplacementProposalResult
} from './pain-aware-exercise-replacement.service';

interface DailyPlanValidationResult {
  status: PlanStatus;
  planJson: DailyPlanJson;
  safetyRetryRequest?: GenerateDailyPlanSafetyFeedback;
}

const MATERIAL_SAFETY_REVIEW_PATTERNS: Array<{ category: string; pattern: RegExp }> = [
  { category: 'unsafe_diet', pattern: /starv|fasting|detox|extreme calor|severe (?:calorie|diet)|skip meals|punish(?:ment)? exercise/i },
  { category: 'body_shaming', pattern: /body.?sham|shame|guilt|disgust|lazy|punish/i },
  { category: 'medical_claim', pattern: /medical diagnos|diagnos|treat(?:ment)?|medical claim|supplement/i },
  { category: 'unsafe_training', pattern: /unsafe (?:training|exercise|workout)|train through|push through|ignore (?:pain|dizz|illness|exhaust|injur)|(?:exercise|workout|training).*(?:despite|with) (?:pain|dizz|illness|exhaust|injur)|maximum effort|max effort|overtrain|aggress(?:ive|ively)/i },
  { category: 'sensitive_context', pattern: /unsafe.*(?:under.?18|minor|safe mode|pregnan|postpartum|breastfeed)|(?:under.?18|minor|safe mode|pregnan|postpartum|breastfeed).*(?:unsafe|high.?intensity|extreme|aggress)/i }
];

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
    private readonly foodLogsService: FoodLogsService,
    private readonly healthService: HealthService,
    private readonly nutritionAgent: NutritionAgentService,
    private readonly nutritionTargetsService: NutritionTargetsService,
    private readonly protocolSelector: ProtocolSelectorService,
    private readonly trainingLoadAgent: TrainingLoadAgentService,
    private readonly trainingScheduleResolver: TrainingScheduleResolverService,
    private readonly painAwareExerciseReplacement: PainAwareExerciseReplacementService,
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

    const operationStartedAt = Date.now();
    const consumedUsage: Array<{ id: string; amount: number }> = [];

    try {
      consumedUsage.push(
        ...(await this.consumeDailyPlanUsage(userId, Boolean(existingPlan && dto.forceRegenerate)))
      );
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
        planJson: this.withRecoveryAwareContext(
          this.withTrainingStateForAppMode(
            this.withNutritionTargetSnapshot(
              this.withTrainingScheduleSnapshot(providerPlanResult.planJson, resolvedTrainingDay),
              nutritionTarget
            ),
            appMode
          ),
          personalizationContext,
          trainingEnabled,
          resolvedTrainingDay.isTrainingDay
        )
      };
      const foodPlanResult = await this.nutritionAgent.generateDailyFoodPlan({
        planLocalDate,
        locale: this.resolvePlanningLocale(user),
        planQualityMode,
        appMode,
        safeMode: user.safeMode,
        isMinor: user.isMinor,
        pregnancyStatus: user.profile?.pregnancyStatus,
        nutritionTarget,
        nutritionTargetSnapshot: this.nutritionTargetsService.toSnapshot(nutritionTarget),
        nutritionPreference: user.nutritionPref
          ? {
              dietType: user.nutritionPref.dietType,
              mealsPerDay: user.nutritionPref.mealsPerDay,
              notes: user.nutritionPref.notes,
              allergies: user.nutritionPref.allergies.map((food) => food.name),
              excludedFoods: user.nutritionPref.excludedFoods.map((food) => food.name),
              dislikedFoods: user.nutritionPref.dislikedFoods.map((food) => food.name),
              preferredFoods: user.nutritionPref.preferredFoods.map((food) => food.name)
            }
          : null,
        goalSummary: user.goal
          ? {
              primaryGoal: user.goal.primaryGoal,
              goalType: user.goal.goalType
            }
          : null,
        foodAdherenceSummary: personalizationContext.foodAdherenceSummary,
        mealPracticalityPreference: this.toMealPracticalityPreference(user),
        resolvedTrainingDay
      });
      let finalFoodPlan = foodPlanResult.foodPlan;
      providerPlanResult = {
        ...providerPlanResult,
        planJson: this.withFoodPlan(providerPlanResult.planJson, foodPlanResult.foodPlan)
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
        planJson: this.withFoodPlan(exercisePreparation.planJson, foodPlanResult.foodPlan)
      };
      providerPlanResult = {
        ...providerPlanResult,
        planJson: await this.withTrainingLoadAgentSnapshot({
          planJson: providerPlanResult.planJson,
          user,
          planLocalDate,
          planQualityMode,
          personalizationContext,
          exerciseSelection,
          resolvedTrainingDay,
          appMode
        })
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
        retryProviderPlanResult.planJson = this.withRecoveryAwareContext(
          this.withTrainingStateForAppMode(
            this.withNutritionTargetSnapshot(
              this.withTrainingScheduleSnapshot(retryProviderPlanResult.planJson, resolvedTrainingDay),
              nutritionTarget
            ),
            appMode
          ),
          personalizationContext,
          trainingEnabled,
          resolvedTrainingDay.isTrainingDay
        );
        const retryFoodPlanResult = await this.nutritionAgent.generateDailyFoodPlan({
          planLocalDate,
          locale: this.resolvePlanningLocale(user),
          planQualityMode,
          appMode,
          safeMode: user.safeMode,
          isMinor: user.isMinor,
          pregnancyStatus: user.profile?.pregnancyStatus,
          nutritionTarget,
          nutritionTargetSnapshot: this.nutritionTargetsService.toSnapshot(nutritionTarget),
          nutritionPreference: user.nutritionPref
            ? {
                dietType: user.nutritionPref.dietType,
                mealsPerDay: user.nutritionPref.mealsPerDay,
                notes: user.nutritionPref.notes,
                allergies: user.nutritionPref.allergies.map((food) => food.name),
                excludedFoods: user.nutritionPref.excludedFoods.map((food) => food.name),
                dislikedFoods: user.nutritionPref.dislikedFoods.map((food) => food.name),
                preferredFoods: user.nutritionPref.preferredFoods.map((food) => food.name)
              }
            : null,
          goalSummary: user.goal
            ? {
                primaryGoal: user.goal.primaryGoal,
                goalType: user.goal.goalType
              }
            : null,
          foodAdherenceSummary: personalizationContext.foodAdherenceSummary,
          mealPracticalityPreference: this.toMealPracticalityPreference(user),
          resolvedTrainingDay
        });
        finalFoodPlan = retryFoodPlanResult.foodPlan;
        retryProviderPlanResult.planJson = this.withFoodPlan(
          retryProviderPlanResult.planJson,
          retryFoodPlanResult.foodPlan
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
        retryExercisePreparation.planJson = await this.withTrainingLoadAgentSnapshot({
          planJson: retryExercisePreparation.planJson,
          user,
          planLocalDate,
          planQualityMode,
          personalizationContext,
          exerciseSelection,
          resolvedTrainingDay,
          appMode
        });

        safePlanResult = await this.validateProviderPlan({
          providerPlan: this.withFoodPlan(
            retryExercisePreparation.planJson,
            retryFoodPlanResult.foodPlan
          ),
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
        planJson: this.withSafeTrainingDayFallback({
          planJson: safePlanResult.planJson,
          resolvedTrainingDay,
          exerciseSelection,
          trainingEnabled
        })
      };
      safePlanResult = {
        ...safePlanResult,
        planJson: this.withTrainingScheduleSnapshot(
          this.withPlanDebugContext(
            this.withRecoveryAwareContext(
              this.withNutritionTargetSnapshot(
                this.ensureFoodPlan(safePlanResult.planJson, finalFoodPlan),
                nutritionTarget
              ),
              personalizationContext,
              trainingEnabled,
              resolvedTrainingDay.isTrainingDay
            ),
            planQualityMode,
            personalizationContext.selectedProtocols,
            personalizationContext.healthPlanningContext
          ),
          resolvedTrainingDay
        )
      };
      safePlanResult.planJson = this.withExerciseSelectionDebug(
        safePlanResult.planJson,
        exerciseSelection,
        exercisePreparation.usedAiRetry,
        exercisePreparation.usedDeterministicFallback
      );
      safePlanResult.planJson = this.withGenerationSectionDebug(
        safePlanResult.planJson,
        exercisePreparation.usedDeterministicFallback
      );
      const planJson = safePlanResult.planJson as Prisma.JsonObject;
      const status = this.resolvePersistedPlanStatus(safePlanResult);
      const finalExerciseIds = (safePlanResult.planJson.training.exercises ?? [])
        .map((exercise) => exercise.exerciseId)
        .filter((exerciseId): exerciseId is string => Boolean(exerciseId));
      this.logger.log(`exercise selection finalized; exerciseIds=${JSON.stringify(finalExerciseIds)}`);
      this.logger.log(
        `plan completion finalized; complete=${safePlanResult.planJson.debug?.generation?.isComplete ?? false}; adjustedSections=${safePlanResult.planJson.debug?.generation?.adjustedSections.join(',') || 'none'}`
      );
      this.logger.log(
        `daily plan generation completed; safe replacement used: ${safePlanResult.status === PlanStatus.FALLBACK}; persisted status=${status}`
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
      await this.refundConsumedUsage(consumedUsage);
      await this.recordDailyPlanAiOperationError({
        userId,
        latencyMs: Date.now() - operationStartedAt,
        error
      });
      throw error;
    }
  }

  async regenerateFoodPlan(userId: string, dailyPlanId: string, dto: RegenerateFoodPlanDto) {
    const context = await this.getFoodRegenerationContext(userId, dailyPlanId);
    const consumedUsage = await this.usageGuardService.checkAndConsume(
      userId,
      UsageFeature.MENU_REGENERATION,
      UsagePeriodType.DAILY
    );

    try {
      const result = await this.generateReplacementFoodPlan(context, {
        mode: 'FULL_MENU_REGENERATION',
        reason: dto.reason
      });

      this.logger.log(
        `food plan regeneration completed; type=full_menu; planId=${dailyPlanId}; validationStatus=${result.foodPlan.validation.status}; retryCount=${result.retryCount}; fallbackUsed=${result.fallbackUsed}; kcalDelta=${Math.abs(result.foodPlan.totals.caloriesKcal - context.nutritionTarget.calories.targetKcal)}`
      );

      return this.persistRegeneratedFoodPlan(
        context,
        this.markFoodPlanRegenerated(result.foodPlan, 'FULL_MENU_REGENERATION')
      );
    } catch (error) {
      await this.refundConsumedUsage([{ id: consumedUsage.id, amount: 1 }]);
      throw error;
    }
  }

  async regenerateFoodMeal(
    userId: string,
    dailyPlanId: string,
    mealId: string,
    dto: RegenerateFoodPlanDto
  ) {
    const context = await this.getFoodRegenerationContext(userId, dailyPlanId);
    const selectedMeal = context.currentFoodPlan.meals.find((meal) => meal.id === mealId);

    if (!selectedMeal) {
      throw new BadRequestException('Meal not found in this plan.');
    }

    const consumedUsage = await this.usageGuardService.checkAndConsume(
      userId,
      UsageFeature.MEAL_REGENERATION,
      UsagePeriodType.DAILY
    );

    try {
      const result = await this.generateReplacementFoodPlan(context, {
        mode: 'MEAL_REGENERATION',
        reason: dto.reason,
        selectedMealId: mealId
      });
      const nextMeal = result.foodPlan.meals.find((meal) => meal.id === mealId);

      if (!nextMeal) {
        throw new BadRequestException('Could not safely regenerate this meal. Your current meal was kept.');
      }

      const markedFoodPlan = this.markFoodPlanRegenerated(result.foodPlan, 'MEAL_REGENERATION', mealId);
      this.logger.log(
        `food plan regeneration completed; type=meal; planId=${dailyPlanId}; mealId=${mealId}; validationStatus=${markedFoodPlan.validation.status}; retryCount=${result.retryCount}; fallbackUsed=${result.fallbackUsed}; kcalDelta=${Math.abs(markedFoodPlan.totals.caloriesKcal - context.nutritionTarget.calories.targetKcal)}`
      );

      return this.persistRegeneratedFoodPlan(context, markedFoodPlan);
    } catch (error) {
      await this.refundConsumedUsage([{ id: consumedUsage.id, amount: 1 }]);
      throw error;
    }
  }

  async excludeFoodIngredient(userId: string, dailyPlanId: string, dto: ExcludeFoodIngredientDto) {
    await this.getOwnedPlanOrThrow(userId, dailyPlanId);
    const ingredientName = dto.ingredientName.trim();

    if (!ingredientName) {
      throw new BadRequestException('Ingredient name is required.');
    }

    const preference = await this.prisma.$transaction(async (tx) => {
      const nutritionPreference = await tx.nutritionPreference.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          dietType: 'NONE',
          mealsPerDay: 3,
          noKnownAllergiesConfirmed: false
        }
      });
      const existing = await tx.excludedFood.findFirst({
        where: {
          nutritionPreferenceId: nutritionPreference.id,
          name: { equals: ingredientName, mode: 'insensitive' }
        }
      });

      if (!existing) {
        await tx.excludedFood.create({
          data: {
            nutritionPreferenceId: nutritionPreference.id,
            name: ingredientName
          }
        });
      }

      return tx.nutritionPreference.findUniqueOrThrow({
        where: { userId },
        include: {
          allergies: true,
          excludedFoods: true,
          dislikedFoods: true,
          preferredFoods: true
        }
      });
    });

    this.logger.log(`food ingredient excluded; planId=${dailyPlanId}; userId=${userId}; duplicateSafe=true`);

    return preference;
  }

  async adjustTrainingForPreWorkout(userId: string, dailyPlanId: string, dto: AdjustTrainingForPreWorkoutDto) {
    const proposalResult = await this.buildTrainingReplacementProposalResult(userId, dailyPlanId, {
      preWorkoutCheck: {
        ...dto.preWorkoutCheck,
        painAreas: dto.preWorkoutCheck.painAreas ?? []
      },
      conflictingExerciseKeys: []
    });
    if (proposalResult.proposals.length > 0) {
      return this.applyTrainingReplacements(userId, dailyPlanId, {
        preWorkoutCheck: {
          ...dto.preWorkoutCheck,
          painAreas: dto.preWorkoutCheck.painAreas ?? []
        },
        conflictingExerciseKeys: proposalResult.proposals.map((proposal) => proposal.originalPlanExerciseKey),
        acceptedOriginalPlanExerciseKeys: proposalResult.proposals.map((proposal) => proposal.originalPlanExerciseKey)
      });
    }

    const [plan, existingSession] = await Promise.all([
      this.getOwnedPlanOrThrow(userId, dailyPlanId),
      this.prisma.workoutSession.findUnique({
        where: {
          userId_dailyPlanId: {
            userId,
            dailyPlanId
          }
        },
        select: { id: true }
      })
    ]);

    if (existingSession) {
      throw new BadRequestException('Workout already started. Today’s plan was not changed.');
    }

    const painAreas = normalizePainAreas(dto.preWorkoutCheck.painAreas ?? []);
    const avoidedMuscleGroups = mapPainAreasToMuscles(painAreas);
    if (dto.preWorkoutCheck.readinessStatus !== 'PAIN_OR_LIMITATION' || avoidedMuscleGroups.length === 0) {
      throw new BadRequestException('Choose a pain or limitation area before adjusting today’s workout.');
    }

    const avoided = new Set<TargetMuscleGroup>(avoidedMuscleGroups);
    const currentPlan = normalizeDailyPlanJson({
      planJson: plan.planJson,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      readinessLevel: plan.readinessLevel
    });
    const exercises = currentPlan.training.exercises ?? [];
    const safeExercises = exercises.filter((exercise) =>
      !this.getPlanExerciseMuscles(exercise).some((muscle) => avoided.has(muscle))
    );
    const removedCount = exercises.length - safeExercises.length;

    if (removedCount === 0) {
      return this.toResponse(plan);
    }

    if (safeExercises.length < 1) {
      throw new BadRequestException('Not enough safe exercises remain for today. Consider resting today instead.');
    }

    const nextPlan: DailyPlanJson = {
      ...currentPlan,
      training: {
        ...currentPlan.training,
        exercises: safeExercises,
        recommendation: 'Use the adjusted workout for today and keep the session controlled.',
        notes: 'Adjusted from your pre-workout check. Stop if pain increases, dizziness appears, or anything feels unusual.'
      },
      trainingAdjustmentSnapshot: {
        source: 'PRE_WORKOUT_PAIN_ADJUSTMENT',
        painAreas,
        avoidedMuscleGroups,
        adjustedAt: new Date().toISOString(),
        reasonCodes: ['PRE_WORKOUT_PAIN_CONFLICT', 'CONFLICTING_EXERCISES_REMOVED']
      }
    };

    const parsed = dailyPlanJsonSchema.safeParse(nextPlan);
    if (!parsed.success) {
      throw new BadRequestException('Could not safely adjust today’s workout. Your current plan was kept.');
    }

    const updated = await this.prisma.dailyPlan.update({
      where: { id: plan.id },
      data: {
        planJson: parsed.data as Prisma.JsonObject
      }
    });

    this.logger.log(
      `daily plan training adjusted for pre-workout pain; planId=${dailyPlanId}; removedExercises=${removedCount}; avoidedMuscles=${avoidedMuscleGroups.length}`
    );

    return this.toResponse(updated);
  }

  async getTrainingReplacementProposals(
    userId: string,
    dailyPlanId: string,
    dto: TrainingReplacementProposalsDto
  ) {
    const proposalResult = await this.buildTrainingReplacementProposalResult(userId, dailyPlanId, dto);
    return this.toTrainingReplacementProposalResponse(proposalResult);
  }

  async applyTrainingReplacements(
    userId: string,
    dailyPlanId: string,
    dto: ApplyTrainingReplacementsDto
  ) {
    const { plan, currentPlan, proposalResult } = await this.buildTrainingReplacementContext(
      userId,
      dailyPlanId,
      dto
    );
    if (proposalResult.proposals.length === 0) {
      throw new BadRequestException('Could not find safe replacement exercises for today.');
    }
    const accepted = new Set(dto.acceptedOriginalPlanExerciseKeys ?? []);
    if (accepted.size === 0) {
      throw new BadRequestException('Choose at least one replacement to apply.');
    }
    const proposalKeys = new Set(proposalResult.proposals.map((proposal) => proposal.originalPlanExerciseKey));
    const invalidAccepted = [...accepted].filter((key) => !proposalKeys.has(key));
    if (invalidAccepted.length > 0) {
      throw new BadRequestException('One or more replacement selections are no longer available.');
    }

    const nextPlan = this.painAwareExerciseReplacement.applyProposals({
      dailyPlanId,
      planJson: currentPlan,
      proposalResult,
      acceptedOriginalPlanExerciseKeys: [...accepted]
    });
    const parsed = dailyPlanJsonSchema.safeParse(nextPlan);
    if (!parsed.success) {
      throw new BadRequestException('Could not safely apply todayâ€™s workout replacements. Your current plan was kept.');
    }
    const updated = await this.prisma.dailyPlan.update({
      where: { id: plan.id },
      data: { planJson: parsed.data as Prisma.JsonObject }
    });
    this.logger.log(
      `daily plan training replacements applied; planId=${dailyPlanId}; replacements=${accepted.size}; unresolved=${proposalResult.unresolvedConflicts.length}`
    );
    return this.toResponse(updated);
  }

  private async buildTrainingReplacementProposalResult(
    userId: string,
    dailyPlanId: string,
    dto: TrainingReplacementProposalsDto
  ): Promise<TrainingReplacementProposalResult> {
    const { proposalResult } = await this.buildTrainingReplacementContext(userId, dailyPlanId, dto);
    return proposalResult;
  }

  private async buildTrainingReplacementContext(
    userId: string,
    dailyPlanId: string,
    dto: TrainingReplacementProposalsDto
  ) {
    const [user, plan, existingSession] = await Promise.all([
      this.getPlanningUser(userId),
      this.getOwnedPlanOrThrow(userId, dailyPlanId),
      this.prisma.workoutSession.findUnique({
        where: {
          userId_dailyPlanId: {
            userId,
            dailyPlanId
          }
        },
        select: { id: true }
      })
    ]);

    if (existingSession) {
      throw new BadRequestException('Workout already started. Todayâ€™s plan was not changed.');
    }

    const painAreas = normalizePainAreas(dto.preWorkoutCheck.painAreas ?? []);
    const avoidedMuscleGroups = mapPainAreasToMuscles(painAreas);
    if (dto.preWorkoutCheck.readinessStatus !== 'PAIN_OR_LIMITATION' || avoidedMuscleGroups.length === 0) {
      throw new BadRequestException('Choose a pain or limitation area before adjusting todayâ€™s workout.');
    }

    const currentPlan = normalizeDailyPlanJson({
      planJson: plan.planJson,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      readinessLevel: plan.readinessLevel
    });
    const exercises = currentPlan.training.exercises ?? [];
    if (exercises.length === 0) {
      throw new BadRequestException('Workout is unavailable for this plan.');
    }

    const avoided = new Set<TargetMuscleGroup>(avoidedMuscleGroups);
    const allKeys = new Set(exercises.map((exercise, index) => getPlanExerciseKey(dailyPlanId, exercise, index)));
    const requestedKeys = [...new Set(dto.conflictingExerciseKeys ?? [])];
    const invalidKeys = requestedKeys.filter((key) => !allKeys.has(key));
    if (invalidKeys.length > 0) {
      throw new BadRequestException('One or more exercise keys are not part of this plan.');
    }
    const derivedConflictKeys = exercises
      .map((exercise, index) => ({
        key: getPlanExerciseKey(dailyPlanId, exercise, index),
        muscles: getExerciseMuscles(exercise)
      }))
      .filter((entry) => entry.muscles.some((muscle) => avoided.has(muscle)))
      .map((entry) => entry.key);
    const conflictingExerciseKeys = requestedKeys.length > 0 ? requestedKeys : derivedConflictKeys;

    if (conflictingExerciseKeys.length === 0) {
      throw new BadRequestException('No conflicting planned exercises were found for the selected area.');
    }

    const planQualityMode = await this.featureAccessService.getPlanQualityMode(userId);
    const appMode = this.resolveAppMode(user);
    const resolvedTrainingDay = currentPlan.trainingScheduleSnapshot
      ?? await this.trainingScheduleResolver.resolveForUser({
        userId,
        planLocalDate: plan.planLocalDate,
        trainingPreference: user.trainingPreference,
        legacyScheduleItems: user.schedules,
        noTrainingPlanned: appMode !== GoalImpactMode.NUTRITION_AND_TRAINING || user.noTrainingPlanned
      });
    const personalizationContext = await this.buildPersonalizationContext(
      user,
      planQualityMode,
      plan.planLocalDate,
      resolvedTrainingDay,
      appMode
    );
    const selectionContext = this.buildExerciseSelectionContext(
      user,
      plan.planLocalDate,
      planQualityMode,
      personalizationContext,
      resolvedTrainingDay
    );
    const selection = await this.exerciseSelectionService.selectCandidates({
      ...selectionContext,
      limitationsPresent: true
    });
    const proposalResult = this.painAwareExerciseReplacement.buildProposals({
      dailyPlanId,
      exercises,
      conflictingExerciseKeys,
      painAreas,
      avoidedMuscleGroups,
      selection
    });

    return { user, plan, currentPlan, proposalResult };
  }

  private toTrainingReplacementProposalResponse(result: TrainingReplacementProposalResult) {
    return {
      status: result.status,
      painAreas: result.painAreas,
      avoidedMuscleGroups: result.avoidedMuscleGroups,
      proposals: result.proposals.map(({ replacementExercise: _replacementExercise, ...proposal }) => proposal),
      unresolvedConflicts: result.unresolvedConflicts
    };
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

  private async getFoodRegenerationContext(
    userId: string,
    dailyPlanId: string
  ) {
    const [user, plan] = await Promise.all([
      this.getPlanningUser(userId),
      this.getOwnedPlanOrThrow(userId, dailyPlanId)
    ]);
    const currentPlanJson = normalizeDailyPlanJson({
      planJson: plan.planJson,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      readinessLevel: plan.readinessLevel
    });
    const currentFoodPlan = currentPlanJson.nutrition.foodPlan;

    if (!currentFoodPlan) {
      throw new BadRequestException('This plan does not support meal regeneration yet.');
    }

    const nutritionTargetSnapshot =
      currentFoodPlan.nutritionTargetSnapshot ?? currentPlanJson.nutritionTargetSnapshot;

    if (!nutritionTargetSnapshot) {
      throw new BadRequestException('This plan is missing a nutrition target snapshot.');
    }

    const nutritionTarget = this.nutritionTargetFromSnapshot(nutritionTargetSnapshot);
    const resolvedTrainingDay = currentPlanJson.trainingScheduleSnapshot ??
      this.createFallbackTrainingDayContext(plan.planLocalDate, nutritionTarget);
    const planQualityMode = await this.featureAccessService.getPlanQualityMode(userId);
    const appMode = nutritionTarget.appMode as GoalImpactMode;
    const personalizationContext = await this.buildPersonalizationContext(
      user,
      planQualityMode,
      plan.planLocalDate,
      resolvedTrainingDay,
      appMode
    );
    personalizationContext.nutritionTarget = nutritionTarget;

    return {
      user,
      plan,
      currentPlanJson,
      currentFoodPlan,
      nutritionTarget,
      nutritionTargetSnapshot,
      resolvedTrainingDay,
      planQualityMode,
      appMode,
      personalizationContext,
      blockedFoods: {
        allergies: user.nutritionPref?.allergies.map((food) => food.name) ?? [],
        excludedFoods: user.nutritionPref?.excludedFoods.map((food) => food.name) ?? []
      }
    };
  }

  private async getOwnedPlanOrThrow(userId: string, dailyPlanId: string) {
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

  private async generateReplacementFoodPlan(
    context: Awaited<ReturnType<DailyPlansService['getFoodRegenerationContext']>>,
    regeneration: {
      mode: 'FULL_MENU_REGENERATION' | 'MEAL_REGENERATION';
      reason?: string;
      selectedMealId?: string;
    }
  ) {
    const result = await this.nutritionAgent.generateDailyFoodPlan({
      planLocalDate: context.plan.planLocalDate,
      locale: this.resolvePlanningLocale(context.user),
      planQualityMode: context.planQualityMode,
      appMode: context.appMode,
      safeMode: context.user.safeMode,
      isMinor: context.user.isMinor,
      pregnancyStatus: context.user.profile?.pregnancyStatus,
      nutritionTarget: context.nutritionTarget,
      nutritionTargetSnapshot: context.nutritionTargetSnapshot,
      nutritionPreference: this.toNutritionAgentPreference(context.user),
      goalSummary: context.user.goal
        ? {
            primaryGoal: context.user.goal.primaryGoal,
            goalType: context.user.goal.goalType
          }
        : null,
      foodAdherenceSummary: context.personalizationContext.foodAdherenceSummary,
      mealPracticalityPreference: this.toMealPracticalityPreference(context.user),
      resolvedTrainingDay: context.resolvedTrainingDay,
      regeneration: {
        ...regeneration,
        existingFoodPlan: context.currentFoodPlan
      }
    });

    if (result.fallbackUsed || result.foodPlan.validation.status === 'FALLBACK') {
      throw new BadRequestException('Could not safely regenerate this meal plan. Your current plan was kept.');
    }

    return result;
  }

  private async persistRegeneratedFoodPlan(
    context: Awaited<ReturnType<DailyPlansService['getFoodRegenerationContext']>>,
    foodPlan: DailyFoodPlan
  ) {
    const nextPlanJson = this.withFoodPlan(context.currentPlanJson, foodPlan);
    const validation = await this.validateProviderPlan({
      providerPlan: nextPlanJson,
      blockedFoods: context.blockedFoods,
      planLocalDate: context.plan.planLocalDate,
      planTimezone: context.plan.planTimezone,
      user: context.user,
      personalizationContext: context.personalizationContext,
      forcedFallback: false,
      allowSafetyRetry: false
    });

    if (validation.status !== PlanStatus.READY) {
      throw new BadRequestException('Could not safely regenerate this meal plan. Your current plan was kept.');
    }

    const updated = await this.prisma.dailyPlan.update({
      where: { id: context.plan.id },
      data: {
        status: validation.status,
        planJson: validation.planJson as Prisma.JsonObject
      }
    });

    return this.toResponse(updated);
  }

  private toNutritionAgentPreference(user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>) {
    return user.nutritionPref
      ? {
          dietType: user.nutritionPref.dietType,
          mealsPerDay: user.nutritionPref.mealsPerDay,
          notes: user.nutritionPref.notes,
          allergies: user.nutritionPref.allergies.map((food) => food.name),
          excludedFoods: user.nutritionPref.excludedFoods.map((food) => food.name),
          dislikedFoods: user.nutritionPref.dislikedFoods.map((food) => food.name),
          preferredFoods: user.nutritionPref.preferredFoods.map((food) => food.name)
        }
      : null;
  }

  private toMealPracticalityPreference(
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>
  ): { cookingTime: 'VERY_QUICK' | 'FIFTEEN_TO_THIRTY' | 'LONGER' } | undefined {
    const answer = user.progressiveProfilePrompts[0]?.answerJson;

    if (
      answer === 'VERY_QUICK' ||
      answer === 'FIFTEEN_TO_THIRTY' ||
      answer === 'LONGER'
    ) {
      return { cookingTime: answer };
    }

    return undefined;
  }

  private nutritionTargetFromSnapshot(snapshot: NutritionTargetSnapshot): NutritionTarget {
    return {
      engineVersion: snapshot.engineVersion,
      localDate: snapshot.localDate,
      source: 'DETERMINISTIC_ENGINE',
      appMode: snapshot.appMode,
      primaryGoal: snapshot.primaryGoal,
      dayType: snapshot.dayType,
      calories: {
        targetKcal: snapshot.targetKcal,
        minKcal: snapshot.minKcal,
        maxKcal: snapshot.maxKcal,
        maintenanceEstimateKcal: snapshot.maintenanceEstimateKcal,
        adjustmentKcal: 0,
        adjustmentReason: 'stored_daily_plan_snapshot'
      },
      macros: {
        proteinGrams: snapshot.proteinGrams,
        carbsGrams: snapshot.carbsGrams,
        fatGrams: snapshot.fatGrams,
        proteinKcal: snapshot.proteinGrams * 4,
        carbsKcal: snapshot.carbsGrams * 4,
        fatKcal: snapshot.fatGrams * 9
      },
      context: {
        trainingEnabled: snapshot.appMode === 'NUTRITION_AND_TRAINING',
        scheduledTrainingDay: snapshot.dayType === 'TRAINING_DAY',
        plannedWorkoutDurationMinutes: null,
        plannedWorkoutIntensity: null,
        normalActivityLevel: null
      },
      safety: {
        status: snapshot.safetyStatus,
        reasons: snapshot.safetyReasons,
        warnings: []
      },
      explanation: this.normalizeNutritionTargetExplanation(snapshot.explanation)
    };
  }

  private getPlanExerciseMuscles(exercise: NonNullable<DailyPlanJson['training']['exercises']>[number]) {
    const values = [
      ...(exercise.exerciseSnapshot?.targetMuscles ?? []),
      ...(exercise.exerciseSnapshot?.secondaryMuscles ?? []),
      ...(exercise.targetMuscles ?? [])
    ];

    return [...new Set(values
      .map((value) => String(value).trim().toUpperCase())
      .filter((value): value is TargetMuscleGroup =>
        Object.values(TargetMuscleGroup).includes(value as TargetMuscleGroup)
      ))];
  }

  private normalizeNutritionTargetExplanation(
    explanation: NutritionTargetSnapshot['explanation']
  ): NutritionTargetExplanation {
    if ('titleCode' in explanation && 'reasonCodes' in explanation) {
      return explanation;
    }

    return {
      titleCode: 'TODAY_TARGET',
      reasonCodes: []
    };
  }

  private createFallbackTrainingDayContext(
    planLocalDate: string,
    nutritionTarget: NutritionTarget
  ): ResolvedTrainingDayContext {
    return {
      source: 'GLOBAL_DEFAULTS',
      localDate: planLocalDate,
      dayOfWeek: 'MONDAY',
      isTrainingDay: nutritionTarget.dayType === 'TRAINING_DAY',
      targetMuscles: [],
      environment: null,
      availableEquipment: [],
      durationMinutes: 30,
      protocolPreference: null,
      inheritedFields: []
    };
  }

  private markFoodPlanRegenerated(
    foodPlan: DailyFoodPlan,
    mode: 'FULL_MENU_REGENERATION' | 'MEAL_REGENERATION',
    selectedMealId?: string
  ): DailyFoodPlan {
    const marker = mode === 'FULL_MENU_REGENERATION'
      ? "Menu refreshed while preserving today's nutrition target."
      : "Meal refreshed while preserving today's nutrition target.";

    return {
      ...foodPlan,
      meals: foodPlan.meals.map((meal) => {
        if (mode === 'MEAL_REGENERATION' && meal.id !== selectedMealId) {
          return meal;
        }

        return {
          ...meal,
          shortDescription: meal.shortDescription
            ? `${meal.shortDescription} ${marker}`
            : marker
        };
      })
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
            dislikedFoods: {
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
        },
        progressiveProfilePrompts: {
          where: {
            promptKey: ProgressiveProfilePromptKey.COOKING_TIME,
            status: ProgressiveProfilePromptStatus.ANSWERED
          },
          select: {
            answerJson: true
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

    const consumed: Array<{ id: string; amount: number }> = [];

    for (const check of usageChecks) {
      const usage = await this.usageGuardService.checkAndConsume(
        userId,
        check.feature,
        check.periodType
      );
      consumed.push({ id: usage.id, amount: 1 });
    }

    return consumed;
  }

  private async refundConsumedUsage(consumedUsage: Array<{ id: string; amount: number }>) {
    for (const usage of consumedUsage.reverse()) {
      try {
        await this.usageGuardService.refundById(usage.id, usage.amount);
      } catch (error) {
        this.logger.warn(
          `usage refund failed; usageLedgerId=${usage.id}; reason=${error instanceof Error ? error.name : 'unknown'}`
        );
      }
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
              dislikedFoods: input.user.nutritionPref.dislikedFoods.map((food) => food.name),
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
          minExerciseCount: input.exerciseSelection.minExerciseCount,
          maxExerciseCount: input.exerciseSelection.maxExerciseCount,
          workoutDurationMinutes: input.exerciseSelection.workoutDurationMinutes,
          volumePlan: input.exerciseSelection.volumePlan
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
        const rejection = this.classifySafetyAgentRejection(parsedReview.data);
        if (!rejection.isBlocking) {
          this.logger.warn(
            [
              'SafetyAgent non-blocking review accepted',
              `provider=${this.safetyAgentConfig.provider}`,
              `riskLevel=${parsedReview.data.riskLevel}`,
              `reasonCount=${parsedReview.data.reasons.length}`,
              'categories=none'
            ].join('; ')
          );
          return {
            status: PlanStatus.READY,
            planJson: this.withSafetyAgentDebug(input.planJson, {
              approved: true,
              riskLevel: 'low',
              retryUsed: input.retryUsed,
              retryResult: input.retryUsed ? 'approved' : 'not_used'
            })
          };
        }

        this.logger.warn(
          [
            'SafetyAgent blocking review',
            `provider=${this.safetyAgentConfig.provider}`,
            `riskLevel=${parsedReview.data.riskLevel}`,
            `reasonCount=${parsedReview.data.reasons.length}`,
            `categories=${rejection.categories.join(',')}`
          ].join('; ')
        );
        for (const category of rejection.categories) {
          this.logger.warn(`SafetyAgent blocking category=${category}`);
        }
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

  private classifySafetyAgentRejection(review: SafetyAgentReview) {
    const reviewText = [...review.reasons, ...review.requiredChanges].join(' ');
    const categories = MATERIAL_SAFETY_REVIEW_PATTERNS
      .filter(({ pattern }) => pattern.test(reviewText))
      .map(({ category }) => category);

    return {
      categories,
      // A high-risk verdict remains fail-closed. Medium findings must identify
      // a material safety category; editorial feedback is not a reason to lose a plan.
      isBlocking: review.riskLevel === 'high' || categories.length > 0
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
        ...planJson.debug,
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
              },
              ...(healthPlanningContext.wearableContext
                ? {
                    wearableContext: {
                      source: healthPlanningContext.wearableContext.source,
                      hasRecentData: healthPlanningContext.wearableContext.hasRecentData,
                      isStale: healthPlanningContext.wearableContext.isStale,
                      localDate: healthPlanningContext.wearableContext.localDate
                    }
                  }
                : {}),
              trainingLoadContext: {
                hasTrainingLoadContext:
                  healthPlanningContext.trainingLoadContext.hasTrainingLoadContext,
                readinessHint: healthPlanningContext.trainingLoadContext.readinessHint,
                reasons: healthPlanningContext.trainingLoadContext.reasons
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
      `minExerciseCount=${selection.minExerciseCount}`,
      `maxExerciseCount=${selection.maxExerciseCount}`,
      `durationMinutes=${selection.workoutDurationMinutes}`,
      `sets=${selection.volumePlan.suggestedSetsPerExercise}`,
      `restSeconds=${selection.volumePlan.suggestedRestSeconds}`,
      `volumeReasons=${selection.volumePlan.volumeReasonCodes.join(',') || 'none'}`,
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
          minExerciseCount: selection.minExerciseCount,
          maxExerciseCount: selection.maxExerciseCount,
          workoutDurationMinutes: selection.workoutDurationMinutes,
          volumeReasonCodes: selection.volumePlan.volumeReasonCodes,
          fallbackMode: selection.fallbackMode,
          usedAiRetry,
          usedDeterministicFallback,
          resolvedLocale: selection.candidates[0]?.resolvedLocale ?? 'en-US'
        }
      }
    };
  }

  private withGenerationSectionDebug(
    planJson: DailyPlanJson,
    usedDeterministicExerciseFallback: boolean
  ): DailyPlanJson {
    if (!planJson.debug) return planJson;

    const adjustedSections = new Set(planJson.debug.generation?.adjustedSections ?? []);
    if (planJson.debug.provider === 'fallback') {
      adjustedSections.add('CORE');
      adjustedSections.add('TRAINING');
      adjustedSections.add('RECOVERY');
    }
    if (planJson.nutrition.foodPlan?.source === 'DETERMINISTIC_FALLBACK') {
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

  /**
   * A rejected AI plan must not erase a user's already-resolved training day.
   * These exercises are selected from the vetted library, so this path contains
   * no rejected provider text and remains conservative by design.
   */
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
        recommendation: 'Follow your planned session at a light, controlled pace.',
        intensity: 'LIGHT',
        notes: 'This version uses your saved routine and safer exercise options. Stop if discomfort increases.'
      }
    };

    this.logger.warn(
      `safe training-day fallback restored; exerciseCount=${input.exerciseSelection.requestedExerciseCount}`
    );
    return composeDeterministicFallbackWorkout(conservativePlan, input.exerciseSelection);
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

  private withFoodPlan(planJson: DailyPlanJson, foodPlan: DailyPlanJson['nutrition']['foodPlan']): DailyPlanJson {
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

  private ensureFoodPlan(
    planJson: DailyPlanJson,
    foodPlan: NonNullable<DailyPlanJson['nutrition']['foodPlan']>
  ): DailyPlanJson {
    return planJson.nutrition.foodPlan ? planJson : this.withFoodPlan(planJson, foodPlan);
  }

  private withRecoveryAwareContext(
    planJson: DailyPlanJson,
    personalizationContext: GenerateDailyPlanPersonalizationContext,
    trainingEnabled: boolean,
    isTrainingDay: boolean
  ): DailyPlanJson {
    return withRecoveryAwareContextNotes(planJson, {
      healthPlanningContext: personalizationContext.healthPlanningContext,
      trainingEnabled,
      isTrainingDay
    });
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

  private async withTrainingLoadAgentSnapshot(input: {
    planJson: DailyPlanJson;
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>;
    planLocalDate: string;
    planQualityMode: PlanQualityMode;
    personalizationContext: GenerateDailyPlanPersonalizationContext;
    exerciseSelection: ExerciseSelectionResult;
    resolvedTrainingDay: ResolvedTrainingDayContext;
    appMode: GoalImpactMode;
  }): Promise<DailyPlanJson> {
    const agentInput = {
      planLocalDate: input.planLocalDate,
      locale: this.resolvePlanningLocale(input.user),
      appMode: input.appMode,
      safeMode: input.user.safeMode,
      isMinor: input.user.isMinor,
      planQualityMode: input.planQualityMode,
      trainingLevel: input.user.trainingPreference?.trainingLevel ?? null,
      resolvedTrainingDay: input.resolvedTrainingDay,
      personalizationContext: input.personalizationContext,
      exerciseSelection: input.exerciseSelection,
      planTraining: input.planJson.training
    };
    const canUseAiTrainingLoadAgent =
      this.getProviderDebugName() === 'openai' &&
      (await this.featureAccessService.canUseAiTrainingLoadAgent(input.user.id));

    if (!canUseAiTrainingLoadAgent) {
      return {
        ...input.planJson,
        trainingLoadAgentSnapshot: this.trainingLoadAgent.createFallback(agentInput, [
          'tier_basic_guidance'
        ])
      };
    }

    let consumedUsage: { id: string; amount: number } | null = null;
    try {
      const usage = await this.usageGuardService.checkAndConsume(
        input.user.id,
        UsageFeature.AI_TRAINING_LOAD_AGENT,
        UsagePeriodType.DAILY
      );
      consumedUsage = { id: usage.id, amount: 1 };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.warn(
          `AI TrainingLoadAgent gated; using deterministic fallback; reason=${error.name}`
        );
      }
      return {
        ...input.planJson,
        trainingLoadAgentSnapshot: this.trainingLoadAgent.createFallback(agentInput, [
          'ai_training_load_agent_limit_reached'
        ])
      };
    }

    const snapshot = await this.trainingLoadAgent.generate(agentInput);

    if (
      consumedUsage &&
      snapshot.source === 'DETERMINISTIC_FALLBACK' &&
      snapshot.validation.reasons.includes('training_load_agent_request_failed')
    ) {
      await this.refundConsumedUsage([consumedUsage]);
    }

    return {
      ...input.planJson,
      trainingLoadAgentSnapshot: snapshot
    };
  }

  private resolveAppMode(user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>) {
    return user.goal?.impactMode ?? (user.noTrainingPlanned ? GoalImpactMode.NUTRITION_ONLY : GoalImpactMode.NUTRITION_AND_TRAINING);
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

  private getProviderDebugName() {
    return this.aiProvider.constructor?.name === 'OpenAiProviderService' ? 'openai' : 'mock';
  }

  private resolvePersistedPlanStatus(result: DailyPlanValidationResult) {
    // A complete deterministic replacement is a usable plan, not a user-facing failure.
    // Provenance and operational fallback metrics remain in plan.debug and AiOperationLog.
    return result.planJson.debug?.generation?.isComplete
      ? PlanStatus.READY
      : result.status;
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
    const [checkInSummary, foodAdherenceSummary, healthPlanningContext] = await Promise.all([
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
      noTrainingPlanned: !trainingEnabled || !resolvedTrainingDay.isTrainingDay,
      trainingSchedule: trainingEnabled && resolvedTrainingDay.isTrainingDay
        ? [{
            durationMinutes: resolvedTrainingDay.durationMinutes,
            intensity: 'MODERATE',
            description: resolvedTrainingDay.source === 'DAILY_OVERRIDE'
              ? `Daily override: ${resolvedTrainingDay.dayOfWeek}`
              : resolvedTrainingDay.source === 'WEEKLY_SCHEDULE'
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
        commonTags: this.getCommonFeedbackTags(recentFeedback.flatMap((feedback) => feedback.tags))
      },
      historySummary: {
        recentPlanCount: recentPlans.length,
        readinessLevels: [...new Set(recentPlans.map((plan) => plan.readinessLevel))],
        fallbackCount: recentPlans.filter((plan) => this.wasSafelyAdjustedPlan(plan)).length
      }
    };
  }

  private wasSafelyAdjustedPlan(plan: {
    status: PlanStatus;
    planLocalDate: string;
    planTimezone: string;
    readinessLevel: string;
    planJson: Prisma.JsonValue;
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
    const adjustedSections = input.planJson.debug?.generation?.adjustedSections ?? [];
    const fallbackReason = this.getFallbackReason(input.planJson)
      ?? this.getSectionFallbackReason(input.planJson, adjustedSections);
    await this.recordAiOperationSafely({
      userId: input.userId,
      feature: AiOperationFeature.DAILY_PLAN,
      provider: this.getAiOperationProvider(),
      model: this.getAiOperationModel(),
      status:
        input.status === PlanStatus.READY && adjustedSections.length === 0
          ? AiOperationStatus.SUCCESS
          : AiOperationStatus.FALLBACK,
      latencyMs: input.latencyMs,
      retryCount: this.getSafetyRetryUsed(input.planJson) ? 1 : 0,
      safetyAgentEnabled: this.safetyAgentConfig.enabled,
      safetyAgentProvider: this.safetyAgentConfig.provider,
      safetyAgentApproved: this.getSafetyAgentApproved(input.planJson),
      fallbackReason,
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

  private getSectionFallbackReason(
    planJson: DailyPlanJson,
    adjustedSections: Array<'CORE' | 'NUTRITION' | 'TRAINING' | 'RECOVERY'>
  ) {
    const foodPlanReason = planJson.nutrition.foodPlan?.validation.status === 'FALLBACK'
      ? planJson.nutrition.foodPlan.validation.reasons[0]
      : null;
    if (foodPlanReason) return foodPlanReason;
    if (adjustedSections.includes('TRAINING')) return 'deterministic_training_section_adjustment';
    if (adjustedSections.length > 0) return 'deterministic_section_adjustment';
    return null;
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
