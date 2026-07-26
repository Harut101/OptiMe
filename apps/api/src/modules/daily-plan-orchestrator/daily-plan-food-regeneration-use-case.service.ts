import {
  BadRequestException,
  Injectable,
  Logger
} from '@nestjs/common';
import {
  ProgressiveProfilePromptKey,
  UsageFeature
} from '@prisma/client';
import type { DailyFoodPlan } from '@optime/shared-types';

import { AiCostControlService } from '../ai-operation-logs/ai-cost-control.service';
import { FoodAvailabilityService } from '../food-availability/food-availability.service';
import { NutritionAgentService } from '../nutrition-agent/nutrition-agent.service';
import { UsageGuardService } from '../usage/usage-guard.service';
import {
  DailyPlanFoodContextService,
  type DailyPlanFoodContext
} from './daily-plan-food-context.service';
import type {
  RegenerateDailyFoodMealInput,
  RegenerateDailyFoodPlanInput
} from './daily-plan-food-regeneration-use-case.interface';
import type { DailyPlanPlanningUser } from './daily-plan-planning-user';

@Injectable()
export class DailyPlanFoodRegenerationUseCaseService {
  private readonly logger = new Logger(
    DailyPlanFoodRegenerationUseCaseService.name
  );

  constructor(
    private readonly foodContextService: DailyPlanFoodContextService,
    private readonly foodAvailabilityService: FoodAvailabilityService,
    private readonly nutritionAgent: NutritionAgentService,
    private readonly usageGuardService: UsageGuardService,
    private readonly aiCostControlService: AiCostControlService
  ) {}

  async regenerateMenu(input: RegenerateDailyFoodPlanInput) {
    const context = await this.foodContextService.getContext(
      input.userId,
      input.dailyPlanId
    );
    await this.aiCostControlService.assertCanStartAiOperation(
      input.userId
    );
    const consumedUsage =
      await this.usageGuardService.checkAndConsumeConfigured(
        input.userId,
        UsageFeature.MENU_REGENERATION
      );

    try {
      const result = await this.generateReplacementFoodPlan(
        context,
        {
          mode: 'FULL_MENU_REGENERATION',
          reason: input.reason
        }
      );
      const foodPlan = this.markFoodPlanRegenerated(
        result.foodPlan,
        'FULL_MENU_REGENERATION'
      );

      this.logger.log(
        `food plan regeneration completed; type=full_menu; planId=${input.dailyPlanId}; validationStatus=${foodPlan.validation.status}; retryCount=${result.retryCount}; fallbackUsed=${result.fallbackUsed}; kcalDelta=${Math.abs(foodPlan.totals.caloriesKcal - context.nutritionTarget.calories.targetKcal)}`
      );

      return this.foodContextService.persistFoodPlan(
        context,
        foodPlan
      );
    } catch (error) {
      await this.refundUsage(consumedUsage.id);
      throw error;
    }
  }

  async regenerateMeal(input: RegenerateDailyFoodMealInput) {
    const context = await this.foodContextService.getContext(
      input.userId,
      input.dailyPlanId
    );
    const selectedMeal = context.currentFoodPlan.meals.find(
      (meal) => meal.id === input.mealId
    );

    if (!selectedMeal) {
      throw new BadRequestException(
        'Meal not found in this plan.'
      );
    }

    await this.aiCostControlService.assertCanStartAiOperation(
      input.userId
    );
    const consumedUsage =
      await this.usageGuardService.checkAndConsumeConfigured(
        input.userId,
        UsageFeature.MEAL_REGENERATION
      );

    try {
      const result = await this.generateReplacementFoodPlan(
        context,
        {
          mode: 'MEAL_REGENERATION',
          reason: input.reason,
          selectedMealId: input.mealId
        }
      );
      const nextMeal = result.foodPlan.meals.find(
        (meal) => meal.id === input.mealId
      );

      if (!nextMeal) {
        throw new BadRequestException(
          'Could not safely regenerate this meal. Your current meal was kept.'
        );
      }

      const foodPlan = this.markFoodPlanRegenerated(
        result.foodPlan,
        'MEAL_REGENERATION',
        input.mealId
      );

      this.logger.log(
        `food plan regeneration completed; type=meal; planId=${input.dailyPlanId}; mealId=${input.mealId}; validationStatus=${foodPlan.validation.status}; retryCount=${result.retryCount}; fallbackUsed=${result.fallbackUsed}; kcalDelta=${Math.abs(foodPlan.totals.caloriesKcal - context.nutritionTarget.calories.targetKcal)}`
      );

      return this.foodContextService.persistFoodPlan(
        context,
        foodPlan
      );
    } catch (error) {
      await this.refundUsage(consumedUsage.id);
      throw error;
    }
  }

  private async generateReplacementFoodPlan(
    context: DailyPlanFoodContext,
    regeneration: {
      mode: 'FULL_MENU_REGENERATION' | 'MEAL_REGENERATION';
      reason?: string;
      selectedMealId?: string;
    }
  ) {
    const availableFoodSlugs =
      await this.foodAvailabilityService.getAvailableFoodSlugs(
        context.user.id,
        context.plan.planLocalDate
      );
    const result =
      await this.nutritionAgent.generateDailyFoodPlan({
        userId: context.user.id,
        planLocalDate: context.plan.planLocalDate,
        locale: context.locale,
        planQualityMode: context.planQualityMode,
        appMode: context.appMode,
        safeMode: context.user.safeMode,
        isMinor: context.user.isMinor,
        pregnancyStatus:
          context.user.profile?.pregnancyStatus,
        nutritionTarget: context.nutritionTarget,
        nutritionTargetSnapshot:
          context.nutritionTargetSnapshot,
        nutritionPreference: this.toNutritionAgentPreference(
          context.user
        ),
        goalSummary: context.user.goal
          ? {
              primaryGoal: context.user.goal.primaryGoal,
              goalType: context.user.goal.goalType
            }
          : null,
        foodAdherenceSummary:
          context.personalizationContext.foodAdherenceSummary,
        mealPracticalityPreference:
          this.toMealPracticalityPreference(context.user),
        mealTimingPreference: this.toMealTimingPreference(
          context.user
        ),
        availableFoodSlugs,
        resolvedTrainingDay: context.resolvedTrainingDay,
        regeneration: {
          ...regeneration,
          existingFoodPlan: context.currentFoodPlan
        }
      });

    if (
      result.fallbackUsed ||
      result.foodPlan.validation.status === 'FALLBACK'
    ) {
      throw new BadRequestException(
        'Could not safely regenerate this meal plan. Your current plan was kept.'
      );
    }

    return result;
  }

  private toNutritionAgentPreference(
    user: DailyPlanPlanningUser
  ) {
    return user.nutritionPref
      ? {
          dietType: user.nutritionPref.dietType,
          mealsPerDay: user.nutritionPref.mealsPerDay,
          notes: user.nutritionPref.notes,
          allergies: user.nutritionPref.allergies.map(
            (food) => food.name
          ),
          excludedFoods:
            user.nutritionPref.excludedFoods.map(
              (food) => food.name
            ),
          dislikedFoods:
            user.nutritionPref.dislikedFoods.map(
              (food) => food.name
            ),
          preferredFoods:
            user.nutritionPref.preferredFoods.map(
              (food) => food.name
            )
        }
      : null;
  }

  private toMealPracticalityPreference(
    user: DailyPlanPlanningUser
  ):
    | {
        cookingTime:
          | 'VERY_QUICK'
          | 'FIFTEEN_TO_THIRTY'
          | 'LONGER';
      }
    | undefined {
    const answer = user.progressiveProfilePrompts.find(
      (prompt) =>
        prompt.promptKey ===
        ProgressiveProfilePromptKey.COOKING_TIME
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
    user: DailyPlanPlanningUser
  ):
    | 'EARLIER'
    | 'EVENLY_SPACED'
    | 'LATER'
    | 'FLEXIBLE'
    | undefined {
    const answer = user.progressiveProfilePrompts.find(
      (prompt) =>
        prompt.promptKey ===
        ProgressiveProfilePromptKey.MEAL_TIMING
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

  private markFoodPlanRegenerated(
    foodPlan: DailyFoodPlan,
    mode:
      | 'FULL_MENU_REGENERATION'
      | 'MEAL_REGENERATION',
    selectedMealId?: string
  ): DailyFoodPlan {
    const marker =
      mode === 'FULL_MENU_REGENERATION'
        ? "Menu refreshed while preserving today's nutrition target."
        : "Meal refreshed while preserving today's nutrition target.";

    return {
      ...foodPlan,
      meals: foodPlan.meals.map((meal) => {
        if (
          mode === 'MEAL_REGENERATION' &&
          meal.id !== selectedMealId
        ) {
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

  private async refundUsage(usageLedgerId: string) {
    try {
      await this.usageGuardService.refundById(
        usageLedgerId,
        1
      );
    } catch (error) {
      this.logger.warn(
        `usage refund failed; usageLedgerId=${usageLedgerId}; reason=${error instanceof Error ? error.name : 'unknown'}`
      );
    }
  }
}
