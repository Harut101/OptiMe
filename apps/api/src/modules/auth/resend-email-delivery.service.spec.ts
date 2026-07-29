import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ResendEmailDeliveryService } from './resend-email-delivery.service';

describe('ResendEmailDeliveryService', () => {
  const originalFetch = global.fetch;
  const configValues: Record<string, string> = {
    RESEND_API_KEY: 're_test_key_long_enough',
    EMAIL_FROM: 'OptiMe <hello@optime.example>',
    EMAIL_REPLY_TO: 'support@optime.example',
    SUPPORT_EMAIL: 'support@optime.example',
    EMAIL_REQUEST_TIMEOUT_MS: '12000'
  };
  const config = {
    get: jest.fn((key: string) => configValues[key])
  } as unknown as ConfigService;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('sends localized HTML and text through the structured Resend request', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;
    const service = new ResendEmailDeliveryService(config);

    await service.sendAuthCode({
      email: 'user@example.com',
      code: '123456',
      purpose: 'EMAIL_VERIFICATION',
      expiresInMinutes: 10,
      locale: 'ru-RU'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;

    expect(url).toBe('https://api.resend.com/emails');
    expect(request.headers).toMatchObject({
      Authorization: 'Bearer re_test_key_long_enough',
      'Content-Type': 'application/json'
    });
    expect(body).toMatchObject({
      from: 'OptiMe <hello@optime.example>',
      to: ['user@example.com'],
      reply_to: 'support@optime.example',
      subject: 'Подтвердите email в OptiMe'
    });
    expect(body.text).toContain('123456');
    expect(body.html).toContain('123456');
  });

  it('maps provider and network failures to a generic safe API error', async () => {
    const service = new ResendEmailDeliveryService(config);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });

    await expect(
      service.sendAuthCode({
        email: 'private@example.com',
        code: '123456',
        purpose: 'PASSWORD_RESET',
        expiresInMinutes: 10,
        locale: 'en-US'
      })
    ).rejects.toMatchObject({
      response: {
        code: 'EMAIL_PROVIDER_UNAVAILABLE'
      }
    });

    global.fetch = jest.fn().mockRejectedValue(new Error('provider response with private data'));

    await expect(
      service.sendAuthCode({
        email: 'private@example.com',
        code: '123456',
        purpose: 'PASSWORD_RESET',
        expiresInMinutes: 10,
        locale: 'en-US'
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
