import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthCodePurpose } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthCodeService } from './auth-code.service';
import { EmailRequestDto } from './dto/email-request.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly authCodes: AuthCodeService
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const privacyConsentedAt = dto.privacyConsentAccepted ? new Date() : null;

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        timezone: this.normalizeTimezone(dto.timezone),
        locale: dto.locale ?? 'en',
        privacyConsentedAt
      }
    });

    await this.authCodes.issue({
      userId: user.id,
      email: user.email,
      locale: user.locale,
      purpose: AuthCodePurpose.EMAIL_VERIFICATION
    });

    return {
      verificationRequired: true as const,
      email: user.email,
      messageCode: 'VERIFICATION_EMAIL_SENT' as const
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verify your email before signing in.'
      });
    }

    return this.buildAuthResponse(user);
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw this.invalidCode();
    }

    if (user.emailVerifiedAt) {
      throw this.invalidCode();
    }

    await this.authCodes.consume(user.id, AuthCodePurpose.EMAIL_VERIFICATION, dto.code);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() }
    });

    const verifiedUser = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return this.buildAuthResponse(verifiedUser);
  }

  async resendVerification(dto: EmailRequestDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) }
    });

    if (user && !user.emailVerifiedAt) {
      try {
        await this.authCodes.issue({
          userId: user.id,
          email: user.email,
          locale: user.locale,
          purpose: AuthCodePurpose.EMAIL_VERIFICATION
        });
      } catch (error) {
        if (!(error instanceof HttpException) || error.getStatus() !== HttpStatus.TOO_MANY_REQUESTS) {
          throw error;
        }
      }
    }

    return { messageCode: 'VERIFICATION_EMAIL_SENT' as const };
  }

  async requestPasswordReset(dto: EmailRequestDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) }
    });

    if (user?.emailVerifiedAt) {
      try {
        await this.authCodes.issue({
          userId: user.id,
          email: user.email,
          locale: user.locale,
          purpose: AuthCodePurpose.PASSWORD_RESET
        });
      } catch (error) {
        if (!(error instanceof HttpException) || error.getStatus() !== HttpStatus.TOO_MANY_REQUESTS) {
          throw error;
        }
      }
    }

    return { messageCode: 'PASSWORD_RESET_EMAIL_SENT' as const };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) }
    });

    if (!user?.emailVerifiedAt) {
      throw this.invalidCode();
    }

    await this.authCodes.consume(user.id, AuthCodePurpose.PASSWORD_RESET, dto.code);
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          authVersion: { increment: 1 }
        }
      }),
      this.prisma.authCode.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: new Date() }
      })
    ]);

    return { messageCode: 'PASSWORD_RESET_COMPLETE' as const };
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    timezone: string;
    locale: string;
    isMinor: boolean;
    safeMode: boolean;
    privacyConsentedAt: Date | null;
    authVersion: number;
  }) {
    const accessToken = this.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        ver: user.authVersion
      },
      {
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '1d')
      }
    );

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        timezone: user.timezone,
        locale: user.locale,
        isMinor: user.isMinor,
        safeMode: user.safeMode,
        privacyConsentedAt: user.privacyConsentedAt
      }
    };
  }

  private normalizeTimezone(timezone?: string) {
    if (!timezone) {
      return 'UTC';
    }

    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
      return timezone;
    } catch {
      return 'UTC';
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private invalidCode() {
    return new BadRequestException({
      code: 'AUTH_CODE_INVALID_OR_EXPIRED',
      message: 'The code is invalid or has expired.'
    });
  }
}
