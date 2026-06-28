import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompleteWorkoutSessionDto } from './dto/complete-workout-session.dto';
import { StartWorkoutSessionDto } from './dto/start-workout-session.dto';
import { ToggleWorkoutSetDto } from './dto/toggle-workout-set.dto';
import { UpdateWorkoutExerciseProgressDto } from './dto/update-workout-exercise-progress.dto';
import { WorkoutSessionsService } from './workout-sessions.service';

@UseGuards(JwtAuthGuard)
@Controller('workout-sessions')
export class WorkoutSessionsController {
  constructor(private readonly workoutSessionsService: WorkoutSessionsService) {}

  @Post()
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartWorkoutSessionDto) {
    return this.workoutSessionsService.start(user.userId, dto);
  }

  @Get('by-plan/:dailyPlanId')
  getByPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dailyPlanId') dailyPlanId: string
  ) {
    return this.workoutSessionsService.getByPlan(user.userId, dailyPlanId);
  }

  @Get(':sessionId')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('sessionId') sessionId: string) {
    return this.workoutSessionsService.getById(user.userId, sessionId);
  }

  @Patch(':sessionId/exercises/:progressId/sets')
  toggleSet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Param('progressId') progressId: string,
    @Body() dto: ToggleWorkoutSetDto
  ) {
    return this.workoutSessionsService.toggleSet(user.userId, sessionId, progressId, dto);
  }

  @Patch(':sessionId/exercises/:progressId')
  updateExercise(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Param('progressId') progressId: string,
    @Body() dto: UpdateWorkoutExerciseProgressDto
  ) {
    return this.workoutSessionsService.updateExercise(user.userId, sessionId, progressId, dto);
  }

  @Post(':sessionId/complete')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: CompleteWorkoutSessionDto
  ) {
    return this.workoutSessionsService.complete(user.userId, sessionId, dto);
  }
}
