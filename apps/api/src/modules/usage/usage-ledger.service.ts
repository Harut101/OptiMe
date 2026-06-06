import { Injectable } from '@nestjs/common';
import { UsageFeature, UsagePeriodType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsageLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  getPeriodStart(periodType: UsagePeriodType, date = new Date(), timezone = 'UTC') {
    const localParts = this.getLocalDateParts(date, timezone);

    if (periodType === UsagePeriodType.MONTHLY) {
      return new Date(Date.UTC(localParts.year, localParts.month - 1, 1));
    }

    return new Date(Date.UTC(localParts.year, localParts.month - 1, localParts.day));
  }

  getResetAt(periodType: UsagePeriodType, periodStart: Date) {
    if (periodType === UsagePeriodType.MONTHLY) {
      return new Date(
        Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1)
      );
    }

    return new Date(
      Date.UTC(
        periodStart.getUTCFullYear(),
        periodStart.getUTCMonth(),
        periodStart.getUTCDate() + 1
      )
    );
  }

  async getUsage(
    userId: string,
    feature: UsageFeature,
    periodType: UsagePeriodType,
    date = new Date(),
    timezone = 'UTC'
  ) {
    const periodStart = this.getPeriodStart(periodType, date, timezone);
    const row = await this.prisma.usageLedger.findUnique({
      where: {
        userId_feature_periodType_periodStart: {
          userId,
          feature,
          periodType,
          periodStart
        }
      }
    });

    return row?.count ?? 0;
  }

  async incrementUsage(
    userId: string,
    feature: UsageFeature,
    periodType: UsagePeriodType,
    amount = 1,
    date = new Date(),
    timezone = 'UTC'
  ) {
    const safeAmount = this.normalizeAmount(amount);
    const periodStart = this.getPeriodStart(periodType, date, timezone);

    return this.prisma.usageLedger.upsert({
      where: {
        userId_feature_periodType_periodStart: {
          userId,
          feature,
          periodType,
          periodStart
        }
      },
      update: {
        count: {
          increment: safeAmount
        }
      },
      create: {
        userId,
        feature,
        periodType,
        periodStart,
        count: safeAmount
      }
    });
  }

  async decrementUsageById(id: string, amount = 1) {
    const safeAmount = this.normalizeAmount(amount);

    return this.prisma.usageLedger.update({
      where: { id },
      data: {
        count: {
          decrement: safeAmount
        }
      }
    });
  }

  private normalizeAmount(amount: number) {
    return Number.isFinite(amount) && amount > 0 ? Math.trunc(amount) : 1;
  }

  private getLocalDateParts(date: Date, timezone: string) {
    const safeTimezone = this.normalizeTimezone(timezone);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);

    return {
      year: Number(parts.find((part) => part.type === 'year')?.value),
      month: Number(parts.find((part) => part.type === 'month')?.value),
      day: Number(parts.find((part) => part.type === 'day')?.value)
    };
  }

  private normalizeTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
      return timezone;
    } catch {
      return 'UTC';
    }
  }
}
