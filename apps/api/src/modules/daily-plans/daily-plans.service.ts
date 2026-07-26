import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import {
  GoalImpactMode,
  PlanStatus,
  Prisma,
  PreferredLocale,
  TargetMuscleGroup
} from '@prisma/client';
import {
  resolveSupportedLocale,
  type SupportedLocale,
  type FoodIngredient
} from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { DailyPlanFoodContextService } from '../daily-plan-orchestrator/daily-plan-food-context.service';
import { DailyPlanFoodRegenerationUseCaseService } from '../daily-plan-orchestrator/daily-plan-food-regeneration-use-case.service';
import { DailyPlanGenerationUseCaseService } from '../daily-plan-orchestrator/daily-plan-generation-use-case.service';
import { dailyPlanPlanningUserSelect } from '../daily-plan-orchestrator/daily-plan-planning-user';
import { DailyPlanOrchestratorService } from '../daily-plan-orchestrator/daily-plan-orchestrator.service';
import { FeatureAccessService } from '../entitlements/feature-access.service';
import { FoodIngredientSwapService } from './food-ingredient-swap.service';
import { FoodPlanValidationService } from '../nutrition-agent/food-plan-validation.service';
import { normalizeFoodPlanNutrition } from '../nutrition-agent/food-plan-nutrition-normalizer';
import { NutritionTargetsService } from '../nutrition-targets/nutrition-targets.service';
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
    private readonly dailyPlanOrchestrator: DailyPlanOrchestratorService,
    private readonly generationUseCase: DailyPlanGenerationUseCaseService,
    private readonly foodContextService: DailyPlanFoodContextService,
    private readonly foodRegenerationUseCase: DailyPlanFoodRegenerationUseCaseService,
    private readonly foodIngredientSwapService: FoodIngredientSwapService,
    private readonly foodPlanValidator: FoodPlanValidationService,
    private readonly nutritionTargetsService: NutritionTargetsService,
    private readonly trainingScheduleResolver: TrainingScheduleResolverService,
    private readonly painAwareExerciseReplacement: PainAwareExerciseReplacementService
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

    const plan = await this.generationUseCase.generate({
      userId,
      user,
      existingPlan,
      planLocalDate,
      planTimezone,
      locale: targetLocale,
      forceRegenerate: Boolean(dto.forceRegenerate),
      recreateForCurrentLanguage: Boolean(
        dto.recreateForCurrentLanguage
      )
    });

    return this.toResponse(plan);
  }

  async regenerateFoodPlan(userId: string, dailyPlanId: string, dto: RegenerateFoodPlanDto) {
    const plan = await this.foodRegenerationUseCase.regenerateMenu({
      userId,
      dailyPlanId,
      reason: dto.reason
    });

    return this.toResponse(plan);
  }

  async getFoodIngredientSwapSuggestions(
    userId: string,
    dailyPlanId: string,
    mealId: string,
    ingredientSlug: string
  ) {
    const context = await this.foodContextService.getContext(
      userId,
      dailyPlanId
    );
    const meal = context.currentFoodPlan.meals.find((item) => item.id === mealId);
    if (!meal) throw new NotFoundException('Meal not found in this plan.');

    const ingredient = meal.ingredients.find((item) => item.catalogFoodSlug === ingredientSlug);
    if (!ingredient) throw new NotFoundException('Ingredient not found in this meal.');
    if (!ingredient.catalogFoodSlug) {
      throw new BadRequestException('This ingredient does not support catalog substitutions yet.');
    }

    const suggestions = await this.foodIngredientSwapService.getSuggestions({
      ingredient,
      locale: context.locale,
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
    const context = await this.foodContextService.getContext(
      userId,
      dailyPlanId
    );
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
      locale: context.locale,
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
    const plan = await this.foodContextService.persistFoodPlan(
      context,
      nextFoodPlan
    );

    return this.toResponse(plan);
  }

  async regenerateFoodMeal(
    userId: string,
    dailyPlanId: string,
    mealId: string,
    dto: RegenerateFoodPlanDto
  ) {
    const plan = await this.foodRegenerationUseCase.regenerateMeal({
      userId,
      dailyPlanId,
      mealId,
      reason: dto.reason
    });

    return this.toResponse(plan);
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

  private resolvePlanningLocale(user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>): SupportedLocale {
    switch (user.settings?.preferredLocale) {
      case PreferredLocale.RU_RU: return 'ru-RU';
      case PreferredLocale.FR_FR: return 'fr-FR';
      case PreferredLocale.ZH_CN: return 'zh-CN';
      case PreferredLocale.EN_US: return 'en-US';
      default: return resolveSupportedLocale(user.locale);
    }
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
