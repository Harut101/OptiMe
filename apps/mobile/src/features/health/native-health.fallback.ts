import type {
  NativeHealthAdapter,
  NativeHealthDailySummary,
  NativeHealthPermissions
} from './native-health.types';

export const nativeHealthFallbackAdapter: NativeHealthAdapter = {
  provider: null,
  async getAvailability() {
    return { available: false, reason: 'PLATFORM_UNSUPPORTED' };
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

