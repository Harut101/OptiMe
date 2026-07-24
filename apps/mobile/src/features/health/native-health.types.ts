import type { HealthPermissions, HealthProvider } from '@/types/api';

export type NativeHealthAvailability =
  | { available: true }
  | {
      available: false;
      reason:
        | 'EXPO_GO_UNSUPPORTED'
        | 'PLATFORM_UNSUPPORTED'
        | 'MISSING_NATIVE_MODULE'
        | 'HEALTH_CONNECT_NOT_INSTALLED'
        | 'HEALTH_CONNECT_UPDATE_REQUIRED'
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
  source: Extract<HealthProvider, 'APPLE_HEALTH' | 'HEALTH_CONNECT'>;
  steps?: number | null;
  activeCaloriesKcal?: number | null;
  workoutMinutes?: number | null;
  sleepMinutes?: number | null;
  sleepQualityScore?: number | null;
  recoveryScore?: null;
  strainScore?: null;
  restingHeartRateBpm?: null;
  hrvMs?: null;
  respiratoryRate?: null;
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
  messageCode?: 'SYNCED' | 'NO_DATA' | 'UNAVAILABLE' | 'PERMISSION_DENIED';
  errorCode?: string;
}

export interface NativeHealthAdapter {
  provider: HealthProvider | null;
  getAvailability(): Promise<NativeHealthAvailability>;
  requestPermissions(): Promise<NativeHealthPermissions>;
  openSettings?(): Promise<void> | void;
  readDailySummaries(options: NativeHealthReadOptions): Promise<NativeHealthDailySummary[]>;
  readWearableSnapshots?(options: NativeHealthReadOptions): Promise<NativeWearableSnapshotInput[]>;
}
