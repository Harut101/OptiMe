import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { UpsertProfileDto } from './dto/upsert-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertProfile(userId: string, dto: UpsertProfileDto) {
    const derived = this.deriveAgeSafety(dto.dateOfBirth);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          isMinor: derived.isMinor,
          safeMode: derived.safeMode,
          privacyConsentedAt: dto.privacyConsentAccepted ? new Date() : undefined
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isMinor: true,
          safeMode: true,
          privacyConsentedAt: true
        }
      });

      const profile = await tx.profile.upsert({
        where: { userId },
        update: {
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth,
          heightCm: dto.heightCm,
          weightKg: dto.weightKg,
          activityLevel: dto.activityLevel
        },
        create: {
          userId,
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth,
          heightCm: dto.heightCm,
          weightKg: dto.weightKg,
          activityLevel: dto.activityLevel
        }
      });

      return { user, profile };
    });

    return result;
  }

  private deriveAgeSafety(dateOfBirth: Date) {
    if (Number.isNaN(dateOfBirth.getTime())) {
      throw new BadRequestException('dateOfBirth must be a valid date.');
    }

    const now = new Date();

    if (dateOfBirth > now) {
      throw new BadRequestException('dateOfBirth must be in the past.');
    }

    let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
    const monthDelta = now.getUTCMonth() - dateOfBirth.getUTCMonth();
    const hasBirthdayPassed =
      monthDelta > 0 || (monthDelta === 0 && now.getUTCDate() >= dateOfBirth.getUTCDate());

    if (!hasBirthdayPassed) {
      age -= 1;
    }

    const isMinor = age < 18;

    return {
      isMinor,
      safeMode: isMinor
    };
  }
}
