import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthCodePurpose } from '@prisma/client';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { EmailDeliveryService } from './email-delivery.interface';
import { EMAIL_DELIVERY_SERVICE } from './email-delivery.token';

const CODE_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_CODES_PER_HOUR = 5;
const MAX_FAILED_ATTEMPTS = 5;

@Injectable()
export class AuthCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(EMAIL_DELIVERY_SERVICE)
    private readonly emailDelivery: EmailDeliveryService
  ) {}

  async issue(input: {
    userId: string;
    email: string;
    locale: string;
    purpose: AuthCodePurpose;
  }) {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recent = await this.prisma.authCode.findMany({
      where: {
        userId: input.userId,
        purpose: input.purpose,
        createdAt: { gte: hourAgo }
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    if (
      recent[0] &&
      now.getTime() - recent[0].createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000
    ) {
      throw this.rateLimited();
    }

    if (recent.length >= MAX_CODES_PER_HOUR) {
      throw this.rateLimited();
    }

    const code = this.generateCode();
    const [, authCode] = await this.prisma.$transaction([
      this.prisma.authCode.updateMany({
        where: {
          userId: input.userId,
          purpose: input.purpose,
          consumedAt: null
        },
        data: { consumedAt: now }
      }),
      this.prisma.authCode.create({
        data: {
          userId: input.userId,
          purpose: input.purpose,
          codeHash: this.hashCode(input.userId, input.purpose, code),
          expiresAt: new Date(now.getTime() + CODE_EXPIRY_MINUTES * 60 * 1000)
        }
      })
    ]);

    try {
      await this.emailDelivery.sendAuthCode({
        email: input.email,
        code,
        purpose: input.purpose,
        expiresInMinutes: CODE_EXPIRY_MINUTES,
        locale: input.locale
      });
    } catch (error) {
      await this.prisma.authCode.deleteMany({ where: { id: authCode.id } });
      throw error;
    }
  }

  async consume(userId: string, purpose: AuthCodePurpose, code: string) {
    const record = await this.prisma.authCode.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' }
    });
    const now = new Date();

    if (!record || record.expiresAt <= now || record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      throw this.invalidCode();
    }

    const expected = Buffer.from(record.codeHash, 'hex');
    const actual = Buffer.from(this.hashCode(userId, purpose, code), 'hex');
    const valid = expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!valid) {
      await this.prisma.authCode.update({
        where: { id: record.id },
        data: {
          failedAttempts: { increment: 1 },
          consumedAt: record.failedAttempts + 1 >= MAX_FAILED_ATTEMPTS ? now : undefined
        }
      });
      throw this.invalidCode();
    }

    await this.prisma.authCode.update({
      where: { id: record.id },
      data: { consumedAt: now }
    });
  }

  private generateCode() {
    const configured = this.config.get<string>('AUTH_DEV_CODE');
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    if (!isProduction && configured && /^\d{6}$/.test(configured)) {
      return configured;
    }

    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashCode(userId: string, purpose: AuthCodePurpose, code: string) {
    const secret = this.config.get<string>('AUTH_CODE_SECRET', 'development-auth-code-secret');
    return createHmac('sha256', secret).update(`${userId}:${purpose}:${code}`).digest('hex');
  }

  private invalidCode() {
    return new BadRequestException({
      code: 'AUTH_CODE_INVALID_OR_EXPIRED',
      message: 'The code is invalid or has expired.'
    });
  }

  private rateLimited() {
    return new HttpException(
      {
        code: 'AUTH_CODE_RATE_LIMITED',
        message: 'Please wait before requesting another code.'
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }
}
