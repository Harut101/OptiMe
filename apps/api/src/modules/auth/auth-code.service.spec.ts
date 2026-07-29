import { ConfigService } from '@nestjs/config';
import { AuthCodePurpose } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthCodeService } from './auth-code.service';
import { EmailDeliveryService } from './email-delivery.interface';

describe('AuthCodeService email failure recovery', () => {
  it('removes an undelivered code so the user can retry immediately', async () => {
    const prisma = {
      authCode: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'auth-code-1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations))
    } as unknown as PrismaService;
    const config = {
      get: jest.fn((key: string, fallback?: string) =>
        key === 'AUTH_DEV_CODE' ? '123456' : fallback
      )
    } as unknown as ConfigService;
    const emailDelivery: EmailDeliveryService = {
      sendAuthCode: jest.fn().mockRejectedValue(new Error('delivery unavailable'))
    };
    const service = new AuthCodeService(prisma, config, emailDelivery);

    await expect(
      service.issue({
        userId: 'user-1',
        email: 'private@example.com',
        locale: 'en-US',
        purpose: AuthCodePurpose.EMAIL_VERIFICATION
      })
    ).rejects.toThrow('delivery unavailable');

    expect(prisma.authCode.deleteMany).toHaveBeenCalledWith({
      where: { id: 'auth-code-1' }
    });
  });
});
