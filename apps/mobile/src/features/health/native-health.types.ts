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
  Pick<HealthPermissions, 'weight' | 'heartRate' | 'restingHeartRate' | 'hrv' | 'respiratoryRate'>;

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

export interface NativeWearableSnapshotInput {
  localDate: string;
  timezone: string;
  source: Extract<HealthProvider, 'APPLE_HEALTH'>;
  steps?: number | null;
  activeCaloriesKcal?: number | null;
  workoutMinutes?: number | null;
  sleepMinutes?: number | null;
  sleepQualityScore?: number | null;
  recoveryScore?: null;
  strainScore?: null;
  restingHeartRateBpm?: number | null;
  hrvMs?: number | null;
  respiratoryRate?: number | null;
  capturedAt?: string;
}

export interface NativeHealthReadOptions {
  days: number;
}

export interface NativeHealthSyncResult {
  syncedDays: number;
  attemptedDays: number;
  source?: HealthProvider;
  fieldsPresent?: number;
  messageCode?: 'SYNCED' | 'NO_DATA';
}

export interface NativeHealthAdapter {
  provider: HealthProvider | null;
  getAvailability(): Promise<NativeHealthAvailability>;
  requestPermissions(): Promise<NativeHealthPermissions>;
  readDailySummaries(options: NativeHealthReadOptions): Promise<NativeHealthDailySummary[]>;
  readWearableSnapshots?(options: NativeHealthReadOptions): Promise<NativeWearableSnapshotInput[]>;
}
