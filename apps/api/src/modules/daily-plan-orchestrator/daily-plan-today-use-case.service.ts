import {
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { PreferredLocale } from '@prisma/client';
import {
  resolveSupportedLocale,
  type SupportedLocale
} from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { DailyPlanGenerationUseCaseService } from './daily-plan-generation-use-case.service';
import {
  dailyPlanPlanningUserSelect,
  type DailyPlanPlanningUser
} from './daily-plan-planning-user';
import type { GenerateTodayDailyPlanInput } from './daily-plan-today-use-case.interface';

@Injectable()
export class DailyPlanTodayUseCaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generationUseCase: DailyPlanGenerationUseCaseService
  ) {}

  async getToday(userId: string) {
    const user = await this.getPlanningUser(userId);
    const { planLocalDate, planTimezone } =
      this.getLocalPlanDate(user.timezone);

    return this.prisma.dailyPlan.findUnique({
      where: {
        userId_planLocalDate_planTimezone: {
          userId,
          planLocalDate,
          planTimezone
        }
      }
    });
  }

  async generateToday(input: GenerateTodayDailyPlanInput) {
    const user = await this.getPlanningUser(input.userId);
    const { planLocalDate, planTimezone } =
      this.getLocalPlanDate(user.timezone);
    const locale = this.resolvePlanningLocale(user);
    const existingPlan =
      await this.prisma.dailyPlan.findUnique({
        where: {
          userId_planLocalDate_planTimezone: {
            userId: input.userId,
            planLocalDate,
            planTimezone
          }
        }
      });

    return this.generationUseCase.generate({
      userId: input.userId,
      user,
      existingPlan,
      planLocalDate,
      planTimezone,
      locale,
      forceRegenerate: input.forceRegenerate,
      recreateForCurrentLanguage:
        input.recreateForCurrentLanguage
    });
  }

  private async getPlanningUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: dailyPlanPlanningUserSelect
    });

    if (!user) {
      throw new UnauthorizedException(
        'Your session is no longer valid. Please log in again.'
      );
    }

    return user;
  }

  private getLocalPlanDate(timezone: string) {
    const planTimezone = this.normalizeTimezone(timezone);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: planTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const year = parts.find(
      (part) => part.type === 'year'
    )?.value;
    const month = parts.find(
      (part) => part.type === 'month'
    )?.value;
    const day = parts.find(
      (part) => part.type === 'day'
    )?.value;

    return {
      planLocalDate: `${year}-${month}-${day}`,
      planTimezone
    };
  }

  private normalizeTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone
      }).format(new Date());

      return timezone;
    } catch {
      return 'UTC';
    }
  }

  private resolvePlanningLocale(
    user: DailyPlanPlanningUser
  ): SupportedLocale {
    switch (user.settings?.preferredLocale) {
      case PreferredLocale.RU_RU:
        return 'ru-RU';
      case PreferredLocale.FR_FR:
        return 'fr-FR';
      case PreferredLocale.ZH_CN:
        return 'zh-CN';
      case PreferredLocale.EN_US:
        return 'en-US';
      default:
        return resolveSupportedLocale(user.locale);
    }
  }
}
