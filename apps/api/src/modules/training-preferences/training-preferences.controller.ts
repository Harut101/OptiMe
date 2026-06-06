import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpsertTrainingPreferenceDto } from './dto/upsert-training-preference.dto';
import { TrainingPreferencesService } from './training-preferences.service';

@UseGuards(JwtAuthGuard)
@Controller('training-preferences')
export class TrainingPreferencesController {
  constructor(private readonly trainingPreferencesService: TrainingPreferencesService) {}

  @Get()
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.trainingPreferencesService.getForUser(user.userId);
  }

  @Put()
  upsertPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertTrainingPreferenceDto
  ) {
    return this.trainingPreferencesService.upsertForUser(user.userId, dto);
  }
}
