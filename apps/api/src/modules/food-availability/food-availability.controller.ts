import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReplaceFoodAvailabilityDto } from './dto/replace-food-availability.dto';
import { FoodAvailabilityService } from './food-availability.service';

@UseGuards(JwtAuthGuard)
@Controller('food-availability')
export class FoodAvailabilityController {
  constructor(private readonly foodAvailabilityService: FoodAvailabilityService) {}

  @Get('today')
  getToday(@CurrentUser() user: AuthenticatedUser) {
    return this.foodAvailabilityService.getToday(user.userId);
  }

  @Get('candidates')
  listCandidates(@CurrentUser() user: AuthenticatedUser) {
    return this.foodAvailabilityService.listTodayCandidates(user.userId);
  }

  @Put('today')
  replaceToday(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReplaceFoodAvailabilityDto
  ) {
    return this.foodAvailabilityService.replaceToday(user.userId, dto);
  }
}
