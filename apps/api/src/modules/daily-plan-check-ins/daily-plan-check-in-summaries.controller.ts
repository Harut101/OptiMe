import { Controller, Get, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DailyPlanCheckInsService } from './daily-plan-check-ins.service';

@UseGuards(JwtAuthGuard)
@Controller('me/check-ins')
export class DailyPlanCheckInSummariesController {
  constructor(private readonly checkInsService: DailyPlanCheckInsService) {}

  @Get('evening-reflections')
  getRecentEveningReflections(@CurrentUser() user: AuthenticatedUser) {
    return this.checkInsService.getRecentEveningReflections(user.userId);
  }
}
