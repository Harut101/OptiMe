import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { AuthRateLimit } from './auth-rate-limit.decorator';
import { AuthService } from './auth.service';
import { EmailRequestDto } from './dto/email-request.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';

@Controller('auth')
@UseGuards(AuthRateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @AuthRateLimit({ name: 'register', windowSeconds: 900, ipLimit: 20, identityLimit: 3 })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @AuthRateLimit({ name: 'login', windowSeconds: 900, ipLimit: 60, identityLimit: 10 })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('verify-email')
  @AuthRateLimit({ name: 'verify-email', windowSeconds: 900, ipLimit: 60, identityLimit: 10 })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @AuthRateLimit({
    name: 'resend-verification',
    windowSeconds: 3600,
    ipLimit: 30,
    identityLimit: 5
  })
  resendVerification(@Body() dto: EmailRequestDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('request-password-reset')
  @AuthRateLimit({
    name: 'request-password-reset',
    windowSeconds: 3600,
    ipLimit: 30,
    identityLimit: 5
  })
  requestPasswordReset(@Body() dto: EmailRequestDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  @AuthRateLimit({
    name: 'reset-password',
    windowSeconds: 3600,
    ipLimit: 30,
    identityLimit: 10
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
