import {
  connectHealthProvider,
  updateHealthConnectionStatus,
  upsertHealthDailySummary,
  upsertWearableSnapshot
} from '@/api/health';
import { ApiError } from '@/api/client';
import { nativeHealthAdapter } from './native-health';
import { logNativeHealthEvent } from './native-health.diagnostics';
import type { NativeHealthSyncResult, NativeWearableSnapshotInput } from './native-health.types';

export const nativeHealthService = {
  getAvailability() {
    return nativeHealthAdapter.getAvailability();
  },

  requestPermissions() {
    return nativeHealthAdapter.requestPermissions();
  },

  readDailySummaries(options: { days: number }) {
    return nativeHealthAdapter.readDailySummaries(options);
  },

  readWearableSnapshots(options: { days: number }) {
    return nativeHealthAdapter.readWearableSnapshots?.(options) ?? Promise.resolve([]);
  },

  async syncAppleHealthToday(): Promise<NativeHealthSyncResult> {
    const provider = nativeHealthAdapter.provider;
    const availability = await nativeHealthAdapter.getAvailability();

    if (provider !== 'APPLE_HEALTH') {
      logNativeHealthEvent('sync stopped', {
        provider: provider ?? 'none',
        reason: 'PLATFORM_UNSUPPORTED'
      }, 'warn');
      throw new NativeHealthServiceError('PLATFORM_UNSUPPORTED');
    }

    if (!availability.available) {
      logNativeHealthEvent('sync stopped', {
        provider,
        reason: availability.reason
      }, 'warn');
      await updateHealthConnectionStatus('APPLE_HEALTH', {
        status: availability.reason === 'PLATFORM_UNSUPPORTED' ? 'DISABLED' : 'ERROR',
        errorCode: availability.reason
      });
      throw new NativeHealthServiceError(availability.reason);
    }

    const permissions = await nativeHealthAdapter.requestPermissions();
    const grantedCorePermission =
      permissions.steps || permissions.sleep || permissions.workouts || permissions.activeEnergy;

    if (!grantedCorePermission) {
      logNativeHealthEvent('sync stopped', {
        provider,
        reason: 'APPLE_HEALTH_PERMISSION_DENIED',
        grantedCorePermissions: 0
      }, 'warn');
      await updateHealthConnectionStatus('APPLE_HEALTH', {
        status: 'NEEDS_REAUTH',
        errorCode: 'APPLE_HEALTH_PERMISSION_DENIED'
      });
      throw new NativeHealthServiceError('APPLE_HEALTH_PERMISSION_DENIED');
    }

    await connectHealthProvider({
      provider,
      permissionsGranted: permissions
    });
    logNativeHealthEvent('health provider connected', {
      provider,
      permissionSteps: Boolean(permissions.steps),
      permissionSleep: Boolean(permissions.sleep),
      permissionWorkouts: Boolean(permissions.workouts),
      permissionActiveEnergy: Boolean(permissions.activeEnergy)
    });

    const snapshots = await (nativeHealthAdapter.readWearableSnapshots?.({ days: 1 }) ?? []);
    logNativeHealthEvent('wearable snapshot read completed', {
      provider,
      attemptedDays: 1,
      snapshotCount: snapshots.length
    });
    let fieldsPresent = 0;

    for (const snapshot of snapshots) {
      fieldsPresent += countPresentFields(snapshot);
      try {
        const response = await upsertWearableSnapshot(snapshot);
        logNativeHealthEvent('wearable snapshot POST succeeded', {
          provider,
          localDate: snapshot.localDate,
          fieldsPresent: countPresentFields(snapshot),
          hasRecentData: response.hasRecentData,
          messageCode: response.messageCode
        });
      } catch (error) {
        const errorCode = getSnapshotSaveErrorCode(error);
        logNativeHealthEvent('wearable snapshot POST failed', {
          provider,
          localDate: snapshot.localDate,
          fieldsPresent: countPresentFields(snapshot),
          errorCode,
          status: error instanceof ApiError ? error.status : null
        }, 'error');
        await updateHealthConnectionStatus('APPLE_HEALTH', {
          status: 'ERROR',
          errorCode
        });
        throw new NativeHealthServiceError(errorCode);
      }
    }

    if (snapshots.length === 0) {
      logNativeHealthEvent('wearable snapshot sync completed without data', {
        provider,
        attemptedDays: 1
      }, 'warn');
      await updateHealthConnectionStatus('APPLE_HEALTH', {
        status: 'CONNECTED',
        errorCode: 'APPLE_HEALTH_NO_DATA'
      });
    }

    return {
      syncedDays: snapshots.length,
      attemptedDays: 1,
      source: provider,
      fieldsPresent,
      messageCode: snapshots.length > 0 ? 'SYNCED' : 'NO_DATA'
    };
  },

  async syncLast7Days(): Promise<NativeHealthSyncResult> {
    const provider = nativeHealthAdapter.provider;
    const availability = await nativeHealthAdapter.getAvailability();

    if (!provider || !availability.available) {
      throw new Error('Health sync requires a development build with native health support.');
    }

    const permissions = await nativeHealthAdapter.requestPermissions();
    const grantedCorePermission =
      permissions.steps || permissions.sleep || permissions.workouts || permissions.activeEnergy;

    if (!grantedCorePermission) {
      throw new Error('Health permissions were not granted. Nothing was synced.');
    }

    await connectHealthProvider({
      provider,
      permissionsGranted: permissions
    });

    const summaries = await nativeHealthAdapter.readDailySummaries({ days: 7 });

    for (const summary of summaries) {
      await upsertHealthDailySummary(summary);
    }

    return {
      syncedDays: summaries.length,
      attemptedDays: 7,
      source: provider,
      messageCode: summaries.length > 0 ? 'SYNCED' : 'NO_DATA'
    };
  }
};

export class NativeHealthServiceError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function countPresentFields(snapshot: NativeWearableSnapshotInput) {
  return [
    snapshot.steps,
    snapshot.activeCaloriesKcal,
    snapshot.workoutMinutes,
    snapshot.sleepMinutes,
    snapshot.restingHeartRateBpm,
    snapshot.hrvMs,
    snapshot.respiratoryRate
  ].filter((value) => value !== undefined && value !== null).length;
}

function getSnapshotSaveErrorCode(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return 'APPLE_HEALTH_API_AUTH_FAILED';
    }

    if (error.status === 400) {
      return getBodyCode(error.body) ?? 'APPLE_HEALTH_SNAPSHOT_VALIDATION_FAILED';
    }

    return getBodyCode(error.body) ?? 'APPLE_HEALTH_SNAPSHOT_SAVE_FAILED';
  }

  return 'APPLE_HEALTH_SNAPSHOT_SAVE_FAILED';
}

function getBodyCode(body: unknown) {
  if (typeof body === 'object' && body !== null && 'code' in body) {
    return String((body as { code?: unknown }).code).slice(0, 80);
  }

  return null;
}
