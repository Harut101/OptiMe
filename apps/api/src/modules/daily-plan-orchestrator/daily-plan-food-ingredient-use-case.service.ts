import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import type { FoodIngredient } from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { FoodIngredientSwapService } from '../daily-plans/food-ingredient-swap.service';
import { FoodPlanValidationService } from '../nutrition-agent/food-plan-validation.service';
import { normalizeFoodPlanNutrition } from '../nutrition-agent/food-plan-nutrition-normalizer';
import {
  DailyPlanFoodContextService,
  type DailyPlanFoodContext
} from './daily-plan-food-context.service';
import type {
  ApplyDailyPlanFoodIngredientSwapInput,
  ExcludeDailyPlanFoodIngredientInput,
  GetDailyPlanFoodIngredientSwapSuggestionsInput
} from './daily-plan-food-ingredient-use-case.interface';

@Injectable()
export class DailyPlanFoodIngredientUseCaseService {
  private readonly logger = new Logger(
    DailyPlanFoodIngredientUseCaseService.name
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly foodContextService: DailyPlanFoodContextService,
    private readonly foodIngredientSwapService: FoodIngredientSwapService,
    private readonly foodPlanValidator: FoodPlanValidationService
  ) {}

  async getSwapSuggestions(
    input: GetDailyPlanFoodIngredientSwapSuggestionsInput
  ) {
    const context = await this.foodContextService.getContext(
      input.userId,
      input.dailyPlanId
    );
    const meal = context.currentFoodPlan.meals.find(
      (item) => item.id === input.mealId
    );

    if (!meal) {
      throw new NotFoundException('Meal not found in this plan.');
    }

    const ingredient = meal.ingredients.find(
      (item) =>
        item.catalogFoodSlug === input.ingredientSlug
    );

    if (!ingredient) {
      throw new NotFoundException(
        'Ingredient not found in this meal.'
      );
    }

    if (!ingredient.catalogFoodSlug) {
      throw new BadRequestException(
        'This ingredient does not support catalog substitutions yet.'
      );
    }

    const suggestions =
      await this.foodIngredientSwapService.getSuggestions({
        ingredient,
        locale: context.locale,
        dietType:
          context.user.nutritionPref?.dietType ?? null,
        restrictions: this.getRestrictions(context)
      });

    return {
      dailyPlanId: input.dailyPlanId,
      mealId: input.mealId,
      ingredientSlug: input.ingredientSlug,
      suggestions
    };
  }

  async applySwap(
    input: ApplyDailyPlanFoodIngredientSwapInput
  ) {
    const context = await this.foodContextService.getContext(
      input.userId,
      input.dailyPlanId
    );
    const selectedMeal = context.currentFoodPlan.meals.find(
      (meal) => meal.id === input.mealId
    );

    if (!selectedMeal) {
      throw new NotFoundException(
        'Meal not found in this plan.'
      );
    }

    const originalIngredient =
      selectedMeal.ingredients.find(
        (ingredient) =>
          ingredient.catalogFoodSlug === input.ingredientSlug
      );

    if (!originalIngredient?.catalogFoodSlug) {
      throw new NotFoundException(
        'Ingredient not found in this meal.'
      );
    }

    const restrictions = this.getRestrictions(context);
    const suggestions =
      await this.foodIngredientSwapService.getSuggestions({
        ingredient: originalIngredient,
        locale: context.locale,
        dietType:
          context.user.nutritionPref?.dietType ?? null,
        restrictions
      });
    const suggestion = suggestions.find(
      (item) =>
        item.slug === input.replacementCatalogFoodSlug
    );

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
      isOptional: originalIngredient.isOptional,
      role: suggestion.role,
      measurementState: suggestion.measurementState,
      preparation: suggestion.preparation,
      usage: suggestion.usage
    };
    const nextFoodPlan = normalizeFoodPlanNutrition({
      ...context.currentFoodPlan,
      source: 'NUTRITION_AGENT',
      validation: {
        ...context.currentFoodPlan.validation,
        status: 'VALID',
        reasons: []
      },
      meals: context.currentFoodPlan.meals.map((meal) =>
        meal.id !== input.mealId
          ? meal
          : {
              ...meal,
              ingredients: meal.ingredients.map(
                (ingredient) =>
                  ingredient.catalogFoodSlug ===
                  input.ingredientSlug
                    ? replacement
                    : ingredient
              ),
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
      )
    });
    const foodPlanValidation = this.foodPlanValidator.validate(
      nextFoodPlan,
      {
        nutritionTarget: context.nutritionTarget,
        nutritionTargetSnapshot:
          context.nutritionTargetSnapshot,
        allergies: restrictions.allergies,
        excludedFoods: restrictions.excludedFoods,
        dislikedFoods: restrictions.dislikedFoods,
        safeMode: context.user.safeMode,
        isMinor: context.user.isMinor,
        pregnancyStatus:
          context.user.profile?.pregnancyStatus
      }
    );

    if (!foodPlanValidation.passed) {
      this.logger.warn(
        `ingredient swap rejected; planId=${input.dailyPlanId}; mealId=${input.mealId}; reasonCodes=${foodPlanValidation.reasons.join(',')}`
      );
      throw new BadRequestException(
        'This alternative would move your meal outside today\'s safe nutrition target. Your current meal was kept.'
      );
    }

    this.logger.log(
      `ingredient swap applied; planId=${input.dailyPlanId}; mealId=${input.mealId}; originalSlug=${input.ingredientSlug}; replacementSlug=${suggestion.slug}`
    );

    return this.foodContextService.persistFoodPlan(
      context,
      nextFoodPlan
    );
  }

  async excludeIngredient(
    input: ExcludeDailyPlanFoodIngredientInput
  ) {
    await this.getOwnedPlanOrThrow(
      input.userId,
      input.dailyPlanId
    );
    const ingredientName = input.ingredientName.trim();

    if (!ingredientName) {
      throw new BadRequestException(
        'Ingredient name is required.'
      );
    }

    const preference = await this.prisma.$transaction(
      async (tx) => {
        const nutritionPreference =
          await tx.nutritionPreference.upsert({
            where: { userId: input.userId },
            update: {},
            create: {
              userId: input.userId,
              dietType: 'NONE',
              mealsPerDay: 3,
              noKnownAllergiesConfirmed: false
            }
          });
        const existing = await tx.excludedFood.findFirst({
          where: {
            nutritionPreferenceId:
              nutritionPreference.id,
            name: {
              equals: ingredientName,
              mode: 'insensitive'
            }
          }
        });

        if (!existing) {
          await tx.excludedFood.create({
            data: {
              nutritionPreferenceId:
                nutritionPreference.id,
              name: ingredientName
            }
          });
        }

        return tx.nutritionPreference.findUniqueOrThrow({
          where: { userId: input.userId },
          include: {
            allergies: true,
            excludedFoods: true,
            dislikedFoods: true,
            preferredFoods: true
          }
        });
      }
    );

    this.logger.log(
      `food ingredient excluded; planId=${input.dailyPlanId}; userId=${input.userId}; duplicateSafe=true`
    );

    return preference;
  }

  private getRestrictions(context: DailyPlanFoodContext) {
    return {
      allergies:
        context.user.nutritionPref?.allergies.map(
          (food) => food.name
        ) ?? [],
      excludedFoods:
        context.user.nutritionPref?.excludedFoods.map(
          (food) => food.name
        ) ?? [],
      dislikedFoods:
        context.user.nutritionPref?.dislikedFoods.map(
          (food) => food.name
        ) ?? []
    };
  }

  private async getOwnedPlanOrThrow(
    userId: string,
    dailyPlanId: string
  ) {
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

    return plan;
  }
}
