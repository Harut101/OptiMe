import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DailyPlanCheckInsService } from './daily-plan-check-ins.service';
import { CreateDailyPlanCheckInDto } from './dto/create-daily-plan-check-in.dto';

@UseGuards(JwtAuthGuard)
@Controller('daily-plans/:id/check-ins')
export class DailyPlanCheckInsController {
  constructor(private readonly checkInsService: DailyPlanCheckInsService) {}

  @Get()
  listCheckIns(@CurrentUser() user: AuthenticatedUser, @Param('id') dailyPlanId: string) {
    return this.checkInsService.listForPlan(user.userId, dailyPlanId);
  }

  @Post()
  createCheckIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') dailyPlanId: string,
    @Body() dto: CreateDailyPlanCheckInDto
  ) {
    return this.checkInsService.upsertForPlan(user.userId, dailyPlanId, dto);
  }
}
