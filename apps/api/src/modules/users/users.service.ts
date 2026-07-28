import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { WhoopConnectionService } from '../health/whoop/whoop-connection.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whoopConnection: WhoopConnectionService
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        timezone: true,
        locale: true,
        isMinor: true,
        safeMode: true,
        privacyConsentedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true }
    });

    if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_PASSWORD_INVALID',
        message: 'The current password is incorrect.'
      });
    }

    try {
      await this.whoopConnection.disconnect(userId);
    } catch {
      // Provider revocation is best effort; local account data must still be removable.
      this.logger.warn('Account deletion continued after provider revocation failed');
    }

    await this.prisma.user.delete({ where: { id: userId } });
    this.logger.log('Account and associated local data deleted');
  }
}
