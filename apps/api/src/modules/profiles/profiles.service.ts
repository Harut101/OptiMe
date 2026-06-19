import { Injectable } from '@nestjs/common';
import { PregnancyStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { SafetyService } from '../safety/safety.service';
import { UpsertProfileDto } from './dto/upsert-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly safetyService: SafetyService
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
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
        profile: true
      }
    });

    const { profile, ...account } = user;
    return { user: account, profile };
  }

  async upsertProfile(userId: string, dto: UpsertProfileDto) {
    const derived = this.safetyService.deriveAgeSafety(dto.dateOfBirth);

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
          timezone: true,
          locale: true,
          isMinor: true,
          safeMode: true,
          privacyConsentedAt: true
        }
      });

      const profile = await tx.profile.upsert({
        where: { userId },
        update: {
          gender: dto.gender,
          pregnancyStatus: dto.pregnancyStatus ?? PregnancyStatus.UNKNOWN,
          dateOfBirth: dto.dateOfBirth,
          heightCm: dto.heightCm,
          weightKg: dto.weightKg,
          activityLevel: dto.activityLevel
        },
        create: {
          userId,
          gender: dto.gender,
          pregnancyStatus: dto.pregnancyStatus ?? PregnancyStatus.UNKNOWN,
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
}
