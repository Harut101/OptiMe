import { Injectable } from '@nestjs/common';

import { DailyPlanFoodIngredientUseCaseService } from '../daily-plan-orchestrator/daily-plan-food-ingredient-use-case.service';
import { DailyPlanFoodRegenerationUseCaseService } from '../daily-plan-orchestrator/daily-plan-food-regeneration-use-case.service';
import { DailyPlanHistoryFeedbackUseCaseService } from '../daily-plan-orchestrator/daily-plan-history-feedback-use-case.service';
import { toDailyPlanResponse } from '../daily-plan-orchestrator/daily-plan-response.mapper';
import { DailyPlanTodayUseCaseService } from '../daily-plan-orchestrator/daily-plan-today-use-case.service';
import { DailyPlanTrainingAdjustmentUseCaseService } from '../daily-plan-orchestrator/daily-plan-training-adjustment-use-case.service';
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

@Injectable()
export class DailyPlansService {
  constructor(
    private readonly foodIngredientUseCase: DailyPlanFoodIngredientUseCaseService,
    private readonly foodRegenerationUseCase: DailyPlanFoodRegenerationUseCaseService,
    private readonly historyFeedbackUseCase: DailyPlanHistoryFeedbackUseCaseService,
    private readonly todayUseCase: DailyPlanTodayUseCaseService,
    private readonly trainingAdjustmentUseCase: DailyPlanTrainingAdjustmentUseCaseService
  ) {}

  async getTodayPlan(userId: string) {
    const plan = await this.todayUseCase.getToday(userId);

    return plan ? toDailyPlanResponse(plan) : null;
  }

  async getHistory(userId: string, limit?: string) {
    return this.historyFeedbackUseCase.getHistory({
      userId,
      limit
    });
  }

  async generateTodayPlan(userId: string, dto: GenerateDailyPlanDto) {
    const plan = await this.todayUseCase.generateToday({
      userId,
      forceRegenerate: Boolean(dto.forceRegenerate),
      recreateForCurrentLanguage: Boolean(
        dto.recreateForCurrentLanguage
      )
    });

    return toDailyPlanResponse(plan);
  }

  async regenerateFoodPlan(userId: string, dailyPlanId: string, dto: RegenerateFoodPlanDto) {
    const plan = await this.foodRegenerationUseCase.regenerateMenu({
      userId,
      dailyPlanId,
      reason: dto.reason
    });

    return toDailyPlanResponse(plan);
  }

  async getFoodIngredientSwapSuggestions(
    userId: string,
    dailyPlanId: string,
    mealId: string,
    ingredientSlug: string
  ) {
    return this.foodIngredientUseCase.getSwapSuggestions({
      userId,
      dailyPlanId,
      mealId,
      ingredientSlug
    });
  }

  async applyFoodIngredientSwap(
    userId: string,
    dailyPlanId: string,
    mealId: string,
    ingredientSlug: string,
    dto: ApplyFoodIngredientSwapDto
  ) {
    const plan = await this.foodIngredientUseCase.applySwap({
      userId,
      dailyPlanId,
      mealId,
      ingredientSlug,
      replacementCatalogFoodSlug:
        dto.replacementCatalogFoodSlug
    });

    return toDailyPlanResponse(plan);
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

    return toDailyPlanResponse(plan);
  }

  async excludeFoodIngredient(userId: string, dailyPlanId: string, dto: ExcludeFoodIngredientDto) {
    return this.foodIngredientUseCase.excludeIngredient({
      userId,
      dailyPlanId,
      ingredientName: dto.ingredientName
    });
  }

  async adjustTrainingForPreWorkout(userId: string, dailyPlanId: string, dto: AdjustTrainingForPreWorkoutDto) {
    const plan =
      await this.trainingAdjustmentUseCase.adjustForPreWorkout({
        userId,
        dailyPlanId,
        preWorkoutCheck: dto.preWorkoutCheck
      });

    return toDailyPlanResponse(plan);
  }

  async getTrainingReplacementProposals(
    userId: string,
    dailyPlanId: string,
    dto: TrainingReplacementProposalsDto
  ) {
    return this.trainingAdjustmentUseCase.getReplacementProposals({
      userId,
      dailyPlanId,
      preWorkoutCheck: dto.preWorkoutCheck,
      conflictingExerciseKeys: dto.conflictingExerciseKeys
    });
  }

  async applyTrainingReplacements(
    userId: string,
    dailyPlanId: string,
    dto: ApplyTrainingReplacementsDto
  ) {
    const plan =
      await this.trainingAdjustmentUseCase.applyReplacements({
        userId,
        dailyPlanId,
        preWorkoutCheck: dto.preWorkoutCheck,
        conflictingExerciseKeys:
          dto.conflictingExerciseKeys,
        acceptedOriginalPlanExerciseKeys:
          dto.acceptedOriginalPlanExerciseKeys
      });

    return toDailyPlanResponse(plan);
  }

  async submitFeedback(userId: string, dailyPlanId: string, dto: SubmitDailyPlanFeedbackDto) {
    return this.historyFeedbackUseCase.submitFeedback({
      userId,
      dailyPlanId,
      rating: dto.rating,
      tags: dto.tags,
      notes: dto.notes
    });
  }

}
