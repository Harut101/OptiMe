import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmailDeliveryService, SendAuthCodeInput } from './email-delivery.interface';

@Injectable()
export class ResendEmailDeliveryService implements EmailDeliveryService {
  constructor(private readonly config: ConfigService) {}

  async sendAuthCode(input: SendAuthCodeInput): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM');

    if (!apiKey || !from) {
      throw new ServiceUnavailableException({
        code: 'EMAIL_PROVIDER_UNAVAILABLE',
        message: 'Email delivery is unavailable.'
      });
    }

    const isVerification = input.purpose === 'EMAIL_VERIFICATION';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        subject: isVerification ? 'Verify your OptiMe email' : 'Reset your OptiMe password',
        text: [
          isVerification
            ? 'Use this code to verify your OptiMe email:'
            : 'Use this code to reset your OptiMe password:',
          input.code,
          `The code expires in ${input.expiresInMinutes} minutes.`,
          'If you did not request this, you can ignore this email.'
        ].join('\n\n')
      }),
      signal: AbortSignal.timeout(this.config.get<number>('EMAIL_REQUEST_TIMEOUT_MS', 10_000))
    });

    if (!response.ok) {
      throw new ServiceUnavailableException({
        code: 'EMAIL_PROVIDER_UNAVAILABLE',
        message: 'Email delivery is temporarily unavailable.'
      });
    }
  }
}
