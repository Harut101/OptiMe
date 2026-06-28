import {
  connectHealthProvider,
  updateHealthConnectionStatus,
  upsertHealthDailySummary,
  upsertWearableSnapshot
} from '@/api/health';
import { nativeHealthAdapter } from './native-health';
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
      throw new NativeHealthServiceError('PLATFORM_UNSUPPORTED');
    }

    if (!availability.available) {
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

    const snapshots = await (nativeHealthAdapter.readWearableSnapshots?.({ days: 1 }) ?? []);
    let fieldsPresent = 0;

    for (const snapshot of snapshots) {
      fieldsPresent += countPresentFields(snapshot);
      await upsertWearableSnapshot(snapshot);
    }

    if (snapshots.length === 0) {
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
