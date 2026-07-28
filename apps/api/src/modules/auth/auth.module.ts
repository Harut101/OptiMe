import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthCodeService } from './auth-code.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthService } from './auth.service';
import { DevelopmentEmailDeliveryService } from './development-email-delivery.service';
import { EMAIL_DELIVERY_SERVICE } from './email-delivery.token';
import { ResendEmailDeliveryService } from './resend-email-delivery.service';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-only-secret'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '1d')
        }
      })
    })
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCodeService,
    AuthRateLimitService,
    AuthRateLimitGuard,
    JwtStrategy,
    DevelopmentEmailDeliveryService,
    ResendEmailDeliveryService,
    {
      provide: EMAIL_DELIVERY_SERVICE,
      inject: [ConfigService, DevelopmentEmailDeliveryService, ResendEmailDeliveryService],
      useFactory: (
        config: ConfigService,
        development: DevelopmentEmailDeliveryService,
        resend: ResendEmailDeliveryService
      ) => {
        const production = config.get<string>('NODE_ENV') === 'production';
        const provider = config.get<string>(
          'EMAIL_PROVIDER',
          production ? 'resend' : 'development'
        );

        if (provider !== 'development' && provider !== 'resend') {
          throw new Error('EMAIL_PROVIDER must be development or resend.');
        }

        if (production && provider !== 'resend') {
          throw new Error('EMAIL_PROVIDER=resend is required in production.');
        }

        if (
          provider === 'resend' &&
          (!config.get<string>('RESEND_API_KEY') || !config.get<string>('EMAIL_FROM'))
        ) {
          throw new Error('RESEND_API_KEY and EMAIL_FROM are required for EMAIL_PROVIDER=resend.');
        }

        if (production && !config.get<string>('AUTH_CODE_SECRET')) {
          throw new Error('AUTH_CODE_SECRET is required in production.');
        }

        return provider === 'resend' ? resend : development;
      }
    }
  ],
  exports: [AuthService]
})
export class AuthModule {}
