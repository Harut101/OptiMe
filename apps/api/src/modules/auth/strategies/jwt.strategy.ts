import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
  ver?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-only-secret')
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        email: true,
        emailVerifiedAt: true,
        authVersion: true
      }
    });

    if (
      !user?.emailVerifiedAt ||
      user.email !== payload.email ||
      user.authVersion !== (payload.ver ?? 0)
    ) {
      throw new UnauthorizedException();
    }

    return {
      userId: payload.sub,
      email: user.email
    };
  }
}
