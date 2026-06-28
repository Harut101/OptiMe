import { Injectable } from '@nestjs/common';
import type { DailyFoodPlan, FoodIngredient, FoodMeal } from '@optime/shared-types';

import { dailyFoodPlanSchema } from '../daily-plans/daily-plan-json.schema';
import {
  FOOD_PLAN_VALIDATION_TOLERANCES,
  UNSAFE_FOOD_PLAN_PATTERNS
} from './food-plan-validation.constants';
import type { FoodPlanValidationContext, FoodPlanValidationResult } from './nutrition-agent.types';

@Injectable()
export class FoodPlanValidationService {
  validate(
    foodPlan: unknown,
    context: FoodPlanValidationContext
  ): FoodPlanValidationResult {
    const parsed = dailyFoodPlanSchema.safeParse(foodPlan);

    if (!parsed.success) {
      return {
        passed: false,
        reasons: ['SCHEMA_INVALID'],
        totalKcalDelta: 0
      };
    }

    const plan = parsed.data;
    const reasons = [
      ...this.validateStructure(plan),
      ...this.validateArithmetic(plan),
      ...this.validateTargetFit(plan, context),
      ...this.validateRestrictedFoods(plan, context),
      ...this.validateUnsafeLanguage(plan, context)
    ];

    return {
      passed: reasons.length === 0,
      reasons: [...new Set(reasons)],
      totalKcalDelta: Math.abs(plan.totals.caloriesKcal - context.nutritionTarget.calories.targetKcal)
    };
  }

  private validateStructure(plan: DailyFoodPlan) {
    const reasons: string[] = [];
    const seenIds = new Set<string>();

    if (plan.meals.length === 0) {
      reasons.push('MEALS_MISSING');
    }

    plan.meals.forEach((meal) => {
      if (seenIds.has(meal.id)) {
        reasons.push('DUPLICATE_MEAL_ID');
      }
      seenIds.add(meal.id);

      if (meal.ingredients.length === 0) {
        reasons.push('INGREDIENTS_MISSING');
      }

      for (const value of [
        meal.caloriesKcal,
        meal.proteinGrams,
        meal.carbsGrams,
        meal.fatGrams,
        ...meal.ingredients.flatMap((ingredient) => [
          ingredient.quantity,
          ingredient.caloriesKcal,
          ingredient.proteinGrams,
          ingredient.carbsGrams,
          ingredient.fatGrams
        ])
      ]) {
        if (!Number.isFinite(value) || value < 0) {
          reasons.push('INVALID_NUMERIC_VALUE');
        }
      }
    });

    return reasons;
  }

  private validateArithmetic(plan: DailyFoodPlan) {
    const reasons: string[] = [];
    const mealSums = sumMeals(plan.meals);

    if (Math.abs(mealSums.caloriesKcal - plan.totals.caloriesKcal) > FOOD_PLAN_VALIDATION_TOLERANCES.mealCaloriesKcal) {
      reasons.push('DAILY_TOTALS_DO_NOT_MATCH_MEALS');
    }

    if (
      Math.abs(mealSums.proteinGrams - plan.totals.proteinGrams) > FOOD_PLAN_VALIDATION_TOLERANCES.mealMacroGrams ||
      Math.abs(mealSums.carbsGrams - plan.totals.carbsGrams) > FOOD_PLAN_VALIDATION_TOLERANCES.mealMacroGrams ||
      Math.abs(mealSums.fatGrams - plan.totals.fatGrams) > FOOD_PLAN_VALIDATION_TOLERANCES.mealMacroGrams
    ) {
      reasons.push('DAILY_MACROS_DO_NOT_MATCH_MEALS');
    }

    plan.meals.forEach((meal) => {
      const ingredientSums = sumIngredients(meal.ingredients);
      if (Math.abs(ingredientSums.caloriesKcal - meal.caloriesKcal) > FOOD_PLAN_VALIDATION_TOLERANCES.mealCaloriesKcal) {
        reasons.push('MEAL_TOTALS_DO_NOT_MATCH_INGREDIENTS');
      }
      if (
        Math.abs(ingredientSums.proteinGrams - meal.proteinGrams) > FOOD_PLAN_VALIDATION_TOLERANCES.mealMacroGrams ||
        Math.abs(ingredientSums.carbsGrams - meal.carbsGrams) > FOOD_PLAN_VALIDATION_TOLERANCES.mealMacroGrams ||
        Math.abs(ingredientSums.fatGrams - meal.fatGrams) > FOOD_PLAN_VALIDATION_TOLERANCES.mealMacroGrams
      ) {
        reasons.push('MEAL_MACROS_DO_NOT_MATCH_INGREDIENTS');
      }
    });

    const macroCalories =
      plan.totals.proteinGrams * 4 + plan.totals.carbsGrams * 4 + plan.totals.fatGrams * 9;
    const macroCalorieTolerance = Math.max(
      FOOD_PLAN_VALIDATION_TOLERANCES.caloriesMinimumKcal,
      plan.totals.caloriesKcal * (FOOD_PLAN_VALIDATION_TOLERANCES.dailyMacroCaloriesPercent / 100)
    );

    if (Math.abs(macroCalories - plan.totals.caloriesKcal) > macroCalorieTolerance) {
      reasons.push('MACRO_CALORIES_DO_NOT_MATCH_TOTAL');
    }

    return reasons;
  }

  private validateTargetFit(plan: DailyFoodPlan, context: FoodPlanValidationContext) {
    if (context.nutritionTarget.safety.status === 'NEEDS_MORE_INFO') {
      return [];
    }

    const reasons: string[] = [];
    const target = context.nutritionTarget;
    const calorieTolerance = Math.max(
      FOOD_PLAN_VALIDATION_TOLERANCES.caloriesMinimumKcal,
      target.calories.targetKcal * (FOOD_PLAN_VALIDATION_TOLERANCES.caloriesPercent / 100)
    );

    if (Math.abs(plan.totals.caloriesKcal - target.calories.targetKcal) > calorieTolerance) {
      reasons.push('CALORIES_OUTSIDE_TARGET_TOLERANCE');
    }

    if (!withinMacroTolerance(plan.totals.proteinGrams, target.macros.proteinGrams, FOOD_PLAN_VALIDATION_TOLERANCES.proteinGrams, FOOD_PLAN_VALIDATION_TOLERANCES.proteinPercent)) {
      reasons.push('PROTEIN_OUTSIDE_TARGET_TOLERANCE');
    }
    if (!withinMacroTolerance(plan.totals.carbsGrams, target.macros.carbsGrams, FOOD_PLAN_VALIDATION_TOLERANCES.carbsGrams, FOOD_PLAN_VALIDATION_TOLERANCES.carbsPercent)) {
      reasons.push('CARBS_OUTSIDE_TARGET_TOLERANCE');
    }
    if (!withinMacroTolerance(plan.totals.fatGrams, target.macros.fatGrams, FOOD_PLAN_VALIDATION_TOLERANCES.fatGrams, FOOD_PLAN_VALIDATION_TOLERANCES.fatPercent)) {
      reasons.push('FAT_OUTSIDE_TARGET_TOLERANCE');
    }

    return reasons;
  }

  private validateRestrictedFoods(plan: DailyFoodPlan, context: FoodPlanValidationContext) {
    const restrictedFoods = [
      ...context.allergies,
      ...context.excludedFoods,
      ...(context.dislikedFoods ?? [])
    ]
      .map((food) => food.trim().toLowerCase())
      .filter(Boolean);

    if (restrictedFoods.length === 0) {
      return [];
    }

    const reasons: string[] = [];
    const texts = plan.meals.flatMap((meal) => [
      meal.title,
      meal.shortDescription ?? '',
      meal.servingSummary,
      ...meal.ingredients.map((ingredient) => ingredient.name),
      ...meal.preparationSteps,
      ...meal.substitutions.flatMap((substitution) => [
        substitution.originalItem,
        substitution.replacementItem,
        substitution.servingSummary,
        substitution.macroImpactNote ?? ''
      ])
    ]);

    if (texts.some((text) => restrictedFoods.some((food) => containsFood(text, food)))) {
      reasons.push('RESTRICTED_FOOD_CONFLICT');
    }

    return reasons;
  }

  private validateUnsafeLanguage(plan: DailyFoodPlan, context: FoodPlanValidationContext) {
    const text = plan.meals
      .flatMap((meal) => [
        meal.title,
        meal.shortDescription ?? '',
        meal.servingSummary,
        ...meal.preparationSteps,
        ...meal.substitutions.map((substitution) => substitution.servingSummary)
      ])
      .join(' ');
    const reasons: string[] = [];

    if (UNSAFE_FOOD_PLAN_PATTERNS.some((pattern) => pattern.test(text))) {
      reasons.push('UNSAFE_DIET_LANGUAGE');
    }

    if ((context.safeMode || context.isMinor || isSensitivePregnancyStatus(context.pregnancyStatus)) && /\b(deficit|cutting|fat loss|weight loss meal plan)\b/i.test(text)) {
      reasons.push('UNSAFE_SENSITIVE_CONTEXT_LANGUAGE');
    }

    return reasons;
  }
}

function sumMeals(meals: FoodMeal[]) {
  return meals.reduce(
    (total, meal) => ({
      caloriesKcal: total.caloriesKcal + meal.caloriesKcal,
      proteinGrams: total.proteinGrams + meal.proteinGrams,
      carbsGrams: total.carbsGrams + meal.carbsGrams,
      fatGrams: total.fatGrams + meal.fatGrams
    }),
    { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
  );
}

function sumIngredients(ingredients: FoodIngredient[]) {
  return ingredients.reduce(
    (total, ingredient) => ({
      caloriesKcal: total.caloriesKcal + ingredient.caloriesKcal,
      proteinGrams: total.proteinGrams + ingredient.proteinGrams,
      carbsGrams: total.carbsGrams + ingredient.carbsGrams,
      fatGrams: total.fatGrams + ingredient.fatGrams
    }),
    { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
  );
}

function withinMacroTolerance(actual: number, target: number, absolute: number, percent: number) {
  const tolerance = Math.max(absolute, target * (percent / 100));
  return Math.abs(actual - target) <= tolerance;
}

function containsFood(text: string, food: string) {
  return new RegExp(`(^|\\b)${escapeRegExp(food)}(\\b|$)`, 'i').test(text);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSensitivePregnancyStatus(value?: string | null) {
  return value === 'PREGNANT' || value === 'POSTPARTUM' || value === 'BREASTFEEDING';
}
