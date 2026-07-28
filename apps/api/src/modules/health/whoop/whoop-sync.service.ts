import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { HealthConnectionStatus, HealthProvider } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { FeatureAccessService } from '../../entitlements/feature-access.service';
import { WhoopAccessTokenService } from './whoop-access-token.service';
import { WhoopApiClientService } from './whoop-api-client.service';
import type {
  WhoopCycleCollection,
  WhoopRecoveryCollection,
  WhoopSleepCollection,
  WhoopWorkoutCollection
} from './whoop-data.schemas';
import { WhoopError } from './whoop.error';
import type { WhoopCollectionQuery, WhoopDataset, WhoopSyncMetadata } from './whoop.types';

type DatasetValues = {
  cycles: WhoopCycleCollection;
  recovery: WhoopRecoveryCollection;
  sleep: WhoopSleepCollection;
  workouts: WhoopWorkoutCollection;
};

type DatasetResults = {
  [K in WhoopDataset]:
    | { ok: true; value: DatasetValues[K] }
    | { ok: false; error: unknown };
};

type NormalizedWhoopSnapshot = {
  steps: null;
  activeCaloriesKcal: number | null;
  workoutMinutes: number | null;
  sleepMinutes: number | null;
  sleepQualityScore: number | null;
  recoveryScore: number | null;
  strainScore: number | null;
  restingHeartRateBpm: number | null;
  hrvMs: number | null;
  respiratoryRate: number | null;
};

const DATASETS: WhoopDataset[] = ['cycles', 'recovery', 'sleep', 'workouts'];

@Injectable()
export class WhoopSyncService {
  private readonly logger = new Logger(WhoopSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureAccess: FeatureAccessService,
    private readonly accessTokens: WhoopAccessTokenService,
    private readonly api: WhoopApiClientService
  ) {}

  async syncToday(userId: string) {
    await this.assertPro(userId);
    const timezone = await this.getUserTimezone(userId);
    const localDate = this.getLocalDate(new Date(), timezone);
    const now = new Date();
    const query: WhoopCollectionQuery = {
      start: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
      end: now.toISOString(),
      limit: 25
    };
    let token = await this.accessTokens.getAccessToken(userId);
    let results = await this.readDatasets(token.accessToken, query);

    if (this.hasAuthorizationFailure(results)) {
      this.logger.log('WHOOP data authorization expired; refreshing once');
      token = await this.accessTokens.getAccessToken(userId, true);
      results = await this.readDatasets(token.accessToken, query);
    }

    const available = DATASETS.filter((dataset) => results[dataset].ok);
    const unavailable = DATASETS.filter((dataset) => !results[dataset].ok);
    const sync: WhoopSyncMetadata = {
      partial: unavailable.length > 0,
      refreshedToken: token.refreshed,
      datasetsAvailable: available,
      datasetsUnavailable: unavailable
    };

    if (available.length === 0) {
      const firstError = (results[unavailable[0]] as { ok: false; error: unknown }).error;
      await this.markSyncFailure(userId, firstError);
      throw firstError;
    }

    const normalized = this.normalize(results, localDate, timezone);
    const fieldsPresent = this.countPresentFields(normalized);

    if (fieldsPresent === 0) {
      await this.markConnected(userId, now);
      this.logger.log(
        `WHOOP foreground sync completed; localDate=${localDate}; fieldsPresent=0; partial=${sync.partial}`
      );
      return {
        snapshot: null,
        hasRecentData: false,
        messageCode: 'NO_WEARABLE_DATA' as const,
        sync
      };
    }

    const saved = await this.prisma.$transaction(async (prisma) => {
      const snapshot = await prisma.wearableDailySnapshot.upsert({
        where: {
          userId_source_localDate: {
            userId,
            source: HealthProvider.WHOOP,
            localDate
          }
        },
        update: {
          timezone,
          ...normalized,
          capturedAt: now
        },
        create: {
          userId,
          source: HealthProvider.WHOOP,
          localDate,
          timezone,
          ...normalized,
          capturedAt: now
        }
      });

      await prisma.healthConnection.upsert({
        where: { userId_provider: { userId, provider: HealthProvider.WHOOP } },
        update: {
          status: HealthConnectionStatus.CONNECTED,
          disconnectedAt: null,
          lastSyncAt: now,
          errorReason: null
        },
        create: {
          userId,
          provider: HealthProvider.WHOOP,
          status: HealthConnectionStatus.CONNECTED,
          consentedAt: now,
          lastSyncAt: now
        }
      });

      return snapshot;
    });

    this.logger.log(
      `WHOOP foreground sync completed; localDate=${localDate}; fieldsPresent=${fieldsPresent}; partial=${sync.partial}`
    );

    return {
      snapshot: {
        id: saved.id,
        userId: saved.userId,
        localDate: saved.localDate,
        timezone: saved.timezone,
        source: saved.source,
        steps: saved.steps,
        activeCaloriesKcal: saved.activeCaloriesKcal,
        workoutMinutes: saved.workoutMinutes,
        sleepMinutes: saved.sleepMinutes,
        sleepQualityScore: saved.sleepQualityScore,
        recoveryScore: saved.recoveryScore,
        strainScore: saved.strainScore,
        restingHeartRateBpm: saved.restingHeartRateBpm,
        hrvMs: saved.hrvMs,
        respiratoryRate: saved.respiratoryRate,
        capturedAt: saved.capturedAt.toISOString(),
        isStale: false
      },
      hasRecentData: true,
      messageCode: 'WEARABLE_DATA_CONNECTED' as const,
      sync
    };
  }

  private async readDatasets(
    accessToken: string,
    query: WhoopCollectionQuery
  ): Promise<DatasetResults> {
    const settled = await Promise.allSettled([
      this.api.getCycles(accessToken, query),
      this.api.getRecovery(accessToken, query),
      this.api.getSleep(accessToken, query),
      this.api.getWorkouts(accessToken, query)
    ]);

    return {
      cycles: this.toResult(settled[0]),
      recovery: this.toResult(settled[1]),
      sleep: this.toResult(settled[2]),
      workouts: this.toResult(settled[3])
    };
  }

  private toResult<T>(result: PromiseSettledResult<T>) {
    return result.status === 'fulfilled'
      ? { ok: true as const, value: result.value }
      : { ok: false as const, error: result.reason };
  }

  private hasAuthorizationFailure(results: DatasetResults) {
    return DATASETS.some((dataset) => {
      const result = results[dataset];
      return !result.ok
        && result.error instanceof WhoopError
        && result.error.code === 'WHOOP_REAUTH_REQUIRED';
    });
  }

  private normalize(
    results: DatasetResults,
    localDate: string,
    timezone: string
  ): NormalizedWhoopSnapshot {
    const cycle = results.cycles.ok
      ? this.latest(
          results.cycles.value.records.filter((record) =>
            this.getLocalDate(new Date(record.start), timezone) === localDate
            || (record.end
              ? this.getLocalDate(new Date(record.end), timezone) === localDate
              : false)
          ),
          (record) => record.start
        )
      : undefined;
    const recovery = results.recovery.ok
      ? this.latest(
          results.recovery.value.records.filter((record) =>
            cycle
              ? record.cycle_id === cycle.id
              : this.getLocalDate(
                  new Date(record.created_at),
                  timezone
                ) === localDate
          ),
          (record) => record.created_at
        )
      : undefined;
    const sleep = results.sleep.ok
      ? this.latest(
          results.sleep.value.records.filter(
            (record) =>
              !record.nap && this.getLocalDate(new Date(record.end), timezone) === localDate
          ),
          (record) => record.end
        )
      : undefined;
    const workouts = results.workouts.ok
      ? results.workouts.value.records.filter(
          (record) => this.getLocalDate(new Date(record.start), timezone) === localDate
        )
      : [];
    const sleepStages = sleep?.score?.stage_summary;
    const sleepMillis = sleepStages
      ? sleepStages.total_light_sleep_time_milli
        + sleepStages.total_slow_wave_sleep_time_milli
        + sleepStages.total_rem_sleep_time_milli
      : null;
    const workoutMinutes = workouts.length > 0
      ? Math.round(
          workouts.reduce(
            (total, workout) =>
              total + Math.max(0, new Date(workout.end).getTime() - new Date(workout.start).getTime()),
            0
          ) / 60_000
        )
      : null;
    const workoutKilojoules = workouts
      .map((workout) => workout.score?.kilojoule)
      .filter((value): value is number => typeof value === 'number');

    const scoredRecovery =
      recovery?.score_state === 'SCORED' &&
      recovery.score &&
      !recovery.score.user_calibrating
        ? recovery.score
        : null;

    return {
      steps: null,
      activeCaloriesKcal: workoutKilojoules.length > 0
        ? Math.round(workoutKilojoules.reduce((total, value) => total + value, 0) / 4.184)
        : null,
      workoutMinutes,
      sleepMinutes: sleepMillis === null ? null : Math.round(sleepMillis / 60_000),
      sleepQualityScore: this.roundBounded(sleep?.score?.sleep_performance_percentage, 0, 100),
      recoveryScore: this.roundBounded(
        scoredRecovery?.recovery_score,
        0,
        100
      ),
      strainScore: this.bounded(cycle?.score?.strain, 0, 21),
      restingHeartRateBpm: this.roundBounded(
        scoredRecovery?.resting_heart_rate,
        20,
        250
      ),
      hrvMs: this.roundBounded(scoredRecovery?.hrv_rmssd_milli, 0, 1000),
      respiratoryRate: this.bounded(sleep?.score?.respiratory_rate, 1, 80)
    };
  }

  private latest<T>(records: T[], getDate: (record: T) => string) {
    return [...records].sort(
      (left, right) => new Date(getDate(right)).getTime() - new Date(getDate(left)).getTime()
    )[0];
  }

  private bounded(value: number | null | undefined, min: number, max: number) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return Math.min(max, Math.max(min, value));
  }

  private roundBounded(value: number | null | undefined, min: number, max: number) {
    const bounded = this.bounded(value, min, max);
    return bounded === null ? null : Math.round(bounded);
  }

  private countPresentFields(snapshot: NormalizedWhoopSnapshot) {
    return Object.values(snapshot).filter((value) => value !== null).length;
  }

  private async getUserTimezone(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true }
    });

    return user?.timezone ?? 'UTC';
  }

  private getLocalDate(date: Date, timezone: string) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  private async markConnected(userId: string, now: Date) {
    await this.prisma.healthConnection.upsert({
      where: { userId_provider: { userId, provider: HealthProvider.WHOOP } },
      update: {
        status: HealthConnectionStatus.CONNECTED,
        lastSyncAt: now,
        errorReason: null
      },
      create: {
        userId,
        provider: HealthProvider.WHOOP,
        status: HealthConnectionStatus.CONNECTED,
        consentedAt: now,
        lastSyncAt: now
      }
    });
  }

  private async markSyncFailure(userId: string, error: unknown) {
    const code = error instanceof WhoopError ? error.code : 'WHOOP_DATA_REQUEST_FAILED';
    const status =
      code === 'WHOOP_REAUTH_REQUIRED'
        ? HealthConnectionStatus.NEEDS_REAUTH
        : HealthConnectionStatus.ERROR;

    await this.prisma.healthConnection.upsert({
      where: { userId_provider: { userId, provider: HealthProvider.WHOOP } },
      update: { status, errorReason: code },
      create: { userId, provider: HealthProvider.WHOOP, status, errorReason: code }
    });
    this.logger.warn(`WHOOP foreground sync failed; reason=${code}`);
  }

  private async assertPro(userId: string) {
    if (!(await this.featureAccess.canUseWhoop(userId))) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'WHOOP_PRO_REQUIRED',
        message: 'WHOOP integration requires a Pro plan.'
      });
    }
  }
}
