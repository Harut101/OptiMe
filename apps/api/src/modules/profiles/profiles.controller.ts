import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpsertProfileDto } from './dto/upsert-profile.dto';
import { ProfilesService } from './profiles.service';

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getProfile(user.userId);
  }

  @Put()
  upsertProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertProfileDto) {
    return this.profilesService.upsertProfile(user.userId, dto);
  }
}
