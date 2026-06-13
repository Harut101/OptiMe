import { BadRequestException, Injectable } from '@nestjs/common';
import { HealthConnectionStatus, HealthProvider, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ConnectHealthDto } from './dto/connect-health.dto';
import { DeleteHealthDataDto } from './dto/delete-health-data.dto';
import { DisconnectHealthDto } from './dto/disconnect-health.dto';
import { HealthPermissionsDto } from './dto/health-permissions.dto';
import { UpsertHealthDailySummaryDto } from './dto/upsert-health-daily-summary.dto';

const HEALTH_PROVIDERS = [HealthProvider.APPLE_HEALTH, HealthProvider.HEALTH_CONNECT] as const;

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
}
