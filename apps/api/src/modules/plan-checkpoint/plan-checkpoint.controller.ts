import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EvaluateDailyPlanCheckpointDto } from './dto/evaluate-daily-plan-checkpoint.dto';
import { PlanCheckpointService } from './plan-checkpoint.service';

@UseGuards(JwtAuthGuard)
@Controller('daily-plans')
export class PlanCheckpointController {
  constructor(private readonly planCheckpointService: PlanCheckpointService) {}

  @Post(':id/checkpoint/evaluate')
  evaluate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') dailyPlanId: string,
    @Body() dto: EvaluateDailyPlanCheckpointDto
  ) {
    return this.planCheckpointService.evaluate(user.userId, dailyPlanId, dto);
  }
}
