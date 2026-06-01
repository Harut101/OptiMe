import { Body, Controller, Put, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpsertNutritionPreferencesDto } from './dto/upsert-nutrition-preferences.dto';
import { NutritionPreferencesService } from './nutrition-preferences.service';

@UseGuards(JwtAuthGuard)
@Controller('nutrition-preferences')
export class NutritionPreferencesController {
  constructor(private readonly preferencesService: NutritionPreferencesService) {}

  @Put()
  upsertPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertNutritionPreferencesDto
  ) {
    return this.preferencesService.upsertPreferences(user.userId, dto);
  }
}
