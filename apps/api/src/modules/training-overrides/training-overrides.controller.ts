import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MoveWorkoutDto } from './dto/move-workout.dto';
import { UpsertDailyTrainingOverrideDto } from './dto/upsert-daily-training-override.dto';
import { TrainingOverridesService } from './training-overrides.service';

@UseGuards(JwtAuthGuard)
@Controller('training-overrides')
export class TrainingOverridesController {
  constructor(private readonly overridesService: TrainingOverridesService) {}

  @Get()
  getByDate(@CurrentUser() user: AuthenticatedUser, @Query('date') localDate: string) {
    return this.overridesService.getByDate(user.userId, localDate);
  }

  @Put(':localDate')
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('localDate') localDate: string,
    @Body() dto: UpsertDailyTrainingOverrideDto
  ) {
    return this.overridesService.upsert(user.userId, localDate, dto);
  }

  @Delete(':localDate')
  delete(@CurrentUser() user: AuthenticatedUser, @Param('localDate') localDate: string) {
    return this.overridesService.delete(user.userId, localDate);
  }

  @Post('move-workout')
  moveWorkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: MoveWorkoutDto) {
    return this.overridesService.moveWorkout(user.userId, dto);
  }
}
