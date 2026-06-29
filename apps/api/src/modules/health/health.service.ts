import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HealthConnectionStatus, HealthProvider, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ConnectHealthDto } from './dto/connect-health.dto';
import { DeleteHealthDataDto } from './dto/delete-health-data.dto';
import { DisconnectHealthDto } from './dto/disconnect-health.dto';
import { CreateMockWearableSnapshotDto } from './dto/create-mock-wearable-snapshot.dto';
import { HealthPermissionsDto } from './dto/health-permissions.dto';
import { UpdateHealthConnectionStatusDto } from './dto/update-health-connection-status.dto';
import { UpsertHealthDailySummaryDto } from './dto/upsert-health-daily-summary.dto';
import { UpsertWearableSnapshotDto } from './dto/upsert-wearable-snapshot.dto';
import {
  EMPTY_HEALTH_PLANNING_CONTEXT,
  HealthPlanningContext
} from './health-planning.types';
import { TrainingLoadContextResolver } from './training-load-context.resolver';
import { WearablePlanningContextResolver } from './wearable-planning-context.resolver';

const HEALTH_PROVIDERS = [HealthProvider.APPLE_HEALTH, HealthProvider.HEALTH_CONNECT] as const;
const HEALTH_SOURCES = [
  HealthProvider.APPLE_HEALTH,
  HealthProvider.HEALTH_CONNECT,
  HealthProvider.WHOOP,
  HealthProvider.MANUAL,
  HealthProvider.MOCK
] as const;
const SNAPSHOT_STALE_HOURS = 36;
const LOW_SLEEP_MINUTES_THRESHOLD = 360;
const HIGH_ACTIVITY_STEPS_THRESHOLD = 12000;
const HIGH_ACTIVITY_WORKOUT_MINUTES_THRESHOLD = 60;
const HIGH_ACTIVITY_ACTIVE_ENERGY_KCAL_THRESHOLD = 900;
const LOW_STEP_TREND_THRESHOLD = 3000;
const LOW_STEP_TREND_MIN_DAYS = 3;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wearablePlanningContextResolver: WearablePlanningContextResolver,
    private readonly trainingLoadContextResolver: TrainingLoadContextResolver
  ) {}

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

  async getConnections(userId: string) {
    const connections = await this.prisma.healthConnection.findMany({
      where: { userId }
    });
    const byProvider = new Map(connections.map((connection) => [connection.provider, connection]));

    return {
      connections: HEALTH_SOURCES.map((source) =>
        this.toFoundationConnectionResponse(byProvider.get(source), source)
      )
    };
  }

  async updateConnectionStatus(
    userId: string,
    source: HealthProvider,
    dto: UpdateHealthConnectionStatusDto
  ) {
    const now = new Date();
    const status = this.toPersistedConnectionStatus(dto.status);
    const connection = await this.prisma.healthConnection.upsert({
      where: {
        userId_provider: {
          userId,
          provider: source
        }
      },
      update: {
        status,
        ...(status === HealthConnectionStatus.CONNECTED
          ? { consentedAt: now, disconnectedAt: null }
          : {}),
        ...(status === HealthConnectionStatus.DISCONNECTED
          ? { disconnectedAt: now }
          : {}),
        errorReason: dto.errorCode ?? null
      },
      create: {
        userId,
        provider: source,
        status,
        consentedAt: status === HealthConnectionStatus.CONNECTED ? now : null,
        disconnectedAt:
          status === HealthConnectionStatus.DISCONNECTED
            ? now
            : null,
        errorReason: dto.errorCode ?? null
      }
    });

    this.logger.log(`health connection status updated; source=${source}; status=${this.toWearableStatus(status)}`);
    return this.toFoundationConnectionResponse(connection, source);
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
    const snapshotDeleted = await this.prisma.wearableDailySnapshot.deleteMany({
      where: {
        userId,
        ...(dto.provider ? { source: dto.provider } : {})
      }
    });

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
      summaryCountDeleted: deleted.count + snapshotDeleted.count
    };
  }

  async getTodayWearableSnapshot(userId: string) {
    const timezone = await this.getUserTimezone(userId);
    return this.getWearableSnapshotByDate(userId, this.getLocalDate(timezone), timezone);
  }

  async getWearableSnapshotByDate(userId: string, localDate: string, timezone?: string) {
    const resolvedTimezone = timezone ?? await this.getUserTimezone(userId);
    const snapshot = await this.prisma.wearableDailySnapshot.findFirst({
      where: {
        userId,
        localDate
      },
      orderBy: [
        { capturedAt: 'desc' },
        { updatedAt: 'desc' }
      ]
    });

    if (!snapshot) {
      return {
        snapshot: null,
        hasRecentData: false,
        messageCode: 'NO_WEARABLE_DATA' as const
      };
    }

    const response = this.toWearableSnapshotResponse(snapshot, resolvedTimezone);
    return {
      snapshot: response,
      hasRecentData: !response.isStale,
      messageCode: response.isStale ? 'WEARABLE_DATA_STALE' as const : 'WEARABLE_DATA_CONNECTED' as const
    };
  }

  async createMockWearableSnapshot(
    userId: string,
    dto: CreateMockWearableSnapshotDto
  ) {
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_MOCK_HEALTH_DATA !== 'true') {
      throw new NotFoundException('Mock health data is not available.');
    }

    const source = dto.source ?? HealthProvider.MOCK;
    const userTimezone = await this.getUserTimezone(userId);
    const timezone = dto.timezone ?? userTimezone;
    const localDate = dto.localDate ?? this.getLocalDate(timezone);
    const capturedAt = dto.capturedAt ? new Date(dto.capturedAt) : new Date();
    const saved = await this.prisma.wearableDailySnapshot.upsert({
      where: {
        userId_source_localDate: {
          userId,
          source,
          localDate
        }
      },
      update: this.toWearableSnapshotWriteData(dto, localDate, timezone, capturedAt, source),
      create: {
        userId,
        ...this.toWearableSnapshotWriteData(dto, localDate, timezone, capturedAt, source)
      }
    });

    await this.prisma.healthConnection.upsert({
      where: { userId_provider: { userId, provider: source } },
      update: {
        status: HealthConnectionStatus.CONNECTED,
        consentedAt: new Date(),
        disconnectedAt: null,
        lastSyncAt: new Date(),
        errorReason: null
      },
      create: {
        userId,
        provider: source,
        status: HealthConnectionStatus.CONNECTED,
        consentedAt: new Date(),
        lastSyncAt: new Date()
      }
    });

    this.logger.log(`wearable snapshot created; source=${source}; localDate=${localDate}; stale=${this.isSnapshotStale(saved.capturedAt, saved.localDate, timezone)}`);

    return {
      snapshot: this.toWearableSnapshotResponse(saved, timezone),
      hasRecentData: !this.isSnapshotStale(saved.capturedAt, saved.localDate, timezone),
      messageCode: this.isSnapshotStale(saved.capturedAt, saved.localDate, timezone)
        ? 'WEARABLE_DATA_STALE' as const
        : 'WEARABLE_DATA_CONNECTED' as const
    };
  }

  async upsertWearableSnapshot(userId: string, dto: UpsertWearableSnapshotDto) {
    const capturedAt = dto.capturedAt ? new Date(dto.capturedAt) : new Date();
    const saved = await this.prisma.wearableDailySnapshot.upsert({
      where: {
        userId_source_localDate: {
          userId,
          source: dto.source,
          localDate: dto.localDate
        }
      },
      update: this.toWearableSnapshotWriteData(
        dto,
        dto.localDate,
        dto.timezone,
        capturedAt,
        dto.source
      ),
      create: {
        userId,
        ...this.toWearableSnapshotWriteData(
          dto,
          dto.localDate,
          dto.timezone,
          capturedAt,
          dto.source
        )
      }
    });

    await this.prisma.healthConnection.upsert({
      where: { userId_provider: { userId, provider: dto.source } },
      update: {
        status: HealthConnectionStatus.CONNECTED,
        consentedAt: new Date(),
        disconnectedAt: null,
        lastSyncAt: new Date(),
        errorReason: null
      },
      create: {
        userId,
        provider: dto.source,
        status: HealthConnectionStatus.CONNECTED,
        consentedAt: new Date(),
        lastSyncAt: new Date()
      }
    });

    this.logger.log(
      `wearable snapshot synced; source=${dto.source}; localDate=${dto.localDate}; fieldsPresent=${this.countPresentWearableFields(dto)}; stale=${this.isSnapshotStale(saved.capturedAt, saved.localDate, dto.timezone)}`
    );

    return {
      snapshot: this.toWearableSnapshotResponse(saved, dto.timezone),
      hasRecentData: !this.isSnapshotStale(saved.capturedAt, saved.localDate, dto.timezone),
      messageCode: this.isSnapshotStale(saved.capturedAt, saved.localDate, dto.timezone)
        ? 'WEARABLE_DATA_STALE' as const
        : 'WEARABLE_DATA_CONNECTED' as const
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
    const wearableSnapshot = await this.prisma.wearableDailySnapshot.findFirst({
      where: {
        userId,
        localDate: options.planLocalDate
      },
      orderBy: [
        { capturedAt: 'desc' },
        { updatedAt: 'desc' }
      ]
    });
    const wearableContext = wearableSnapshot
      ? this.toWearablePlanningContext(wearableSnapshot, options.planLocalDate)
      : undefined;
    const wearablePlanningContext = wearableSnapshot
      ? this.wearablePlanningContextResolver.resolve(wearableSnapshot, {
          isStale: wearableContext?.isStale ?? true
        })
      : EMPTY_HEALTH_PLANNING_CONTEXT.wearablePlanningContext;
    const trainingLoadContext = this.trainingLoadContextResolver.resolve(wearablePlanningContext);
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
      return wearableContext
        ? {
            ...EMPTY_HEALTH_PLANNING_CONTEXT,
            available: true,
            daysReviewed: 1,
            wearableContext,
            wearablePlanningContext,
            trainingLoadContext,
            signals: this.mergeWearableSignals(EMPTY_HEALTH_PLANNING_CONTEXT.signals, wearableContext),
            selectionNotes: this.getWearableSelectionNotes(wearableContext)
          }
        : EMPTY_HEALTH_PLANNING_CONTEXT;
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
      wearableContext,
      wearablePlanningContext,
      trainingLoadContext,
      latestSummary: latestSummary ? this.toPlanningSummary(latestSummary) : undefined,
      recentAverages,
      signals: this.mergeWearableSignals(signals, wearableContext),
      selectionNotes: [
        ...this.getHealthSelectionNotes(this.mergeWearableSignals(signals, wearableContext)),
        ...this.getWearableSelectionNotes(wearableContext)
      ]
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

  private toFoundationConnectionResponse(
    connection:
      | {
          id?: string;
          provider: HealthProvider;
          status: HealthConnectionStatus;
          consentedAt: Date | null;
          lastSyncAt: Date | null;
          errorReason: string | null;
          updatedAt?: Date;
        }
      | undefined,
    source: HealthProvider
  ) {
    return {
      id: connection?.id ?? null,
      source,
      status: this.toWearableStatus(connection?.status ?? HealthConnectionStatus.DISCONNECTED),
      connectedAt: connection?.consentedAt?.toISOString() ?? null,
      lastSyncAt: connection?.lastSyncAt?.toISOString() ?? null,
      errorCode: connection?.errorReason ?? null,
      updatedAt: connection?.updatedAt?.toISOString() ?? null
    };
  }

  private toWearableStatus(status: HealthConnectionStatus) {
    if (status === HealthConnectionStatus.CONNECTED) {
      return 'CONNECTED' as const;
    }
    if (status === HealthConnectionStatus.NEEDS_REAUTH || status === HealthConnectionStatus.PERMISSION_DENIED) {
      return 'NEEDS_REAUTH' as const;
    }
    if (status === HealthConnectionStatus.ERROR) {
      return 'ERROR' as const;
    }
    if (status === HealthConnectionStatus.DISABLED) {
      return 'DISABLED' as const;
    }

    return 'NOT_CONNECTED' as const;
  }

  private toPersistedConnectionStatus(status: HealthConnectionStatus) {
    if (status === HealthConnectionStatus.NOT_CONNECTED) {
      return HealthConnectionStatus.DISCONNECTED;
    }

    return status;
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

  private toWearableSnapshotWriteData(
    dto: CreateMockWearableSnapshotDto | UpsertWearableSnapshotDto,
    localDate: string,
    timezone: string,
    capturedAt: Date,
    source: HealthProvider
  ) {
    return {
      source,
      localDate,
      timezone,
      steps: dto.steps ?? null,
      activeCaloriesKcal: dto.activeCaloriesKcal ?? null,
      workoutMinutes: dto.workoutMinutes ?? null,
      sleepMinutes: dto.sleepMinutes ?? null,
      sleepQualityScore: dto.sleepQualityScore ?? null,
      recoveryScore: dto.recoveryScore ?? null,
      strainScore: dto.strainScore ?? null,
      restingHeartRateBpm: dto.restingHeartRateBpm ?? null,
      hrvMs: dto.hrvMs ?? null,
      respiratoryRate: dto.respiratoryRate ?? null,
      capturedAt
    };
  }

  private countPresentWearableFields(dto: CreateMockWearableSnapshotDto | UpsertWearableSnapshotDto) {
    return [
      dto.steps,
      dto.activeCaloriesKcal,
      dto.workoutMinutes,
      dto.sleepMinutes,
      dto.sleepQualityScore,
      dto.recoveryScore,
      dto.strainScore,
      dto.restingHeartRateBpm,
      dto.hrvMs,
      dto.respiratoryRate
    ].filter((value) => value !== undefined && value !== null).length;
  }

  private toWearableSnapshotResponse(snapshot: {
    id: string;
    userId: string;
    localDate: string;
    timezone: string;
    source: HealthProvider;
    steps: number | null;
    activeCaloriesKcal: number | null;
    workoutMinutes: number | null;
    sleepMinutes: number | null;
    sleepQualityScore: number | null;
    recoveryScore: number | null;
    strainScore: number | null;
    restingHeartRateBpm: number | null;
    hrvMs: number | null;
    respiratoryRate: number | null;
    capturedAt: Date;
  }, timezone: string) {
    return {
      id: snapshot.id,
      userId: snapshot.userId,
      localDate: snapshot.localDate,
      timezone: snapshot.timezone,
      source: snapshot.source,
      steps: snapshot.steps,
      activeCaloriesKcal: snapshot.activeCaloriesKcal,
      workoutMinutes: snapshot.workoutMinutes,
      sleepMinutes: snapshot.sleepMinutes,
      sleepQualityScore: snapshot.sleepQualityScore,
      recoveryScore: snapshot.recoveryScore,
      strainScore: snapshot.strainScore,
      restingHeartRateBpm: snapshot.restingHeartRateBpm,
      hrvMs: snapshot.hrvMs,
      respiratoryRate: snapshot.respiratoryRate,
      capturedAt: snapshot.capturedAt.toISOString(),
      isStale: this.isSnapshotStale(snapshot.capturedAt, snapshot.localDate, timezone)
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

  private getLocalDate(timezone: string) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  private async getUserTimezone(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true }
    });

    return user?.timezone ?? 'UTC';
  }

  private isSnapshotStale(capturedAt: Date, localDate: string, timezone: string) {
    const ageHours = (Date.now() - capturedAt.getTime()) / (1000 * 60 * 60);
    return ageHours > SNAPSHOT_STALE_HOURS || localDate < this.getLocalDate(timezone);
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

  private toWearablePlanningContext(
    snapshot: {
      source: HealthProvider;
      localDate: string;
      timezone: string;
      steps: number | null;
      activeCaloriesKcal: number | null;
      workoutMinutes: number | null;
      sleepMinutes: number | null;
      sleepQualityScore: number | null;
      recoveryScore: number | null;
      strainScore: number | null;
      restingHeartRateBpm: number | null;
      hrvMs: number | null;
      respiratoryRate: number | null;
      capturedAt: Date;
    },
    planLocalDate: string
  ): NonNullable<HealthPlanningContext['wearableContext']> {
    const isStale = this.isSnapshotStale(snapshot.capturedAt, snapshot.localDate, snapshot.timezone) ||
      snapshot.localDate !== planLocalDate;

    return {
      source: snapshot.source,
      hasRecentData: !isStale,
      isStale,
      localDate: snapshot.localDate,
      ...(snapshot.steps !== null ? { steps: snapshot.steps } : {}),
      ...(snapshot.activeCaloriesKcal !== null ? { activeCaloriesKcal: snapshot.activeCaloriesKcal } : {}),
      ...(snapshot.workoutMinutes !== null ? { workoutMinutes: snapshot.workoutMinutes } : {}),
      ...(snapshot.sleepMinutes !== null ? { sleepMinutes: snapshot.sleepMinutes } : {}),
      ...(snapshot.sleepQualityScore !== null ? { sleepQualityScore: snapshot.sleepQualityScore } : {}),
      ...(snapshot.recoveryScore !== null ? { recoveryScore: snapshot.recoveryScore } : {}),
      ...(snapshot.strainScore !== null ? { strainScore: snapshot.strainScore } : {}),
      ...(snapshot.restingHeartRateBpm !== null ? { restingHeartRateBpm: snapshot.restingHeartRateBpm } : {}),
      ...(snapshot.hrvMs !== null ? { hrvMs: snapshot.hrvMs } : {}),
      ...(snapshot.respiratoryRate !== null ? { respiratoryRate: snapshot.respiratoryRate } : {})
    };
  }

  private mergeWearableSignals(
    signals: HealthPlanningContext['signals'],
    wearableContext?: HealthPlanningContext['wearableContext']
  ) {
    if (!wearableContext?.hasRecentData) {
      return signals;
    }

    return {
      lowSleep: signals.lowSleep || (wearableContext.sleepMinutes ?? Number.POSITIVE_INFINITY) < LOW_SLEEP_MINUTES_THRESHOLD,
      highActivityYesterday:
        signals.highActivityYesterday ||
        (wearableContext.steps ?? 0) > HIGH_ACTIVITY_STEPS_THRESHOLD ||
        (wearableContext.workoutMinutes ?? 0) > HIGH_ACTIVITY_WORKOUT_MINUTES_THRESHOLD ||
        (wearableContext.activeCaloriesKcal ?? 0) > HIGH_ACTIVITY_ACTIVE_ENERGY_KCAL_THRESHOLD ||
        (wearableContext.strainScore ?? 0) >= 15,
      recentWorkout: signals.recentWorkout || (wearableContext.workoutMinutes ?? 0) > 0,
      lowStepTrend: signals.lowStepTrend
    };
  }

  private getWearableSelectionNotes(wearableContext?: HealthPlanningContext['wearableContext']) {
    if (!wearableContext) {
      return [];
    }

    if (wearableContext.isStale) {
      return ['Wearable snapshot is stale, so planning should not overfit to it.'];
    }

    const notes = ['Recent wearable snapshot can inform recovery-aware planning.'];
    if ((wearableContext.sleepMinutes ?? Number.POSITIVE_INFINITY) < LOW_SLEEP_MINUTES_THRESHOLD) {
      notes.push('Wearable sleep summary suggests a gentler recovery note.');
    }
    if ((wearableContext.recoveryScore ?? 100) < 40) {
      notes.push('Wearable recovery score suggests conservative intensity language.');
    }
    if ((wearableContext.strainScore ?? 0) >= 15) {
      notes.push('Wearable strain summary suggests avoiding compounded training load.');
    }

    return notes;
  }
}
