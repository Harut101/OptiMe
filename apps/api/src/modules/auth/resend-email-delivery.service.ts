import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { buildAuthEmailTemplate } from './auth-email-template';
import { EmailDeliveryService, SendAuthCodeInput } from './email-delivery.interface';

@Injectable()
export class ResendEmailDeliveryService implements EmailDeliveryService {
  private readonly logger = new Logger(ResendEmailDeliveryService.name);

  constructor(private readonly config: ConfigService) {}

  async sendAuthCode(input: SendAuthCodeInput): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM');
    const replyTo =
      this.config.get<string>('EMAIL_REPLY_TO') ?? this.config.get<string>('SUPPORT_EMAIL');

    if (!apiKey || !from) {
      throw new ServiceUnavailableException({
        code: 'EMAIL_PROVIDER_UNAVAILABLE',
        message: 'Email delivery is unavailable.'
      });
    }

    const template = buildAuthEmailTemplate({
      ...input,
      supportEmail: this.config.get<string>('SUPPORT_EMAIL')
    });
    const timeoutMs = this.getTimeoutMs();

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from,
          to: [input.email],
          reply_to: replyTo,
          subject: template.subject,
          text: template.text,
          html: template.html
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        this.logger.warn(
          `auth email rejected; provider=resend; purpose=${input.purpose}; status=${response.status}`
        );
        throw this.unavailable();
      }

      this.logger.log(`auth email accepted; provider=resend; purpose=${input.purpose}`);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      this.logger.warn(
        `auth email request failed; provider=resend; purpose=${input.purpose}; reason=${mapEmailFailure(error)}`
      );
      throw this.unavailable();
    }
  }

  private getTimeoutMs() {
    const configured = Number(this.config.get<string>('EMAIL_REQUEST_TIMEOUT_MS') ?? 10_000);
    return Number.isInteger(configured) && configured >= 1_000 && configured <= 30_000
      ? configured
      : 10_000;
  }

  private unavailable() {
    return new ServiceUnavailableException({
      code: 'EMAIL_PROVIDER_UNAVAILABLE',
      message: 'Email delivery is temporarily unavailable.'
    });
  }
}

function mapEmailFailure(error: unknown) {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return 'timeout';
    }

    return 'network_error';
  }

  return 'unknown_error';
}
