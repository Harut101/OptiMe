import { Injectable } from '@nestjs/common';
import type { DailyFoodPlan, FoodIngredient, FoodNutritionTotals } from '@optime/shared-types';

import { FoodCatalogService } from '../food-catalog/food-catalog.service';
import type { FoodCatalogCandidate } from '../food-catalog/food-catalog.types';
import {
  calculateFoodPlanPortionScore,
  FoodPlanPortionSolverService,
  type FoodPlanPortionSolverTarget
} from './food-plan-portion-solver.service';

export interface FoodPlanCatalogRebalancerInput {
  foodPlan: DailyFoodPlan;
  target: FoodPlanPortionSolverTarget;
  catalogCandidates: FoodCatalogCandidate[];
}

export interface FoodPlanCatalogRebalancerResult {
  foodPlan: DailyFoodPlan;
  rebalanced: boolean;
  beforeScore: number;
  afterScore: number;
}

const MAX_ALTERNATIVES_PER_INGREDIENT = 8;

@Injectable()
export class FoodPlanCatalogRebalancerService {
  constructor(
    private readonly foodCatalog: FoodCatalogService,
    private readonly portionSolver: FoodPlanPortionSolverService
  ) {}

  /**
   * Makes at most one same-category catalog substitution, then lets the portion
   * solver recalculate grams. It keeps the original plan when no real target-fit
   * improvement exists or when the meal copy already names the ingredient.
   */
  rebalance(input: FoodPlanCatalogRebalancerInput): FoodPlanCatalogRebalancerResult {
    const bySlug = new Map(input.catalogCandidates.map((candidate) => [candidate.slug, candidate]));
    const initial = this.portionSolver.solve(input);
    const beforeScore = calculateFoodPlanPortionScore(initial.foodPlan.totals, input.target);
    let bestPlan = initial.foodPlan;
    let bestScore = beforeScore;

    initial.foodPlan.meals.forEach((meal, mealIndex) => {
      meal.ingredients.forEach((ingredient, ingredientIndex) => {
        const currentCandidate = ingredient.catalogFoodSlug ? bySlug.get(ingredient.catalogFoodSlug) : null;
        if (!currentCandidate || mealMentionsIngredient(meal, currentCandidate)) return;

        const alternatives = input.catalogCandidates
          .filter((candidate) => candidate.category === currentCandidate.category && candidate.slug !== currentCandidate.slug)
          .slice(0, MAX_ALTERNATIVES_PER_INGREDIENT);

        for (const alternative of alternatives) {
          const candidatePlan = replaceIngredient(
            initial.foodPlan,
            mealIndex,
            ingredientIndex,
            alternative,
            this.foodCatalog
          );
          const solved = this.portionSolver.solve({
            foodPlan: candidatePlan,
            target: input.target,
            catalogCandidates: input.catalogCandidates
          });
          const score = calculateFoodPlanPortionScore(solved.foodPlan.totals, input.target);
          if (score + 0.0001 < bestScore) {
            bestPlan = solved.foodPlan;
            bestScore = score;
          }
        }
      });
    });

    const rebalanced = bestScore + 0.0001 < beforeScore;
    return {
      foodPlan: rebalanced ? bestPlan : input.foodPlan,
      rebalanced,
      beforeScore,
      afterScore: rebalanced ? bestScore : beforeScore
    };
  }
}

function replaceIngredient(
  foodPlan: DailyFoodPlan,
  mealIndex: number,
  ingredientIndex: number,
  replacement: FoodCatalogCandidate,
  foodCatalog: FoodCatalogService
): DailyFoodPlan {
  const meals = foodPlan.meals.map((meal, currentMealIndex) => {
    if (currentMealIndex !== mealIndex) return meal;

    const ingredients = meal.ingredients.map((ingredient, currentIngredientIndex) => {
      if (currentIngredientIndex !== ingredientIndex) return ingredient;
      const nutrition = foodCatalog.calculateNutrition(replacement, ingredient.quantity);
      return {
        ...ingredient,
        catalogFoodSlug: replacement.slug,
        name: replacement.name,
        caloriesKcal: nutrition.caloriesKcal,
        proteinGrams: nutrition.proteinGrams,
        carbsGrams: nutrition.carbsGrams,
        fatGrams: nutrition.fatGrams
      } satisfies FoodIngredient;
    });
    return { ...meal, ...sumNutrition(ingredients), ingredients };
  });

  return { ...foodPlan, meals, totals: sumNutrition(meals) };
}

function mealMentionsIngredient(meal: DailyFoodPlan['meals'][number], candidate: FoodCatalogCandidate) {
  const labels = [candidate.name, ...candidate.aliases]
    .map(normalizeText)
    .filter((label) => label.length >= 3);
  if (!labels.length) return false;

  const mealCopy = [
    meal.title,
    meal.shortDescription ?? '',
    meal.servingSummary,
    ...meal.preparationSteps,
    ...meal.substitutions.flatMap((substitution) => [
      substitution.originalItem,
      substitution.replacementItem,
      substitution.servingSummary,
      substitution.macroImpactNote ?? ''
    ])
  ].map(normalizeText);

  return mealCopy.some((text) => labels.some((label) => text.includes(label)));
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

function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
