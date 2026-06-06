import { Controller, Get, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsageGuardService } from './usage-guard.service';

@Controller('me/usage')
export class UsageController {
  constructor(private readonly usageGuardService: UsageGuardService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getUsage(@CurrentUser() user: AuthenticatedUser) {
    return this.usageGuardService.getUsageSummary(user.userId);
  }
}
