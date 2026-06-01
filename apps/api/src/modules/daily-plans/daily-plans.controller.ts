import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DailyPlansService } from './daily-plans.service';
import { GenerateDailyPlanDto } from './dto/generate-daily-plan.dto';

@UseGuards(JwtAuthGuard)
@Controller('daily-plans')
export class DailyPlansController {
  constructor(private readonly dailyPlansService: DailyPlansService) {}

  @Get('today')
  getTodayPlan(@CurrentUser() user: AuthenticatedUser) {
    return this.dailyPlansService.getTodayPlan(user.userId);
  }

  @Post('generate')
  generateTodayPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateDailyPlanDto
  ) {
    return this.dailyPlansService.generateTodayPlan(user.userId, dto);
  }
}
