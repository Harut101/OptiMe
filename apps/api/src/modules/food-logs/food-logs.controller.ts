import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateFoodMealStatusDto } from './dto/update-food-meal-status.dto';
import { FoodLogsService } from './food-logs.service';

@UseGuards(JwtAuthGuard)
@Controller('daily-plans/:dailyPlanId/food-log')
export class FoodLogsController {
  constructor(private readonly foodLogsService: FoodLogsService) {}

  @Get()
  getFoodLog(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dailyPlanId') dailyPlanId: string
  ) {
    return this.foodLogsService.getFoodLog(user.userId, dailyPlanId);
  }

  @Post('meals/:mealId/status')
  updateMealStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dailyPlanId') dailyPlanId: string,
    @Param('mealId') mealId: string,
    @Body() dto: UpdateFoodMealStatusDto
  ) {
    return this.foodLogsService.updateMealStatus(user.userId, dailyPlanId, mealId, dto);
  }
}
