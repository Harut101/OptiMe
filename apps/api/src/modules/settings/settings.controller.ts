import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getForUser(user.userId);
  }

  @Put()
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto
  ) {
    return this.settingsService.updateForUser(user.userId, dto);
  }
}
