import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DailyPlansService } from './daily-plans.service';
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

@UseGuards(JwtAuthGuard)
@Controller('daily-plans')
export class DailyPlansController {
  constructor(private readonly dailyPlansService: DailyPlansService) {}

  @Get('today')
  getTodayPlan(@CurrentUser() user: AuthenticatedUser) {
    return this.dailyPlansService.getTodayPlan(user.userId);
  }

  @Get('history')
  getHistory(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.dailyPlansService.getHistory(user.userId, limit);
  }

  @Post('generate')
  generateTodayPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateDailyPlanDto
  ) {
    return this.dailyPlansService.generateTodayPlan(user.userId, dto);
  }

  @Post(':id/feedback')
  submitFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') dailyPlanId: string,
    @Body() dto: SubmitDailyPlanFeedbackDto
  ) {
    return this.dailyPlansService.submitFeedback(user.userId, dailyPlanId, dto);
  }

  @Post(':id/food/regenerate')
  regenerateFoodPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') dailyPlanId: string,
    @Body() dto: RegenerateFoodPlanDto
  ) {
    return this.dailyPlansService.regenerateFoodPlan(user.userId, dailyPlanId, dto);
  }

  @Post(':id/food/meals/:mealId/regenerate')
  regenerateFoodMeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') dailyPlanId: string,
    @Param('mealId') mealId: string,
    @Body() dto: RegenerateFoodPlanDto
  ) {
    return this.dailyPlansService.regenerateFoodMeal(user.userId, dailyPlanId, mealId, dto);
  }

  @Get(':id/food/meals/:mealId/ingredients/:ingredientSlug/swap-suggestions')
  getFoodIngredientSwapSuggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') dailyPlanId: string,
    @Param('mealId') mealId: string,
    @Param('ingredientSlug') ingredientSlug: string
  ) {
    return this.dailyPlansService.getFoodIngredientSwapSuggestions(
      user.userId,
      dailyPlanId,
      mealId,
      ingredientSlug
    );
  }

  @Post(':id/food/meals/:mealId/ingredients/:ingredientSlug/apply-swap')
  applyFoodIngredientSwap(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') dailyPlanId: string,
    @Param('mealId') mealId: string,
    @Param('ingredientSlug') ingredientSlug: string,
    @Body() dto: ApplyFoodIngredientSwapDto
  ) {
    return this.dailyPlansService.applyFoodIngredientSwap(
      user.userId,
      dailyPlanId,
      mealId,
      ingredientSlug,
      dto
    );
  }

  @Post(':id/food/exclude-ingredient')
  excludeFoodIngredient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') dailyPlanId: string,
    @Body() dto: ExcludeFoodIngredientDto
  ) {
    return this.dailyPlansService.excludeFoodIngredient(user.userId, dailyPlanId, dto);
  }

  @Post(':id/training/adjust-for-pre-workout')
  adjustTrainingForPreWorkout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') dailyPlanId: string,
    @Body() dto: AdjustTrainingForPreWorkoutDto
  ) {
    return this.dailyPlansService.adjustTrainingForPreWorkout(user.userId, dailyPlanId, dto);
  }

  @Post(':id/training/replacement-proposals')
  getTrainingReplacementProposals(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') dailyPlanId: string,
    @Body() dto: TrainingReplacementProposalsDto
  ) {
    return this.dailyPlansService.getTrainingReplacementProposals(user.userId, dailyPlanId, dto);
  }

  @Post(':id/training/apply-replacements')
  applyTrainingReplacements(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') dailyPlanId: string,
    @Body() dto: ApplyTrainingReplacementsDto
  ) {
    return this.dailyPlansService.applyTrainingReplacements(user.userId, dailyPlanId, dto);
  }
}
