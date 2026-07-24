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

  openSettings() {
    return nativeHealthAdapter.openSettings?.();
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
      return unavailableResult('PLATFORM_UNSUPPORTED', provider ?? undefined);
    }

    if (!availability.available) {
      logNativeHealthEvent('sync stopped', {
        provider,
        reason: availability.reason
      }, 'warn');
      await updateConnectionStatusBestEffort('APPLE_HEALTH', {
        status: getUnavailableConnectionStatus(availability.reason),
        errorCode: availability.reason
      });
      return unavailableResult(availability.reason, provider);
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
      await updateConnectionStatusBestEffort('APPLE_HEALTH', {
        status: 'NEEDS_REAUTH',
        errorCode: 'APPLE_HEALTH_PERMISSION_DENIED'
      });
      return {
        syncedDays: 0,
        attemptedDays: 1,
        source: provider,
        fieldsPresent: 0,
        messageCode: 'PERMISSION_DENIED',
        errorCode: 'APPLE_HEALTH_PERMISSION_DENIED'
      };
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
      await updateConnectionStatusBestEffort('APPLE_HEALTH', {
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
    return syncHealthConnectLast7Days();
  },

  async syncHealthConnectLast7Days(): Promise<NativeHealthSyncResult> {
    return syncHealthConnectLast7Days();
  }
};

async function syncHealthConnectLast7Days(): Promise<NativeHealthSyncResult> {
    const provider = nativeHealthAdapter.provider;
    const availability = await nativeHealthAdapter.getAvailability();

    if (provider !== 'HEALTH_CONNECT') {
      logNativeHealthEvent('sync stopped', {
        provider: provider ?? 'none',
        reason: 'PLATFORM_UNSUPPORTED'
      }, 'warn');
      return unavailableResult('PLATFORM_UNSUPPORTED', provider ?? undefined, 7);
    }

    if (!availability.available) {
      logNativeHealthEvent('sync stopped', {
        provider,
        reason: availability.reason
      }, 'warn');
      await updateConnectionStatusBestEffort(provider, {
        status: getUnavailableConnectionStatus(availability.reason),
        errorCode: availability.reason
      });
      return unavailableResult(availability.reason, provider, 7);
    }

    const permissions = await nativeHealthAdapter.requestPermissions();
    const grantedCorePermission =
      permissions.steps || permissions.sleep || permissions.workouts || permissions.activeEnergy;

    if (!grantedCorePermission) {
      logNativeHealthEvent('sync stopped', {
        provider,
        reason: 'HEALTH_CONNECT_PERMISSION_DENIED',
        grantedCorePermissions: 0
      }, 'warn');
      await updateConnectionStatusBestEffort(provider, {
        status: 'NEEDS_REAUTH',
        errorCode: 'HEALTH_CONNECT_PERMISSION_DENIED'
      });
      return {
        syncedDays: 0,
        attemptedDays: 7,
        source: provider,
        fieldsPresent: 0,
        messageCode: 'PERMISSION_DENIED',
        errorCode: 'HEALTH_CONNECT_PERMISSION_DENIED'
      };
    }

    try {
      await connectHealthProvider({
        provider,
        permissionsGranted: permissions
      });
    } catch (error) {
      const errorCode = getHealthConnectSaveErrorCode(error);
      logNativeHealthEvent('Health Connect connection POST failed', {
        provider,
        errorCode,
        status: error instanceof ApiError ? error.status : null
      }, 'error');
      await updateConnectionStatusBestEffort(provider, {
        status: 'ERROR',
        errorCode
      });
      throw new NativeHealthServiceError(errorCode);
    }
    logNativeHealthEvent('health provider connected', {
      provider,
      permissionSteps: Boolean(permissions.steps),
      permissionSleep: Boolean(permissions.sleep),
      permissionWorkouts: Boolean(permissions.workouts),
      permissionActiveEnergy: Boolean(permissions.activeEnergy)
    });

    const summaries = await nativeHealthAdapter.readDailySummaries({ days: 7 });
    let fieldsPresent = 0;

    for (const summary of summaries) {
      fieldsPresent += countDailySummaryFields(summary);
      try {
        await upsertHealthDailySummary(summary);
        await upsertWearableSnapshot({
          localDate: summary.localDate,
          timezone: summary.timezone,
          source: 'HEALTH_CONNECT',
          steps: summary.steps ?? null,
          activeCaloriesKcal: summary.activeEnergyKcal ?? null,
          workoutMinutes: summary.workoutMinutes ?? null,
          sleepMinutes: summary.sleepMinutes ?? null,
          sleepQualityScore: null,
          recoveryScore: null,
          strainScore: null,
          restingHeartRateBpm: null,
          hrvMs: null,
          respiratoryRate: null,
          capturedAt: new Date().toISOString()
        });
        logNativeHealthEvent('Health Connect summary POST succeeded', {
          provider,
          localDate: summary.localDate,
          fieldsPresent: countDailySummaryFields(summary)
        });
      } catch (error) {
        const errorCode = getHealthConnectSaveErrorCode(error);
        logNativeHealthEvent('Health Connect summary POST failed', {
          provider,
          localDate: summary.localDate,
          fieldsPresent: countDailySummaryFields(summary),
          errorCode,
          status: error instanceof ApiError ? error.status : null
        }, 'error');
        await updateConnectionStatusBestEffort(provider, {
          status: 'ERROR',
          errorCode
        });
        throw new NativeHealthServiceError(errorCode);
      }
    }

    await updateConnectionStatusBestEffort(provider, {
      status: 'CONNECTED',
      errorCode: summaries.length > 0 ? null : 'HEALTH_CONNECT_NO_DATA'
    });
    logNativeHealthEvent('Health Connect sync completed', {
      provider,
      attemptedDays: 7,
      syncedDays: summaries.length,
      fieldsPresent
    });

    return {
      syncedDays: summaries.length,
      attemptedDays: 7,
      source: provider,
      fieldsPresent,
      messageCode: summaries.length > 0 ? 'SYNCED' : 'NO_DATA'
    };
}

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

function unavailableResult(
  errorCode: string,
  source?: NativeHealthSyncResult['source'],
  attemptedDays = 1
): NativeHealthSyncResult {
  return {
    syncedDays: 0,
    attemptedDays,
    source,
    fieldsPresent: 0,
    messageCode: 'UNAVAILABLE',
    errorCode
  };
}

function getUnavailableConnectionStatus(errorCode: string) {
  if (
    errorCode === 'PLATFORM_UNSUPPORTED'
    || errorCode === 'MISSING_NATIVE_MODULE'
    || errorCode === 'HEALTH_CONNECT_NOT_INSTALLED'
  ) {
    return 'DISABLED';
  }

  return errorCode === 'HEALTH_CONNECT_UPDATE_REQUIRED' ? 'NEEDS_REAUTH' : 'ERROR';
}

function countDailySummaryFields(summary: Awaited<ReturnType<typeof nativeHealthAdapter.readDailySummaries>>[number]) {
  return [
    summary.steps,
    summary.sleepMinutes,
    summary.activeEnergyKcal,
    summary.workoutCount,
    summary.workoutMinutes
  ].filter((value) => value !== undefined && value !== null).length;
}

function getHealthConnectSaveErrorCode(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return 'HEALTH_CONNECT_API_AUTH_FAILED';
    }

    if (error.status === 400) {
      return getBodyCode(error.body) ?? 'HEALTH_CONNECT_SNAPSHOT_VALIDATION_FAILED';
    }

    return getBodyCode(error.body) ?? 'HEALTH_CONNECT_SNAPSHOT_SAVE_FAILED';
  }

  return 'HEALTH_CONNECT_SNAPSHOT_SAVE_FAILED';
}

async function updateConnectionStatusBestEffort(
  source: Parameters<typeof updateHealthConnectionStatus>[0],
  request: Parameters<typeof updateHealthConnectionStatus>[1]
) {
  try {
    await updateHealthConnectionStatus(source, request);
  } catch (error) {
    logNativeHealthEvent('connection status update skipped', {
      provider: source,
      requestedStatus: request.status,
      errorCode: error instanceof ApiError ? getBodyCode(error.body) ?? `HTTP_${error.status}` : 'STATUS_UPDATE_FAILED'
    }, 'warn');
  }
}
