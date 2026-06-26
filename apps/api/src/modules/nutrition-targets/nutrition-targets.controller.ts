import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NutritionTargetsService } from './nutrition-targets.service';

@UseGuards(JwtAuthGuard)
@Controller('nutrition-targets')
export class NutritionTargetsController {
  constructor(private readonly nutritionTargetsService: NutritionTargetsService) {}

  @Get('preview')
  getPreview(@CurrentUser() user: AuthenticatedUser, @Query('date') date?: string) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must use YYYY-MM-DD format.');
    }

    return this.nutritionTargetsService.getPreview(user.userId, date);
  }
}
