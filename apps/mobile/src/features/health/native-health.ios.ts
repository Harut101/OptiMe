import type {
  NativeHealthAdapter,
  NativeHealthDailySummary,
  NativeHealthPermissions
} from './native-health.types';

export const nativeHealthAdapter: NativeHealthAdapter = {
  provider: 'APPLE_HEALTH',
  async getAvailability() {
    return { available: false, reason: 'MISSING_NATIVE_MODULE' };
  },
  async requestPermissions(): Promise<NativeHealthPermissions> {
    return {
      steps: false,
      sleep: false,
      workouts: false,
      activeEnergy: false,
      weight: false,
      heartRate: false,
      restingHeartRate: false
    };
  },
  async readDailySummaries(): Promise<NativeHealthDailySummary[]> {
    return [];
  }
};

