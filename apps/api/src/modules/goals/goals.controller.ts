import { Body, Controller, Put, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpsertGoalDto } from './dto/upsert-goal.dto';
import { GoalsService } from './goals.service';

@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Put()
  upsertGoal(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertGoalDto) {
    return this.goalsService.upsertGoal(user.userId, dto);
  }
}
