import { Injectable } from '@nestjs/common';
import type { DailyFoodPlan, FoodIngredient, FoodNutritionTotals } from '@optime/shared-types';

import { FoodCatalogService } from '../food-catalog/food-catalog.service';
import type { FoodCatalogCandidate } from '../food-catalog/food-catalog.types';
import { FOOD_PLAN_VALIDATION_TOLERANCES } from './food-plan-validation.constants';

export interface FoodPlanPortionSolverInput {
  foodPlan: DailyFoodPlan;
  target: FoodPlanPortionSolverTarget;
  catalogCandidates: FoodCatalogCandidate[];
}

export interface FoodPlanPortionSolverTarget extends FoodNutritionTotals {}

export interface FoodPlanPortionSolverResult {
  foodPlan: DailyFoodPlan;
  adjusted: boolean;
  beforeScore: number;
  afterScore: number;
}

type PortionVariable = {
  mealIndex: number;
  ingredientIndex: number;
  candidate: FoodCatalogCandidate;
  quantity: number;
  minimum: number;
  maximum: number;
};

const MAX_ITERATIONS = 80;
const MAX_STEP_GRAMS = 60;

@Injectable()
export class FoodPlanPortionSolverService {
  constructor(private readonly foodCatalog: FoodCatalogService) {}

  /**
   * Adjusts only quantities of already-safe catalog foods. It deliberately never
   * adds ingredients, changes meal structure, or bypasses the catalog filters.
   */
  solve(input: FoodPlanPortionSolverInput): FoodPlanPortionSolverResult {
    if (!hasUsableTarget(input.target)) {
      return {
        foodPlan: input.foodPlan,
        adjusted: false,
        beforeScore: 0,
        afterScore: 0
      };
    }

    const bySlug = new Map(input.catalogCandidates.map((candidate) => [candidate.slug, candidate]));
    const variables = this.createVariables(input.foodPlan, bySlug);
    const initialPlan = this.rebuildPlan(input.foodPlan, variables);

    if (!initialPlan || variables.length === 0) {
      return {
        foodPlan: input.foodPlan,
        adjusted: false,
        beforeScore: Number.POSITIVE_INFINITY,
        afterScore: Number.POSITIVE_INFINITY
      };
    }

    const beforeScore = calculateFoodPlanPortionScore(initialPlan.totals, input.target);
    let bestPlan = initialPlan;
    let bestScore = beforeScore;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
      let bestVariable: PortionVariable | null = null;
      let bestQuantity = 0;
      let iterationPlan: DailyFoodPlan | null = null;
      let iterationScore = bestScore;

      for (const variable of variables) {
        const suggestedQuantity = this.suggestQuantity(variable, bestPlan.totals, input.target);
        if (suggestedQuantity === null || suggestedQuantity === variable.quantity) continue;

        const previousQuantity = variable.quantity;
        variable.quantity = suggestedQuantity;
        const candidatePlan = this.rebuildPlan(input.foodPlan, variables);
        variable.quantity = previousQuantity;

        if (!candidatePlan) continue;
        const candidateScore = calculateFoodPlanPortionScore(candidatePlan.totals, input.target);
        if (candidateScore + 0.0001 < iterationScore) {
          bestVariable = variable;
          bestQuantity = suggestedQuantity;
          iterationPlan = candidatePlan;
          iterationScore = candidateScore;
        }
      }

      if (!bestVariable || !iterationPlan) break;
      bestVariable.quantity = bestQuantity;
      bestPlan = iterationPlan;
      bestScore = iterationScore;
    }

    const adjusted = bestScore + 0.0001 < beforeScore;

    return {
      // Preserve the exact provider result when no measurable improvement was found.
      foodPlan: adjusted ? bestPlan : input.foodPlan,
      adjusted,
      beforeScore,
      afterScore: adjusted ? bestScore : beforeScore
    };
  }

  private createVariables(
    foodPlan: DailyFoodPlan,
    bySlug: Map<string, FoodCatalogCandidate>
  ): PortionVariable[] {
    const variables: PortionVariable[] = [];

    foodPlan.meals.forEach((meal, mealIndex) => {
      meal.ingredients.forEach((ingredient, ingredientIndex) => {
        const candidate = ingredient.catalogFoodSlug ? bySlug.get(ingredient.catalogFoodSlug) : null;
        if (!candidate || ingredient.unit !== 'g' || !Number.isFinite(ingredient.quantity)) return;

        const quantity = roundToFive(ingredient.quantity);
        variables.push({
          mealIndex,
          ingredientIndex,
          candidate,
          quantity,
          minimum: Math.max(5, roundToFive(quantity * 0.45)),
          maximum: Math.min(1200, Math.max(30, roundToFive(quantity * 2.2)))
        });
      });
    });

    return variables;
  }

  private suggestQuantity(
    variable: PortionVariable,
    current: FoodNutritionTotals,
    target: FoodPlanPortionSolverTarget
  ) {
    const perGram = {
      caloriesKcal: variable.candidate.caloriesPer100g / 100,
      proteinGrams: variable.candidate.proteinPer100g / 100,
      carbsGrams: variable.candidate.carbsPer100g / 100,
      fatGrams: variable.candidate.fatPer100g / 100
    };
    const dimensions = nutritionDimensions(current, target, perGram);
    const denominator = dimensions.reduce((sum, dimension) => sum + dimension.weight * dimension.perGram ** 2, 0);
    if (denominator <= 0) return null;

    const numerator = dimensions.reduce(
      (sum, dimension) => sum + dimension.weight * (dimension.target - dimension.current) * dimension.perGram,
      0
    );
    const delta = clamp(numerator / denominator, -MAX_STEP_GRAMS, MAX_STEP_GRAMS);
    const next = roundToFive(clamp(variable.quantity + delta, variable.minimum, variable.maximum));
    return next === variable.quantity ? null : next;
  }

  private rebuildPlan(foodPlan: DailyFoodPlan, variables: PortionVariable[]): DailyFoodPlan | null {
    const variableByIngredient = new Map(
      variables.map((variable) => [`${variable.mealIndex}:${variable.ingredientIndex}`, variable])
    );
    const meals = foodPlan.meals.map((meal, mealIndex) => {
      const ingredients = meal.ingredients.map((ingredient, ingredientIndex) => {
        const variable = variableByIngredient.get(`${mealIndex}:${ingredientIndex}`);
        if (!variable) return ingredient;
        const quantity = roundToFive(variable.quantity);
        const nutrition = this.foodCatalog.calculateNutrition(variable.candidate, quantity);
        return {
          ...ingredient,
          name: variable.candidate.name,
          quantity,
          caloriesKcal: nutrition.caloriesKcal,
          proteinGrams: nutrition.proteinGrams,
          carbsGrams: nutrition.carbsGrams,
          fatGrams: nutrition.fatGrams
        } satisfies FoodIngredient;
      });
      const totals = sumNutrition(ingredients);
      return { ...meal, ...totals, ingredients };
    });

    if (meals.some((meal) => meal.ingredients.length === 0)) return null;
    return { ...foodPlan, meals, totals: sumNutrition(meals) };
  }
}

export function calculateFoodPlanPortionScore(actual: FoodNutritionTotals, target: FoodPlanPortionSolverTarget) {
  return nutritionDimensions(actual, target).reduce(
    (score, dimension) => score + dimension.weight * (dimension.current - dimension.target) ** 2,
    0
  );
}

function nutritionDimensions(
  current: FoodNutritionTotals,
  target: FoodNutritionTotals,
  perGram?: FoodNutritionTotals
) {
  return [
    {
      current: current.caloriesKcal,
      target: target.caloriesKcal,
      perGram: perGram?.caloriesKcal ?? 0,
      weight: 1 / FOOD_PLAN_VALIDATION_TOLERANCES.caloriesMinimumKcal ** 2
    },
    {
      current: current.proteinGrams,
      target: target.proteinGrams,
      perGram: perGram?.proteinGrams ?? 0,
      weight: 1 / FOOD_PLAN_VALIDATION_TOLERANCES.proteinGrams ** 2
    },
    {
      current: current.carbsGrams,
      target: target.carbsGrams,
      perGram: perGram?.carbsGrams ?? 0,
      weight: 1 / FOOD_PLAN_VALIDATION_TOLERANCES.carbsGrams ** 2
    },
    {
      current: current.fatGrams,
      target: target.fatGrams,
      perGram: perGram?.fatGrams ?? 0,
      weight: 1 / FOOD_PLAN_VALIDATION_TOLERANCES.fatGrams ** 2
    }
  ];
}

function sumNutrition(items: Array<FoodNutritionTotals>) {
  return items.reduce<FoodNutritionTotals>(
    (totals, item) => ({
      caloriesKcal: totals.caloriesKcal + item.caloriesKcal,
      proteinGrams: totals.proteinGrams + item.proteinGrams,
      carbsGrams: totals.carbsGrams + item.carbsGrams,
      fatGrams: totals.fatGrams + item.fatGrams
    }),
    { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundToFive(value: number) {
  return Math.max(5, Math.round(value / 5) * 5);
}

function hasUsableTarget(target: FoodPlanPortionSolverTarget) {
  return Object.values(target).every((value) => Number.isFinite(value) && value > 0);
}
