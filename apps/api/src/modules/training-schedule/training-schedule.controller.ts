import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTrainingScheduleItemDto } from './dto/create-training-schedule-item.dto';
import { UpdateTrainingIntentDto } from './dto/update-training-intent.dto';
import { UpdateTrainingScheduleItemDto } from './dto/update-training-schedule-item.dto';
import { TrainingScheduleService } from './training-schedule.service';

@UseGuards(JwtAuthGuard)
@Controller('training-schedule')
export class TrainingScheduleController {
  constructor(private readonly scheduleService: TrainingScheduleService) {}

  @Get()
  listItems(@CurrentUser() user: AuthenticatedUser) {
    return this.scheduleService.listItems(user.userId);
  }

  @Post('items')
  createItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTrainingScheduleItemDto
  ) {
    return this.scheduleService.createItem(user.userId, dto);
  }

  @Put('intent')
  updateIntent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTrainingIntentDto
  ) {
    return this.scheduleService.updateIntent(user.userId, dto);
  }

  @Patch('items/:id')
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTrainingScheduleItemDto
  ) {
    return this.scheduleService.updateItem(user.userId, id, dto);
  }

  @Delete('items/:id')
  deleteItem(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.scheduleService.deleteItem(user.userId, id);
  }
}
