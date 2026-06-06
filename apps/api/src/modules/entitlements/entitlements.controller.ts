import { Controller, Get, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeatureAccessService } from './feature-access.service';

@Controller('me/entitlements')
export class EntitlementsController {
  constructor(private readonly featureAccessService: FeatureAccessService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getEntitlements(@CurrentUser() user: AuthenticatedUser) {
    return this.featureAccessService.getEntitlementSummary(user.userId);
  }
}
