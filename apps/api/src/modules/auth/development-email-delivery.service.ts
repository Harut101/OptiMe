import { Injectable, Logger } from '@nestjs/common';

import { EmailDeliveryService, SendAuthCodeInput } from './email-delivery.interface';

@Injectable()
export class DevelopmentEmailDeliveryService implements EmailDeliveryService {
  private readonly logger = new Logger(DevelopmentEmailDeliveryService.name);

  async sendAuthCode(input: SendAuthCodeInput): Promise<void> {
    this.logger.log(
      `development auth email accepted; purpose=${input.purpose}; expiresInMinutes=${input.expiresInMinutes}`
    );
  }
}
