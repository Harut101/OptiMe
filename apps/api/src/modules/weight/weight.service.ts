import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PregnancyStatus, PrimaryGoal, WeightDataSource } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateWeightLogDto, WeightUnitDto } from './dto/create-weight-log.dto';

const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 350;
const KG_PER_LB = 0.45359237;

@Injectable()
export class WeightService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const user = await this.getPlanningUser(userId);
    const [latestLog, firstLog] = await Promise.all([
      this.prisma.weightLog.findFirst({
        where: { userId },
        orderBy: [{ measuredAt: 'desc' }, { updatedAt: 'desc' }]
      }),
      this.prisma.weightLog.findFirst({
        where: { userId },
        orderBy: [{ measuredAt: 'asc' }, { createdAt: 'asc' }]
      })
    ]);

    const currentWeightKg = latestLog ? Number(latestLog.weightKg) : user.profile?.weightKg ?? null;
    const startingWeightKg = firstLog ? Number(firstLog.weightKg) : null;
    const targetWeightKg = user.goal?.targetWeightKg ?? null;
    const direction = this.resolveDirection(user.goal?.primaryGoal ?? null, startingWeightKg, currentWeightKg, targetWeightKg);
    const remainingToGoalKg =
      currentWeightKg !== null && targetWeightKg !== null && direction !== 'UNKNOWN'
        ? round(Math.abs(currentWeightKg - targetWeightKg), 1)
        : null;

    return {
      currentWeightKg: currentWeightKg === null ? null : round(currentWeightKg, 1),
      targetWeightKg: targetWeightKg === null ? null : round(targetWeightKg, 1),
      startingWeightKg: startingWeightKg === null ? null : round(startingWeightKg, 1),
      remainingToGoalKg,
      progressPercent: this.resolveProgressPercent(direction, startingWeightKg, currentWeightKg, targetWeightKg),
      direction,
      lastUpdatedAt: latestLog?.measuredAt.toISOString() ?? null,
      source: latestLog?.source ?? null,
      safetyStatus: this.resolveSafetyStatus(user)
    };
  }

  async listLogs(userId: string, limit = 20) {
    const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? Math.floor(limit) : 20, 1), 50);
    const logs = await this.prisma.weightLog.findMany({
      where: { userId },
      orderBy: [{ measuredAt: 'desc' }, { updatedAt: 'desc' }],
      take: safeLimit
    });

    return { items: logs.map((log) => this.toLogResponse(log)) };
  }

  async createManualLog(userId: string, dto: CreateWeightLogDto) {
    const user = await this.getPlanningUser(userId);
    const measuredAt = dto.measuredAt ? new Date(dto.measuredAt) : new Date();

    if (Number.isNaN(measuredAt.getTime())) {
      throw new BadRequestException('Measured time is invalid.');
    }

    const weightKg = this.normalizeWeightKg(dto.weight, dto.unit);
    const localDate = dto.localDate ?? this.getLocalDate(measuredAt, user.timezone);
    const note = dto.note?.trim() ? dto.note.trim() : null;

    const saved = await this.prisma.$transaction(async (tx) => {
      const log = await tx.weightLog.upsert({
        where: {
          userId_localDate_source: {
            userId,
            localDate,
            source: WeightDataSource.MANUAL
          }
        },
        update: {
          measuredAt,
          weightKg,
          note
        },
        create: {
          userId,
          localDate,
          measuredAt,
          weightKg,
          source: WeightDataSource.MANUAL,
          note
        }
      });

      if (user.profile) {
        await tx.profile.update({
          where: { userId },
          data: { weightKg }
        });
      }

      return log;
    });

    return this.toLogResponse(saved);
  }

  private async getPlanningUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        timezone: true,
        isMinor: true,
        safeMode: true,
        profile: { select: { weightKg: true, pregnancyStatus: true } },
        goal: { select: { primaryGoal: true, targetWeightKg: true } }
      }
    });

    if (!user) {
      throw new UnauthorizedException('Your session is no longer valid. Please log in again.');
    }

    return user;
  }

  private normalizeWeightKg(weight: number, unit: WeightUnitDto) {
    if (!Number.isFinite(weight)) {
      throw new BadRequestException('Weight must be a valid number.');
    }

    const weightKg = unit === WeightUnitDto.LB ? weight * KG_PER_LB : weight;

    if (weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG) {
      throw new BadRequestException('Weight must be within a realistic wellness range.');
    }

    return round(weightKg, 2);
  }

  private resolveDirection(
    primaryGoal: PrimaryGoal | null,
    startingWeightKg: number | null,
    currentWeightKg: number | null,
    targetWeightKg: number | null
  ) {
    if (primaryGoal === PrimaryGoal.WEIGHT_LOSS) return 'LOSS' as const;
    if (primaryGoal === PrimaryGoal.WEIGHT_GAIN) return 'GAIN' as const;
    if (primaryGoal === PrimaryGoal.WEIGHT_MAINTENANCE) return 'MAINTAIN' as const;
    if (startingWeightKg === null || currentWeightKg === null || targetWeightKg === null) return 'UNKNOWN' as const;
    if (Math.abs(targetWeightKg - startingWeightKg) < 0.5) return 'MAINTAIN' as const;
    return targetWeightKg < startingWeightKg ? 'LOSS' as const : 'GAIN' as const;
  }

  private resolveProgressPercent(
    direction: 'LOSS' | 'GAIN' | 'MAINTAIN' | 'UNKNOWN',
    startingWeightKg: number | null,
    currentWeightKg: number | null,
    targetWeightKg: number | null
  ) {
    if (direction === 'MAINTAIN') return null;
    if (direction === 'UNKNOWN' || startingWeightKg === null || currentWeightKg === null || targetWeightKg === null) {
      return null;
    }

    const total = Math.abs(startingWeightKg - targetWeightKg);
    if (total < 0.5) return null;

    const completed =
      direction === 'LOSS'
        ? startingWeightKg - currentWeightKg
        : currentWeightKg - startingWeightKg;

    return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
  }

  private resolveSafetyStatus(user: Awaited<ReturnType<WeightService['getPlanningUser']>>) {
    if (!user.profile?.weightKg) return 'NEEDS_MORE_INFO' as const;
    if (user.isMinor || user.safeMode) return 'LIMITED' as const;
    if (
      user.profile.pregnancyStatus === PregnancyStatus.PREGNANT ||
      user.profile.pregnancyStatus === PregnancyStatus.POSTPARTUM ||
      user.profile.pregnancyStatus === PregnancyStatus.BREASTFEEDING
    ) {
      return 'LIMITED' as const;
    }
    return 'OK' as const;
  }

  private getLocalDate(date: Date, timezone: string) {
    const safeTimezone = this.normalizeTimezone(timezone);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  }

  private normalizeTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
      return timezone;
    } catch {
      return 'UTC';
    }
  }

  private toLogResponse(log: {
    id: string;
    localDate: string;
    measuredAt: Date;
    weightKg: unknown;
    source: WeightDataSource;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: log.id,
      localDate: log.localDate,
      measuredAt: log.measuredAt.toISOString(),
      weightKg: Number(log.weightKg),
      source: log.source,
      note: log.note,
      createdAt: log.createdAt.toISOString(),
      updatedAt: log.updatedAt.toISOString()
    };
  }
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
