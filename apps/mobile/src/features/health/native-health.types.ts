import type { HealthPermissions, HealthProvider } from '@/types/api';

export type NativeHealthAvailability =
  | { available: true }
  | {
      available: false;
      reason:
        | 'EXPO_GO_UNSUPPORTED'
        | 'PLATFORM_UNSUPPORTED'
        | 'MISSING_NATIVE_MODULE'
        | 'PERMISSION_UNAVAILABLE'
        | 'UNKNOWN';
    };

export type NativeHealthPermissions = Required<
  Pick<HealthPermissions, 'steps' | 'sleep' | 'workouts' | 'activeEnergy'>
> &
  Pick<HealthPermissions, 'weight' | 'heartRate' | 'restingHeartRate'>;

export interface NativeHealthDailySummary {
  localDate: string;
  timezone: string;
  sourceProvider: HealthProvider;
  steps?: number;
  sleepMinutes?: number;
  activeEnergyKcal?: number;
  workoutCount?: number;
  workoutMinutes?: number;
  averageHeartRate?: number;
  restingHeartRate?: number;
  weightKg?: number;
}

export interface NativeHealthReadOptions {
  days: number;
}

export interface NativeHealthSyncResult {
  syncedDays: number;
  attemptedDays: number;
}

export interface NativeHealthAdapter {
  provider: HealthProvider | null;
  getAvailability(): Promise<NativeHealthAvailability>;
  requestPermissions(): Promise<NativeHealthPermissions>;
  readDailySummaries(options: NativeHealthReadOptions): Promise<NativeHealthDailySummary[]>;
}

