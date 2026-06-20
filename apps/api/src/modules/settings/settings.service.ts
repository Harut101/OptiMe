import { BadRequestException, Injectable } from '@nestjs/common';
import { MeasurementSystem as PrismaMeasurementSystem, PreferredLocale } from '@prisma/client';
import {
  resolveSupportedLocale,
  type MeasurementSystem,
  type SupportedLocale
} from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const TO_PRISMA_LOCALE: Record<SupportedLocale, PreferredLocale> = {
  'en-US': PreferredLocale.EN_US,
  'ru-RU': PreferredLocale.RU_RU,
  'fr-FR': PreferredLocale.FR_FR,
  'zh-CN': PreferredLocale.ZH_CN
};

const FROM_PRISMA_LOCALE: Record<PreferredLocale, SupportedLocale> = {
  [PreferredLocale.EN_US]: 'en-US',
  [PreferredLocale.RU_RU]: 'ru-RU',
  [PreferredLocale.FR_FR]: 'fr-FR',
  [PreferredLocale.ZH_CN]: 'zh-CN'
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { locale: true, settings: true }
    });

    if (!user.settings) {
      return {
        preferredLocale: resolveSupportedLocale(user.locale),
        measurementSystem: 'METRIC' as const,
        initialized: false
      };
    }

    return this.toResponse(user.settings, true);
  }

  async updateForUser(userId: string, dto: UpdateSettingsDto) {
    if (dto.preferredLocale === undefined && dto.measurementSystem === undefined) {
      throw new BadRequestException('At least one setting must be provided.');
    }

    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { locale: true, settings: true }
    });
    const preferredLocale =
      dto.preferredLocale ??
      (current.settings
        ? FROM_PRISMA_LOCALE[current.settings.preferredLocale]
        : resolveSupportedLocale(current.locale));
    const measurementSystem =
      dto.measurementSystem ??
      (current.settings?.measurementSystem as MeasurementSystem | undefined) ??
      'METRIC';

    const settings = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.userSettings.upsert({
        where: { userId },
        update: {
          preferredLocale: TO_PRISMA_LOCALE[preferredLocale],
          measurementSystem: measurementSystem as PrismaMeasurementSystem
        },
        create: {
          userId,
          preferredLocale: TO_PRISMA_LOCALE[preferredLocale],
          measurementSystem: measurementSystem as PrismaMeasurementSystem
        }
      });

      if (dto.preferredLocale) {
        await tx.user.update({ where: { id: userId }, data: { locale: dto.preferredLocale } });
      }

      return saved;
    });

    return this.toResponse(settings, true);
  }

  private toResponse(
    settings: { preferredLocale: PreferredLocale; measurementSystem: PrismaMeasurementSystem },
    initialized: boolean
  ) {
    return {
      preferredLocale: FROM_PRISMA_LOCALE[settings.preferredLocale],
      measurementSystem: settings.measurementSystem as MeasurementSystem,
      initialized
    };
  }
}
