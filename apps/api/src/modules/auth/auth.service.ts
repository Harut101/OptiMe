import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
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

    return this.buildAuthResponse(user);
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

    return this.buildAuthResponse(user);
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
  }) {
    const accessToken = this.jwt.sign(
      {
        sub: user.id,
        email: user.email
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
}
