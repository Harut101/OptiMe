import { Injectable } from '@nestjs/common';
import type { DailyFoodPlan } from '@optime/shared-types';

import type { FoodCatalogCandidate } from '../food-catalog/food-catalog.types';
import {
  calculateFoodPlanPortionScore,
  type FoodPlanPortionSolverTarget
} from './food-plan-portion-solver.service';
import { FoodPlanCatalogRebalancerService } from './food-plan-catalog-rebalancer.service';

export interface FoodPlanTargetedMealRepairInput {
  foodPlan: DailyFoodPlan;
  target: FoodPlanPortionSolverTarget;
  catalogCandidates: FoodCatalogCandidate[];
}

export interface FoodPlanTargetedMealRepairResult {
  foodPlan: DailyFoodPlan;
  repaired: boolean;
  mealId?: string;
  beforeScore: number;
  afterScore: number;
}

/**
 * Prefers the smallest safe correction: one meal can be rebalanced while every
 * other saved meal remains unchanged. A broader fallback stays a last resort.
 */
@Injectable()
export class FoodPlanTargetedMealRepairService {
  constructor(private readonly catalogRebalancer: FoodPlanCatalogRebalancerService) {}

  repair(input: FoodPlanTargetedMealRepairInput): FoodPlanTargetedMealRepairResult {
    const beforeScore = calculateFoodPlanPortionScore(input.foodPlan.totals, input.target);
    let bestPlan = input.foodPlan;
    let bestScore = beforeScore;
    let repairedMealId: string | undefined;

    for (const meal of input.foodPlan.meals) {
      const candidate = this.catalogRebalancer.rebalance({
        ...input,
        allowedMealIds: [meal.id]
      });
      if (!candidate.rebalanced || candidate.afterScore + 0.0001 >= bestScore) continue;

      bestPlan = candidate.foodPlan;
      bestScore = candidate.afterScore;
      repairedMealId = meal.id;
    }

    return {
      foodPlan: bestPlan,
      repaired: repairedMealId !== undefined,
      mealId: repairedMealId,
      beforeScore,
      afterScore: bestScore
    };
  }
}
