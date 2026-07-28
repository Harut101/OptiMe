import { ForbiddenException } from '@nestjs/common';
import { HealthProvider } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { FeatureAccessService } from '../../entitlements/feature-access.service';
import type { WhoopAccessTokenService } from './whoop-access-token.service';
import type { WhoopApiClientService } from './whoop-api-client.service';
import { WhoopError } from './whoop.error';
import { WhoopSyncService } from './whoop-sync.service';

describe('WhoopSyncService', () => {
  it('normalizes available metrics and persists a snapshot when one dataset fails', async () => {
    const now = new Date();
    const iso = now.toISOString();
    const dependencies = createDependencies();
    dependencies.api.getCycles.mockResolvedValue({
      records: [{
        id: 1,
        start: iso,
        end: iso,
        score: { strain: 12.4, kilojoule: 1000, average_heart_rate: 110, max_heart_rate: 160 }
      }]
    });
    dependencies.api.getRecovery.mockResolvedValue({
      records: [{
        cycle_id: 1,
        created_at: iso,
        score_state: 'SCORED',
        score: {
          user_calibrating: false,
          recovery_score: 78.4,
          resting_heart_rate: 52.2,
          hrv_rmssd_milli: 67.1
        }
      }]
    });
    dependencies.api.getSleep.mockResolvedValue({
      records: [{
        id: 'sleep-1',
        start: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
        end: iso,
        nap: false,
        score: {
          stage_summary: {
            total_light_sleep_time_milli: 14_400_000,
            total_slow_wave_sleep_time_milli: 7_200_000,
            total_rem_sleep_time_milli: 5_400_000
          },
          sleep_performance_percentage: 83,
          respiratory_rate: 14.2
        }
      }]
    });
    dependencies.api.getWorkouts.mockRejectedValue(new Error('temporary workout failure'));
    const service = createService(dependencies);

    const result = await service.syncToday('user-1');

    expect(result).toMatchObject({
      hasRecentData: true,
      messageCode: 'WEARABLE_DATA_CONNECTED',
      sync: {
        partial: true,
        datasetsUnavailable: ['workouts']
      },
      snapshot: {
        source: HealthProvider.WHOOP,
        recoveryScore: 78,
        strainScore: 12.4,
        sleepMinutes: 450,
        sleepQualityScore: 83,
        restingHeartRateBpm: 52,
        hrvMs: 67,
        respiratoryRate: 14.2,
        workoutMinutes: null
      }
    });
    expect(dependencies.prisma.wearableDailySnapshot.upsert).toHaveBeenCalled();
  });

  it('returns a connected no-data result without inventing metrics', async () => {
    const dependencies = createDependencies();
    dependencies.api.getCycles.mockResolvedValue({ records: [] });
    dependencies.api.getRecovery.mockResolvedValue({ records: [] });
    dependencies.api.getSleep.mockResolvedValue({ records: [] });
    dependencies.api.getWorkouts.mockResolvedValue({ records: [] });
    const result = await createService(dependencies).syncToday('user-1');

    expect(result).toMatchObject({
      snapshot: null,
      hasRecentData: false,
      messageCode: 'NO_WEARABLE_DATA'
    });
    expect(dependencies.prisma.wearableDailySnapshot.upsert).not.toHaveBeenCalled();
    expect(dependencies.prisma.healthConnection.upsert).toHaveBeenCalled();
  });

  it('ignores a recovery score while WHOOP is still calibrating', async () => {
    const now = new Date();
    const iso = now.toISOString();
    const dependencies = createDependencies();
    dependencies.api.getCycles.mockResolvedValue({
      records: [{
        id: 1,
        start: iso,
        end: iso,
        score: {
          strain: 8,
          kilojoule: 500,
          average_heart_rate: 100,
          max_heart_rate: 140
        }
      }]
    });
    dependencies.api.getRecovery.mockResolvedValue({
      records: [{
        cycle_id: 1,
        created_at: iso,
        score_state: 'SCORED',
        score: {
          user_calibrating: true,
          recovery_score: 20,
          resting_heart_rate: 55,
          hrv_rmssd_milli: 60
        }
      }]
    });
    dependencies.api.getSleep.mockResolvedValue({ records: [] });
    dependencies.api.getWorkouts.mockResolvedValue({ records: [] });

    await createService(dependencies).syncToday('user-1');

    expect(
      dependencies.prisma.wearableDailySnapshot.upsert.mock.calls[0][0].create
    ).toMatchObject({
      recoveryScore: null,
      restingHeartRateBpm: null,
      hrvMs: null
    });
  });

  it('uses recovery only from the selected physiological cycle', async () => {
    const now = new Date();
    const iso = now.toISOString();
    const dependencies = createDependencies();
    dependencies.api.getCycles.mockResolvedValue({
      records: [{
        id: 10,
        start: iso,
        end: iso,
        score: {
          strain: 8,
          kilojoule: 500,
          average_heart_rate: 100,
          max_heart_rate: 140
        }
      }]
    });
    dependencies.api.getRecovery.mockResolvedValue({
      records: [
        {
          cycle_id: 99,
          created_at: new Date(now.getTime() + 1_000).toISOString(),
          score_state: 'SCORED',
          score: {
            user_calibrating: false,
            recovery_score: 90,
            resting_heart_rate: 50,
            hrv_rmssd_milli: 80
          }
        },
        {
          cycle_id: 10,
          created_at: iso,
          score_state: 'SCORED',
          score: {
            user_calibrating: false,
            recovery_score: 30,
            resting_heart_rate: 60,
            hrv_rmssd_milli: 40
          }
        }
      ]
    });
    dependencies.api.getSleep.mockResolvedValue({ records: [] });
    dependencies.api.getWorkouts.mockResolvedValue({ records: [] });

    await createService(dependencies).syncToday('user-1');

    expect(
      dependencies.prisma.wearableDailySnapshot.upsert.mock.calls[0][0].create
    ).toMatchObject({
      recoveryScore: 30,
      restingHeartRateBpm: 60,
      hrvMs: 40
    });
  });

  it('blocks foreground sync for a non-Pro user', async () => {
    const dependencies = createDependencies();
    dependencies.featureAccess.canUseWhoop.mockResolvedValue(false);

    await expect(createService(dependencies).syncToday('user-1'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(dependencies.accessTokens.getAccessToken).not.toHaveBeenCalled();
  });

  it('refreshes once after a provider 401 and reruns every dataset', async () => {
    const dependencies = createDependencies();
    const unauthorized = new WhoopError(
      'WHOOP_REAUTH_REQUIRED',
      'WHOOP authorization needs to be renewed.',
      401
    );
    dependencies.api.getCycles
      .mockRejectedValueOnce(unauthorized)
      .mockResolvedValueOnce({ records: [] });
    dependencies.api.getRecovery
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });
    dependencies.api.getSleep
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });
    dependencies.api.getWorkouts
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });
    dependencies.accessTokens.getAccessToken
      .mockResolvedValueOnce({ accessToken: 'expired-token', refreshed: false })
      .mockResolvedValueOnce({ accessToken: 'rotated-token', refreshed: true });

    await expect(createService(dependencies).syncToday('user-1')).resolves.toMatchObject({
      messageCode: 'NO_WEARABLE_DATA',
      sync: { refreshedToken: true }
    });
    expect(dependencies.accessTokens.getAccessToken).toHaveBeenNthCalledWith(2, 'user-1', true);
    expect(dependencies.api.getCycles).toHaveBeenCalledTimes(2);
    expect(dependencies.api.getRecovery).toHaveBeenCalledTimes(2);
    expect(dependencies.api.getSleep).toHaveBeenCalledTimes(2);
    expect(dependencies.api.getWorkouts).toHaveBeenCalledTimes(2);
  });
});

function createDependencies() {
  const saved = {
    id: 'snapshot-1',
    userId: 'user-1',
    source: HealthProvider.WHOOP,
    localDate: new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()),
    timezone: 'UTC',
    steps: null,
    activeCaloriesKcal: null,
    workoutMinutes: null,
    sleepMinutes: 450,
    sleepQualityScore: 83,
    recoveryScore: 78,
    strainScore: 12.4,
    restingHeartRateBpm: 52,
    hrvMs: 67,
    respiratoryRate: 14.2,
    capturedAt: new Date()
  };
  const transactionClient = {
    wearableDailySnapshot: {
      upsert: jest.fn().mockResolvedValue(saved)
    },
    healthConnection: {
      upsert: jest.fn().mockResolvedValue(undefined)
    }
  };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' })
    },
    wearableDailySnapshot: transactionClient.wearableDailySnapshot,
    healthConnection: transactionClient.healthConnection,
    $transaction: jest.fn((callback: (client: typeof transactionClient) => unknown) =>
      callback(transactionClient))
  };

  return {
    prisma,
    featureAccess: {
      canUseWhoop: jest.fn().mockResolvedValue(true)
    },
    accessTokens: {
      getAccessToken: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshed: false
      })
    },
    api: {
      getCycles: jest.fn(),
      getRecovery: jest.fn(),
      getSleep: jest.fn(),
      getWorkouts: jest.fn()
    }
  };
}

function createService(dependencies: ReturnType<typeof createDependencies>) {
  return new WhoopSyncService(
    dependencies.prisma as unknown as PrismaService,
    dependencies.featureAccess as unknown as FeatureAccessService,
    dependencies.accessTokens as unknown as WhoopAccessTokenService,
    dependencies.api as unknown as WhoopApiClientService
  );
}
