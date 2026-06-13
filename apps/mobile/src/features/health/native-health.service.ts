import { connectHealthProvider, upsertHealthDailySummary } from '@/api/health';
import { nativeHealthAdapter } from './native-health';
import type { NativeHealthSyncResult } from './native-health.types';

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
      attemptedDays: 7
    };
  }
};

