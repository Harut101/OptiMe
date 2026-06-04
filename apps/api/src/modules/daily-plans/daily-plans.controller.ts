import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DailyPlansService } from './daily-plans.service';
import { GenerateDailyPlanDto } from './dto/generate-daily-plan.dto';
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
}
