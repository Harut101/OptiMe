import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import {
  GoalImpactMode,
  PlanQualityMode,
  PlanStatus,
  Prisma,
  PreferredLocale,
  ProgressiveProfilePromptKey,
  TargetMuscleGroup,
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
  type SupportedLocale,
  type FoodIngredient
} from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import {
  AiProvider,
  GenerateDailyPlanExerciseFeedback,
  GenerateDailyPlanPersonalizationContext,
  GenerateDailyPlanSafetyFeedback
} from '../ai/ai-provider.interface';
import { AI_PROVIDER } from '../ai/ai-provider.token';
import { OpenAiProviderError } from '../ai/open-ai-provider.error';
import type {
  CreateSafetyFallbackInput,
  DailyPlanSafetyResult
} from '../daily-plan-orchestrator/daily-plan-safety-orchestrator.interface';
import { dailyPlanPlanningUserSelect } from '../daily-plan-orchestrator/daily-plan-planning-user';
import { DailyPlanOrchestratorService } from '../daily-plan-orchestrator/daily-plan-orchestrator.service';
import { FeatureAccessService } from '../entitlements/feature-access.service';
import type { ExerciseSelectionResult } from '../exercise-selection/exercise-selection.types';
import { FoodAvailabilityService } from '../food-availability/food-availability.service';
import { FoodIngredientSwapService } from './food-ingredient-swap.service';
import { NutritionAgentService } from '../nutrition-agent/nutrition-agent.service';
import { FoodPlanValidationService } from '../nutrition-agent/food-plan-validation.service';
import { normalizeFoodPlanNutrition } from '../nutrition-agent/food-plan-nutrition-normalizer';
import { NutritionTargetsService } from '../nutrition-targets/nutrition-targets.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { createSafeFallbackPlan } from '../safety/safe-fallback-plan.factory';
import {
  SAFETY_AGENT_CONFIG,
  SafetyAgentConfig
} from '../safety-agent/safety-agent.token';
import { UsageGuardService } from '../usage/usage-guard.service';
import { TrainingPlanAgentService } from '../training-plan-agent/training-plan-agent.service';
import { TrainingScheduleResolverService } from '../training-schedule/training-schedule-resolver.service';
import { mapPainAreasToMuscles, normalizePainAreas } from '../workout-sessions/workout-pain-mapping';
import { DailyPlanJson, dailyPlanJsonSchema } from './daily-plan-json.schema';
import { normalizeDailyPlanJson } from './daily-plan-normalizer';
import { GenerateDailyPlanDto } from './dto/generate-daily-plan.dto';
import { ExcludeFoodIngredientDto } from './dto/exclude-food-ingredient.dto';
import { ApplyFoodIngredientSwapDto } from './dto/apply-food-ingredient-swap.dto';
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

@Injectable()
export class DailyPlansService {
  private readonly logger = new Logger(DailyPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureAccessService: FeatureAccessService,
    private readonly trainingPlanAgent: TrainingPlanAgentService,
    private readonly usageGuardService: UsageGuardService,
    private readonly onboardingService: OnboardingService,
    private readonly dailyPlanOrchestrator: DailyPlanOrchestratorService,
    private readonly foodAvailabilityService: FoodAvailabilityService,
    private readonly foodIngredientSwapService: FoodIngredientSwapService,
    private readonly nutritionAgent: NutritionAgentService,
    private readonly foodPlanValidator: FoodPlanValidationService,
    private readonly nutritionTargetsService: NutritionTargetsService,
    private readonly trainingScheduleResolver: TrainingScheduleResolverService,
    private readonly painAwareExerciseReplacement: PainAwareExerciseReplacementService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
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
    const targetLocale = this.resolvePlanningLocale(user);

    const existingPlan = await this.prisma.dailyPlan.findUnique({
      where: {
        userId_planLocalDate_planTimezone: {
          userId,
          planLocalDate,
          planTimezone
        }
      }
    });

    const recreateForCurrentLanguage = Boolean(dto.recreateForCurrentLanguage);

    if (recreateForCurrentLanguage && !existingPlan) {
      throw new BadRequestException('A current daily plan is required before it can be recreated in another language.');
    }

    const existingPlanParsed = existingPlan
      ? dailyPlanJsonSchema.safeParse(existingPlan.planJson)
      : null;
    const existingPlanLocale = existingPlanParsed?.success
      ? existingPlanParsed.data.contentLocale
      : undefined;

    if (existingPlan && existingPlanLocale === targetLocale && recreateForCurrentLanguage) {
      return this.toResponse(existingPlan);
    }

    if (existingPlan && !dto.forceRegenerate && !recreateForCurrentLanguage) {
      return this.toResponse(existingPlan);
    }

    this.assertReadyToGenerate(user);

    const operationStartedAt = Date.now();
    const consumedUsage: Array<{ id: string; amount: number }> = [];

    try {
      if (!recreateForCurrentLanguage) {
        consumedUsage.push(
          ...(await this.consumeDailyPlanUsage(userId, Boolean(existingPlan && dto.forceRegenerate)))
        );
      } else {
        this.logger.log(`daily plan language recreation started; targetLocale=${targetLocale}`);
      }
      this.logger.log(`daily plan generation started; provider=${this.getProviderDebugName()}`);
      const {
        planQualityMode,
        availableFoodSlugs,
        appMode,
        trainingEnabled,
        resolvedTrainingDay,
        nutritionTarget,
        personalizationContext,
        exerciseSelection,
        blockedFoods
      } = await this.dailyPlanOrchestrator.prepareGenerationContext({
        user,
        planLocalDate
      });
      const generationWorkflow =
        await this.dailyPlanOrchestrator.executeGenerationWorkflow({
          generateProviderPlan: ({ safetyFeedback } = {}) =>
            this.generateProviderPlanOrFallback({
              user,
              planLocalDate,
              planTimezone,
              planQualityMode,
              personalizationContext,
              exerciseSelection,
              safetyFeedback
            }),
          generateFoodPlan: async () => {
            const result = await this.nutritionAgent.generateDailyFoodPlan({
              planLocalDate,
              locale: targetLocale,
              planQualityMode,
              appMode,
              safeMode: user.safeMode,
              isMinor: user.isMinor,
              pregnancyStatus: user.profile?.pregnancyStatus,
              nutritionTarget,
              nutritionTargetSnapshot:
                this.nutritionTargetsService.toSnapshot(nutritionTarget),
              nutritionPreference: user.nutritionPref
                ? {
                    dietType: user.nutritionPref.dietType,
                    mealsPerDay: user.nutritionPref.mealsPerDay,
                    notes: user.nutritionPref.notes,
                    allergies: user.nutritionPref.allergies.map(
                      (food) => food.name
                    ),
                    excludedFoods: user.nutritionPref.excludedFoods.map(
                      (food) => food.name
                    ),
                    dislikedFoods: user.nutritionPref.dislikedFoods.map(
                      (food) => food.name
                    ),
                    preferredFoods: user.nutritionPref.preferredFoods.map(
                      (food) => food.name
                    )
                  }
                : null,
              goalSummary: user.goal
                ? {
                    primaryGoal: user.goal.primaryGoal,
                    goalType: user.goal.goalType
                  }
                : null,
              foodAdherenceSummary:
                personalizationContext.foodAdherenceSummary,
              mealPracticalityPreference:
                this.toMealPracticalityPreference(user),
              mealTimingPreference: this.toMealTimingPreference(user),
              availableFoodSlugs,
              resolvedTrainingDay
            });
            return result.foodPlan;
          },
          buildAssemblyInput: ({
            providerPlanResult,
            foodPlan,
            isSafetyRetry
          }) => ({
            providerPlanResult,
            foodPlan,
            exerciseSelection,
            recoveryProtocol:
              personalizationContext.selectedProtocols?.recoveryProtocol,
            healthPlanningContext:
              personalizationContext.healthPlanningContext,
            trainingEnabled,
            isTrainingDay: resolvedTrainingDay.isTrainingDay,
            decorateProviderPlan: (planJson) =>
              this.dailyPlanOrchestrator.prepareProviderPlanDocument({
                planJson,
                resolvedTrainingDay,
                nutritionTarget,
                appMode,
                locale: targetLocale
              }),
            attachFoodPlan: (planJson, foodPlanToAttach) =>
              this.dailyPlanOrchestrator.attachFoodPlan(
                planJson,
                foodPlanToAttach
              ),
            applyTrainingLoad: (planJson) =>
              this.dailyPlanOrchestrator.applyTrainingLoad({
                planJson,
                user,
                locale: targetLocale,
                planLocalDate,
                planQualityMode,
                personalizationContext,
                exerciseSelection,
                resolvedTrainingDay,
                appMode,
                provider: this.getProviderDebugName()
              }),
            retryTrainingPlan:
              !isSafetyRetry && this.getProviderDebugName() === 'openai'
                ? (exerciseFeedback) =>
                    this.generateProviderPlanOrFallback({
                      user,
                      planLocalDate,
                      planTimezone,
                      planQualityMode,
                      personalizationContext,
                      exerciseSelection,
                      exerciseFeedback
                    })
                : undefined
          }),
          validateAttempt: ({
            providerPlanResult,
            allowSafetyRetry,
            safetyRetryUsed
          }) =>
            this.validateProviderPlan({
              providerPlan: providerPlanResult.planJson,
              blockedFoods,
              planLocalDate,
              planTimezone,
              user,
              personalizationContext,
              forcedFallback:
                providerPlanResult.status === PlanStatus.FALLBACK,
              allowSafetyRetry,
              safetyRetryUsed
            }),
          canUseSafetyRetry: (providerStatus) =>
            this.canUseSafetyFeedbackRetry(providerStatus),
          getProviderFallbackReason: (providerPlanResult) =>
            this.getFallbackReason(providerPlanResult.planJson),
          createRetryFailureFallback: (fallbackReason) =>
            this.createSafetyAgentFallback({
              planLocalDate,
              planTimezone,
              locale: targetLocale,
              fallbackReason,
              retryUsed: true,
              retryResult: 'failed'
            })
        });
      const {
        safePlanResult,
        finalFoodPlan,
        trainingPreparation: exercisePreparation
      } = generationWorkflow;
      const finalizedGeneration =
        await this.dailyPlanOrchestrator.finalizeGenerationResult({
          userId,
          planLocalDate,
          existingPlanId: existingPlan?.id,
          safePlanResult,
          finalFoodPlan,
          trainingPreparation: exercisePreparation,
          exerciseSelection,
          resolvedTrainingDay,
          nutritionTarget,
          planQualityMode,
          selectedProtocols: personalizationContext.selectedProtocols,
          healthPlanningContext:
            personalizationContext.healthPlanningContext,
          trainingEnabled
        });
      const finalizedPlanResult = finalizedGeneration.safePlanResult;
      const status = finalizedGeneration.status;
      this.logger.log(
        `daily plan generation completed; safe replacement used: ${finalizedPlanResult.status === PlanStatus.FALLBACK}; persisted status=${status}`
      );

      if (
        recreateForCurrentLanguage &&
        existingPlan &&
        finalizedPlanResult.status === PlanStatus.FALLBACK
      ) {
        this.logger.warn(
          'daily plan language recreation did not produce a ready plan; existing plan preserved'
        );
        await this.dailyPlanOrchestrator.recordGeneration({
          userId,
          status,
          planJson: finalizedPlanResult.planJson,
          latencyMs: Date.now() - operationStartedAt,
          operation: this.getDailyPlanOperationContext()
        });
        return this.toResponse(existingPlan);
      }

      const { plan } =
        await this.dailyPlanOrchestrator.persistGeneratedPlan({
          userId,
          existingPlanId: existingPlan?.id,
          planLocalDate,
          planTimezone,
          result: finalizedPlanResult,
          operationStartedAt,
          operation: this.getDailyPlanOperationContext()
        });

      return this.toResponse(plan);
    } catch (error) {
      await this.refundConsumedUsage(consumedUsage);
      await this.dailyPlanOrchestrator.recordGenerationError({
        userId,
        latencyMs: Date.now() - operationStartedAt,
        error,
        operation: this.getDailyPlanOperationContext()
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

  async getFoodIngredientSwapSuggestions(
    userId: string,
    dailyPlanId: string,
    mealId: string,
    ingredientSlug: string
  ) {
    const context = await this.getFoodRegenerationContext(userId, dailyPlanId);
    const meal = context.currentFoodPlan.meals.find((item) => item.id === mealId);
    if (!meal) throw new NotFoundException('Meal not found in this plan.');

    const ingredient = meal.ingredients.find((item) => item.catalogFoodSlug === ingredientSlug);
    if (!ingredient) throw new NotFoundException('Ingredient not found in this meal.');
    if (!ingredient.catalogFoodSlug) {
      throw new BadRequestException('This ingredient does not support catalog substitutions yet.');
    }

    const suggestions = await this.foodIngredientSwapService.getSuggestions({
      ingredient,
      locale: this.resolvePlanningLocale(context.user),
      dietType: context.user.nutritionPref?.dietType ?? null,
      restrictions: {
        allergies: context.user.nutritionPref?.allergies.map((food) => food.name) ?? [],
        excludedFoods: context.user.nutritionPref?.excludedFoods.map((food) => food.name) ?? [],
        dislikedFoods: context.user.nutritionPref?.dislikedFoods.map((food) => food.name) ?? []
      }
    });

    return {
      dailyPlanId,
      mealId,
      ingredientSlug,
      suggestions
    };
  }

  async applyFoodIngredientSwap(
    userId: string,
    dailyPlanId: string,
    mealId: string,
    ingredientSlug: string,
    dto: ApplyFoodIngredientSwapDto
  ) {
    const context = await this.getFoodRegenerationContext(userId, dailyPlanId);
    const selectedMeal = context.currentFoodPlan.meals.find((meal) => meal.id === mealId);
    if (!selectedMeal) throw new NotFoundException('Meal not found in this plan.');

    const originalIngredient = selectedMeal.ingredients.find((ingredient) => (
      ingredient.catalogFoodSlug === ingredientSlug
    ));
    if (!originalIngredient?.catalogFoodSlug) {
      throw new NotFoundException('Ingredient not found in this meal.');
    }

    const suggestions = await this.foodIngredientSwapService.getSuggestions({
      ingredient: originalIngredient,
      locale: this.resolvePlanningLocale(context.user),
      dietType: context.user.nutritionPref?.dietType ?? null,
      restrictions: {
        allergies: context.user.nutritionPref?.allergies.map((food) => food.name) ?? [],
        excludedFoods: context.user.nutritionPref?.excludedFoods.map((food) => food.name) ?? [],
        dislikedFoods: context.user.nutritionPref?.dislikedFoods.map((food) => food.name) ?? []
      }
    });
    const suggestion = suggestions.find((item) => item.slug === dto.replacementCatalogFoodSlug);
    if (!suggestion) {
      throw new BadRequestException(
        'This ingredient alternative is no longer safe for your current food preferences.'
      );
    }

    const replacement: FoodIngredient = {
      catalogFoodSlug: suggestion.slug,
      name: suggestion.name,
      quantity: suggestion.quantity,
      unit: suggestion.unit,
      caloriesKcal: suggestion.caloriesKcal,
      proteinGrams: suggestion.proteinGrams,
      carbsGrams: suggestion.carbsGrams,
      fatGrams: suggestion.fatGrams,
      isOptional: originalIngredient.isOptional
    };
    const nextFoodPlan = normalizeFoodPlanNutrition({
      ...context.currentFoodPlan,
      source: 'NUTRITION_AGENT',
      validation: {
        ...context.currentFoodPlan.validation,
        status: 'VALID',
        reasons: []
      },
      meals: context.currentFoodPlan.meals.map((meal) => (
        meal.id !== mealId
          ? meal
          : {
              ...meal,
              ingredients: meal.ingredients.map((ingredient) => (
                ingredient.catalogFoodSlug === ingredientSlug ? replacement : ingredient
              )),
              substitutions: [
                ...meal.substitutions.slice(-7),
                {
                  originalItem: originalIngredient.name,
                  replacementItem: replacement.name,
                  servingSummary: `${replacement.quantity} ${replacement.unit}`,
                  reasonCode: 'SIMILAR_MACROS',
                  macroImpactNote: null
                }
              ]
            }
      ))
    });

    const foodPlanValidation = this.foodPlanValidator.validate(nextFoodPlan, {
      nutritionTarget: context.nutritionTarget,
      nutritionTargetSnapshot: context.nutritionTargetSnapshot,
      allergies: context.user.nutritionPref?.allergies.map((food) => food.name) ?? [],
      excludedFoods: context.user.nutritionPref?.excludedFoods.map((food) => food.name) ?? [],
      dislikedFoods: context.user.nutritionPref?.dislikedFoods.map((food) => food.name) ?? [],
      safeMode: context.user.safeMode,
      isMinor: context.user.isMinor,
      pregnancyStatus: context.user.profile?.pregnancyStatus
    });

    if (!foodPlanValidation.passed) {
      this.logger.warn(
        `ingredient swap rejected; planId=${dailyPlanId}; mealId=${mealId}; reasonCodes=${foodPlanValidation.reasons.join(',')}`
      );
      throw new BadRequestException(
        'This alternative would move your meal outside today\'s safe nutrition target. Your current meal was kept.'
      );
    }

    this.logger.log(
      `ingredient swap applied; planId=${dailyPlanId}; mealId=${mealId}; originalSlug=${ingredientSlug}; replacementSlug=${suggestion.slug}`
    );
    return this.persistRegeneratedFoodPlan(context, nextFoodPlan);
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
    const appMode = this.dailyPlanOrchestrator.resolveAppMode(user);
    const resolvedTrainingDay = currentPlan.trainingScheduleSnapshot
      ?? await this.trainingScheduleResolver.resolveForUser({
        userId,
        planLocalDate: plan.planLocalDate,
        trainingPreference: user.trainingPreference,
        legacyScheduleItems: user.schedules,
        noTrainingPlanned: appMode !== GoalImpactMode.NUTRITION_AND_TRAINING || user.noTrainingPlanned
      });
    const personalizationContext =
      await this.dailyPlanOrchestrator.preparePersonalizationContext({
        user,
        planQualityMode,
        planLocalDate: plan.planLocalDate,
        resolvedTrainingDay,
        appMode
      });
    const selectionContext =
      this.dailyPlanOrchestrator.buildExerciseSelectionContext({
        user,
        locale: this.resolvePlanningLocale(user),
        planLocalDate: plan.planLocalDate,
        planQualityMode,
        personalizationContext,
        resolvedTrainingDay
      });
    const selection = await this.trainingPlanAgent.selectCandidates({
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
    const personalizationContext =
      await this.dailyPlanOrchestrator.preparePersonalizationContext({
        user,
        planQualityMode,
        planLocalDate: plan.planLocalDate,
        resolvedTrainingDay,
        appMode
      });
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
    const availableFoodSlugs = await this.foodAvailabilityService.getAvailableFoodSlugs(
      context.user.id,
      context.plan.planLocalDate
    );
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
      mealTimingPreference: this.toMealTimingPreference(context.user),
      availableFoodSlugs,
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
    const nextPlanJson = this.dailyPlanOrchestrator.attachFoodPlan(
      context.currentPlanJson,
      foodPlan
    );
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
    const answer = user.progressiveProfilePrompts.find(
      (prompt) => prompt.promptKey === ProgressiveProfilePromptKey.COOKING_TIME
    )?.answerJson;

    if (
      answer === 'VERY_QUICK' ||
      answer === 'FIFTEEN_TO_THIRTY' ||
      answer === 'LONGER'
    ) {
      return { cookingTime: answer };
    }

    return undefined;
  }

  private toMealTimingPreference(
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>
  ): 'EARLIER' | 'EVENLY_SPACED' | 'LATER' | 'FLEXIBLE' | undefined {
    const answer = user.progressiveProfilePrompts.find(
      (prompt) => prompt.promptKey === ProgressiveProfilePromptKey.MEAL_TIMING
    )?.answerJson;

    if (
      answer === 'EARLIER' ||
      answer === 'EVENLY_SPACED' ||
      answer === 'LATER' ||
      answer === 'FLEXIBLE'
    ) {
      return answer;
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
      select: dailyPlanPlanningUserSelect
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
        locale: this.resolvePlanningLocale(input.user),
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
            locale: this.resolvePlanningLocale(input.user),
            reasons: [error.fallbackReason]
          })
        };
      }

      throw error;
    }
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
  }): DailyPlanSafetyResult | Promise<DailyPlanSafetyResult> {
    return this.dailyPlanOrchestrator.validateBeforePersistence({
      providerPlan: input.providerPlan,
      blockedFoods: input.blockedFoods,
      planLocalDate: input.planLocalDate,
      planTimezone: input.planTimezone,
      locale: this.resolvePlanningLocale(input.user),
      userContext: {
        safeMode: input.user.safeMode,
        isMinor: input.user.isMinor,
        gender: input.user.profile?.gender,
        pregnancyStatus: input.user.profile?.pregnancyStatus,
        trainingLevel: input.user.trainingPreference?.trainingLevel,
        limitationsOrPainAreas:
          input.user.trainingPreference?.limitationsOrPainAreas ?? [],
        painOrDiscomfortReported:
          input.personalizationContext.checkInSummary
            ?.painOrDiscomfortReported ?? false,
        highTirednessReported:
          input.personalizationContext.checkInSummary
            ?.highTirednessReported ?? false,
        goal: input.user.goal
          ? {
              goalType: input.user.goal.goalType,
              targetWeightKg: input.user.goal.targetWeightKg,
              targetTimelineDays: input.user.goal.targetTimelineDays,
              impactMode: input.user.goal.impactMode
            }
          : null
      },
      forcedFallback: input.forcedFallback,
      allowSafetyRetry: input.allowSafetyRetry,
      safetyRetryUsed: input.safetyRetryUsed
    });
  }

  private createSafetyAgentFallback(
    input: CreateSafetyFallbackInput
  ): DailyPlanSafetyResult {
    return this.dailyPlanOrchestrator.createSafetyFallback(input);
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

  private getDailyPlanOperationContext() {
    return {
      provider: this.getProviderDebugName(),
      safetyAgentEnabled: this.safetyAgentConfig.enabled,
      safetyAgentProvider: this.safetyAgentConfig.provider
    } as const;
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
