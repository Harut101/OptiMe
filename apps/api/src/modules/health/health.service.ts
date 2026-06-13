import { BadRequestException, Injectable } from '@nestjs/common';
import { HealthConnectionStatus, HealthProvider, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ConnectHealthDto } from './dto/connect-health.dto';
import { DeleteHealthDataDto } from './dto/delete-health-data.dto';
import { DisconnectHealthDto } from './dto/disconnect-health.dto';
import { HealthPermissionsDto } from './dto/health-permissions.dto';
import { UpsertHealthDailySummaryDto } from './dto/upsert-health-daily-summary.dto';
import { EMPTY_HEALTH_PLANNING_CONTEXT, HealthPlanningContext } from './health-planning.types';

const HEALTH_PROVIDERS = [HealthProvider.APPLE_HEALTH, HealthProvider.HEALTH_CONNECT] as const;
const LOW_SLEEP_MINUTES_THRESHOLD = 360;
const HIGH_ACTIVITY_STEPS_THRESHOLD = 12000;
const HIGH_ACTIVITY_WORKOUT_MINUTES_THRESHOLD = 60;
const HIGH_ACTIVITY_ACTIVE_ENERGY_KCAL_THRESHOLD = 900;
const LOW_STEP_TREND_THRESHOLD = 3000;
const LOW_STEP_TREND_MIN_DAYS = 3;

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string) {
    const connections = await this.prisma.healthConnection.findMany({
      where: { userId }
    });
    const byProvider = new Map(connections.map((connection) => [connection.provider, connection]));

    return {
      connections: HEALTH_PROVIDERS.map((provider) =>
        this.toConnectionResponse(
          byProvider.get(provider) ?? {
            provider,
            status: HealthConnectionStatus.DISCONNECTED,
            consentedAt: null,
            disconnectedAt: null,
            lastSyncAt: null,
            permissionsGranted: null,
            errorReason: null
          }
        )
      )
    };
  }

  async connect(userId: string, dto: ConnectHealthDto) {
    const connected = await this.prisma.healthConnection.upsert({
      where: {
        userId_provider: {
          userId,
          provider: dto.provider
        }
      },
      update: {
        status: HealthConnectionStatus.CONNECTED,
        consentedAt: new Date(),
        disconnectedAt: null,
        permissionsGranted: this.permissionsToJson(dto.permissionsGranted),
        errorReason: null
      },
      create: {
        userId,
        provider: dto.provider,
        status: HealthConnectionStatus.CONNECTED,
        consentedAt: new Date(),
        permissionsGranted: this.permissionsToJson(dto.permissionsGranted)
      }
    });

    return this.toConnectionResponse(connected);
  }

  async disconnect(userId: string, dto: DisconnectHealthDto) {
    const disconnected = await this.prisma.healthConnection.upsert({
      where: {
        userId_provider: {
          userId,
          provider: dto.provider
        }
      },
      update: {
        status: HealthConnectionStatus.DISCONNECTED,
        disconnectedAt: new Date(),
        errorReason: null
      },
      create: {
        userId,
        provider: dto.provider,
        status: HealthConnectionStatus.DISCONNECTED,
        disconnectedAt: new Date()
      }
    });

    return this.toConnectionResponse(disconnected);
  }

  async deleteData(userId: string, dto: DeleteHealthDataDto) {
    const where = {
      userId,
      ...(dto.provider ? { sourceProvider: dto.provider } : {})
    };
    const deleted = await this.prisma.healthDailySummary.deleteMany({ where });

    await this.prisma.healthConnection.updateMany({
      where: {
        userId,
        ...(dto.provider ? { provider: dto.provider } : {})
      },
      data: {
        lastSyncAt: null
      }
    });

    return {
      deleted: true,
      provider: dto.provider ?? null,
      summaryCountDeleted: deleted.count
    };
  }

  async getDailySummary(userId: string, localDate: string) {
    const summaries = await this.prisma.healthDailySummary.findMany({
      where: {
        userId,
        localDate
      },
      orderBy: {
        sourceProvider: 'asc'
      }
    });

    return {
      localDate,
      summaries: summaries.map((summary) => this.toSummaryResponse(summary))
    };
  }

  async upsertDailySummary(userId: string, dto: UpsertHealthDailySummaryDto) {
    await this.assertConnectedProvider(userId, dto.sourceProvider);

    const saved = await this.prisma.healthDailySummary.upsert({
      where: {
        userId_localDate_sourceProvider: {
          userId,
          localDate: dto.localDate,
          sourceProvider: dto.sourceProvider
        }
      },
      update: this.toSummaryWriteData(dto),
      create: {
        userId,
        ...this.toSummaryWriteData(dto)
      }
    });

    await this.prisma.healthConnection.update({
      where: {
        userId_provider: {
          userId,
          provider: dto.sourceProvider
        }
      },
      data: {
        lastSyncAt: new Date(),
        errorReason: null
      }
    });

    return {
      summary: this.toSummaryResponse(saved)
    };
  }

  async getRecentHealthSummariesForPlanning(
    userId: string,
    options: { planLocalDate: string; days?: number }
  ): Promise<HealthPlanningContext> {
    const days = Math.max(1, Math.min(options.days ?? 7, 7));
    const localDates = this.getRecentLocalDates(options.planLocalDate, days);
    const summaries = await this.prisma.healthDailySummary.findMany({
      where: {
        userId,
        localDate: {
          in: localDates
        }
      },
      orderBy: [{ localDate: 'desc' }, { updatedAt: 'desc' }]
    });

    if (summaries.length === 0) {
      return EMPTY_HEALTH_PLANNING_CONTEXT;
    }

    const byDate = new Map<string, (typeof summaries)[number]>();
    for (const summary of summaries) {
      if (!byDate.has(summary.localDate)) {
        byDate.set(summary.localDate, summary);
      }
    }

    const summariesByDate = localDates
      .map((localDate) => byDate.get(localDate))
      .filter((summary): summary is (typeof summaries)[number] => Boolean(summary));
    const latestSummary = summariesByDate[0];
    const yesterdaySummary = byDate.get(localDates[0]);
    const recentTwoDaySummaries = localDates
      .slice(0, 2)
      .map((localDate) => byDate.get(localDate))
      .filter((summary): summary is (typeof summaries)[number] => Boolean(summary));
    const recentAverages = this.getRecentAverages(summariesByDate);
    const stepDays = summariesByDate.filter((summary) => summary.steps !== null);
    const signals = {
      lowSleep: (yesterdaySummary?.sleepMinutes ?? Number.POSITIVE_INFINITY) < LOW_SLEEP_MINUTES_THRESHOLD,
      highActivityYesterday: Boolean(
        (yesterdaySummary?.steps ?? 0) > HIGH_ACTIVITY_STEPS_THRESHOLD ||
          (yesterdaySummary?.workoutMinutes ?? 0) > HIGH_ACTIVITY_WORKOUT_MINUTES_THRESHOLD ||
          (yesterdaySummary?.activeEnergyKcal ?? 0) > HIGH_ACTIVITY_ACTIVE_ENERGY_KCAL_THRESHOLD
      ),
      recentWorkout: recentTwoDaySummaries
        .some((summary) => (summary.workoutCount ?? 0) > 0 || (summary.workoutMinutes ?? 0) > 0),
      lowStepTrend:
        stepDays.length >= LOW_STEP_TREND_MIN_DAYS &&
        (recentAverages.steps ?? Number.POSITIVE_INFINITY) < LOW_STEP_TREND_THRESHOLD
    };

    return {
      available: true,
      daysReviewed: summariesByDate.length,
      latestSummary: latestSummary ? this.toPlanningSummary(latestSummary) : undefined,
      recentAverages,
      signals,
      selectionNotes: this.getHealthSelectionNotes(signals)
    };
  }

  private async assertConnectedProvider(userId: string, provider: HealthProvider) {
    const connection = await this.prisma.healthConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider
        }
      }
    });

    if (!connection || connection.status !== HealthConnectionStatus.CONNECTED) {
      throw new BadRequestException({
        code: 'HEALTH_PROVIDER_NOT_CONNECTED',
        message: 'Connect this health provider before syncing health summaries.'
      });
    }
  }

  private toSummaryWriteData(dto: UpsertHealthDailySummaryDto) {
    return {
      localDate: dto.localDate,
      timezone: dto.timezone,
      sourceProvider: dto.sourceProvider,
      steps: dto.steps ?? null,
      sleepMinutes: dto.sleepMinutes ?? null,
      activeEnergyKcal: dto.activeEnergyKcal ?? null,
      workoutCount: dto.workoutCount ?? null,
      workoutMinutes: dto.workoutMinutes ?? null,
      averageHeartRate: dto.averageHeartRate ?? null,
      restingHeartRate: dto.restingHeartRate ?? null,
      weightKg: dto.weightKg === undefined ? null : new Prisma.Decimal(dto.weightKg)
    };
  }

  private toConnectionResponse(connection: {
    provider: HealthProvider;
    status: HealthConnectionStatus;
    consentedAt: Date | null;
    disconnectedAt: Date | null;
    lastSyncAt: Date | null;
    permissionsGranted: Prisma.JsonValue | null;
    errorReason: string | null;
  }) {
    return {
      provider: connection.provider,
      status: connection.status,
      consentedAt: connection.consentedAt?.toISOString() ?? null,
      disconnectedAt: connection.disconnectedAt?.toISOString() ?? null,
      lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
      permissionsGranted: connection.permissionsGranted,
      errorReason: connection.errorReason
    };
  }

  private toSummaryResponse(summary: {
    localDate: string;
    timezone: string;
    sourceProvider: HealthProvider;
    steps: number | null;
    sleepMinutes: number | null;
    activeEnergyKcal: number | null;
    workoutCount: number | null;
    workoutMinutes: number | null;
    averageHeartRate: number | null;
    restingHeartRate: number | null;
    weightKg: Prisma.Decimal | number | string | null;
    updatedAt: Date;
  }) {
    return {
      localDate: summary.localDate,
      timezone: summary.timezone,
      sourceProvider: summary.sourceProvider,
      steps: summary.steps,
      sleepMinutes: summary.sleepMinutes,
      activeEnergyKcal: summary.activeEnergyKcal,
      workoutCount: summary.workoutCount,
      workoutMinutes: summary.workoutMinutes,
      averageHeartRate: summary.averageHeartRate,
      restingHeartRate: summary.restingHeartRate,
      weightKg: this.decimalToNumber(summary.weightKg),
      updatedAt: summary.updatedAt.toISOString()
    };
  }

  private permissionsToJson(
    permissions?: HealthPermissionsDto
  ): Prisma.InputJsonObject | typeof Prisma.JsonNull {
    if (!permissions) {
      return Prisma.JsonNull;
    }

    return Object.fromEntries(
      Object.entries(permissions).filter(([, value]) => value !== undefined)
    ) as Prisma.InputJsonObject;
  }

  private decimalToNumber(value: Prisma.Decimal | number | string | null) {
    if (value === null) {
      return null;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      return Number(value);
    }

    return value.toNumber();
  }

  private getRecentLocalDates(planLocalDate: string, days: number) {
    const [year, month, day] = planLocalDate.split('-').map(Number);
    const anchor = new Date(Date.UTC(year, month - 1, day));

    return Array.from({ length: days }, (_, index) => {
      const date = new Date(anchor);
      date.setUTCDate(anchor.getUTCDate() - (index + 1));
      return date.toISOString().slice(0, 10);
    });
  }

  private getRecentAverages(
    summaries: Array<{
      steps: number | null;
      sleepMinutes: number | null;
      activeEnergyKcal: number | null;
      workoutMinutes: number | null;
    }>
  ) {
    return {
      steps: this.averageNullable(summaries.map((summary) => summary.steps)),
      sleepMinutes: this.averageNullable(summaries.map((summary) => summary.sleepMinutes)),
      activeEnergyKcal: this.averageNullable(summaries.map((summary) => summary.activeEnergyKcal)),
      workoutMinutes: this.averageNullable(summaries.map((summary) => summary.workoutMinutes))
    };
  }

  private averageNullable(values: Array<number | null>) {
    const present = values.filter((value): value is number => value !== null);
    if (present.length === 0) {
      return undefined;
    }

    return Math.round(present.reduce((sum, value) => sum + value, 0) / present.length);
  }

  private toPlanningSummary(summary: {
    localDate: string;
    steps: number | null;
    sleepMinutes: number | null;
    activeEnergyKcal: number | null;
    workoutCount: number | null;
    workoutMinutes: number | null;
  }) {
    return {
      localDate: summary.localDate,
      ...(summary.steps !== null ? { steps: summary.steps } : {}),
      ...(summary.sleepMinutes !== null ? { sleepMinutes: summary.sleepMinutes } : {}),
      ...(summary.activeEnergyKcal !== null
        ? { activeEnergyKcal: summary.activeEnergyKcal }
        : {}),
      ...(summary.workoutCount !== null ? { workoutCount: summary.workoutCount } : {}),
      ...(summary.workoutMinutes !== null ? { workoutMinutes: summary.workoutMinutes } : {})
    };
  }

  private getHealthSelectionNotes(signals: HealthPlanningContext['signals']) {
    const notes: string[] = [];

    if (signals.lowSleep) {
      notes.push('Low sleep summary suggests recovery-oriented planning.');
    }

    if (signals.highActivityYesterday) {
      notes.push('High activity yesterday suggests avoiding compounded training load.');
    }

    if (signals.recentWorkout) {
      notes.push('Recent workout summary suggests conservative repeated-load decisions.');
    }

    if (signals.lowStepTrend) {
      notes.push('Low step trend suggests gentle movement encouragement without shame.');
    }

    return notes;
  }
}
