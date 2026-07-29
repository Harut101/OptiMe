import {
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  UseGuards
} from '@nestjs/common';
import type { Request } from 'express';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingReconciliationService } from './billing-reconciliation.service';

@Controller()
export class BillingController {
  constructor(
    private readonly reconciliation: BillingReconciliationService
  ) {}

  @Post('billing/webhooks/revenuecat')
  receiveRevenueCatWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('authorization') authorization?: string,
    @Headers('x-revenuecat-webhook-signature') signature?: string
  ) {
    return this.reconciliation.processWebhook({
      headers: {
        authorization,
        'x-revenuecat-webhook-signature': signature
      },
      rawBody: request.rawBody ?? Buffer.alloc(0),
      receivedAt: new Date()
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/billing/reconcile')
  reconcileBilling(@CurrentUser() user: AuthenticatedUser) {
    return this.reconciliation.reconcileCustomer(user.userId);
  }
}
