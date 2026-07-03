import { Platform } from 'react-native';

import { logNativeHealthEvent } from './native-health.diagnostics';
import {
  getLocalDayRange,
  makeEmptyWearableSnapshot,
  minutesBetween,
  sanitizeWearableSnapshot
} from './native-health.utils';
import type {
  NativeHealthAdapter,
  NativeHealthPermissions,
  NativeHealthReadOptions,
  NativeWearableSnapshotInput
} from './native-health.types';

declare const require: (moduleName: string) => unknown;

type AppleHealthKitModule = {
  Constants?: {
    Permissions?: Record<string, string>;
  };
  initHealthKit?: (
    options: { permissions: { read: string[]; write: string[] } },
    callback: (error?: string | Error | null) => void
  ) => void;
  isAvailable?: (callback: (error: string | Error | null, available: boolean) => void) => void;
  getStepCount?: HealthCallbackMethod;
  getActiveEnergyBurned?: HealthCallbackMethod;
  getAppleExerciseTime?: HealthCallbackMethod;
  getSleepSamples?: HealthCallbackMethod;
  getRestingHeartRate?: HealthCallbackMethod;
  getHeartRateVariabilitySamples?: HealthCallbackMethod;
  getRespiratoryRateSamples?: HealthCallbackMethod;
};

type HealthCallbackMethod = (
  options: Record<string, unknown>,
  callback: (error: string | Error | null, result: unknown) => void
) => void;

type AppleHealthMetricName =
  | 'steps'
  | 'activeEnergy'
  | 'exerciseTime'
  | 'sleep'
  | 'restingHeartRate'
  | 'hrv'
  | 'respiratoryRate';

const READ_PERMISSION_KEYS = [
  'StepCount',
  'ActiveEnergyBurned',
  'AppleExerciseTime',
  'SleepAnalysis',
  'RestingHeartRate',
  'HeartRateVariabilitySDNN',
  'RespiratoryRate'
];

export const nativeHealthAdapter: NativeHealthAdapter = {
  provider: 'APPLE_HEALTH',
  async getAvailability() {
    if (Platform.OS !== 'ios') {
      logNativeHealthEvent('availability checked', {
        provider: 'APPLE_HEALTH',
        available: false,
        reason: 'PLATFORM_UNSUPPORTED'
      });
      return { available: false, reason: 'PLATFORM_UNSUPPORTED' };
    }

    const appleHealth = loadAppleHealthKit();
    if (!appleHealth?.initHealthKit) {
      logNativeHealthEvent('availability checked', {
        provider: 'APPLE_HEALTH',
        available: false,
        reason: 'MISSING_NATIVE_MODULE'
      }, 'warn');
      return { available: false, reason: 'MISSING_NATIVE_MODULE' };
    }

    if (!appleHealth.isAvailable) {
      logNativeHealthEvent('availability checked', {
        provider: 'APPLE_HEALTH',
        available: true,
        nativeAvailabilityApi: false
      });
      return { available: true };
    }

    return new Promise((resolve) => {
      appleHealth.isAvailable?.((error, available) => {
        if (error) {
          logNativeHealthEvent('availability checked', {
            provider: 'APPLE_HEALTH',
            available: false,
            reason: 'PERMISSION_UNAVAILABLE'
          }, 'warn');
          resolve({ available: false, reason: 'PERMISSION_UNAVAILABLE' });
          return;
        }

        logNativeHealthEvent('availability checked', {
          provider: 'APPLE_HEALTH',
          available,
          reason: available ? null : 'PERMISSION_UNAVAILABLE'
        }, available ? 'log' : 'warn');
        resolve(available ? { available: true } : { available: false, reason: 'PERMISSION_UNAVAILABLE' });
      });
    });
  },

  async requestPermissions() {
    const appleHealth = loadAppleHealthKit();
    if (!appleHealth?.initHealthKit) {
      logNativeHealthEvent('permission request result', {
        provider: 'APPLE_HEALTH',
        grantedCorePermissions: 0,
        reason: 'MISSING_NATIVE_MODULE'
      }, 'warn');
      return emptyPermissions();
    }

    const read = getReadPermissions(appleHealth);
    return new Promise((resolve) => {
      appleHealth.initHealthKit?.(
        {
          permissions: {
            read,
            write: []
          }
        },
        (error) => {
          if (error) {
            logNativeHealthEvent('permission request result', {
              provider: 'APPLE_HEALTH',
              grantedCorePermissions: 0,
              reason: 'INIT_HEALTHKIT_ERROR'
            }, 'warn');
            resolve(emptyPermissions());
            return;
          }

          logNativeHealthEvent('permission request result', {
            provider: 'APPLE_HEALTH',
            steps: true,
            sleep: true,
            workouts: true,
            activeEnergy: true,
            restingHeartRate: true,
            hrv: true,
            respiratoryRate: true
          });
          resolve({
            steps: true,
            sleep: true,
            workouts: true,
            activeEnergy: true,
            weight: false,
            heartRate: false,
            restingHeartRate: true,
            hrv: true,
            respiratoryRate: true
          });
        }
      );
    });
  },

  async readDailySummaries() {
    return [];
  },

  async readWearableSnapshots(options: NativeHealthReadOptions) {
    const appleHealth = loadAppleHealthKit();
    if (!appleHealth) {
      return [];
    }

    const days = Math.max(1, Math.min(options.days, 7));
    const snapshots: NativeWearableSnapshotInput[] = [];

    for (let daysAgo = days - 1; daysAgo >= 0; daysAgo -= 1) {
      const { localDate, start, end } = getLocalDayRange(daysAgo);
      const snapshot = makeEmptyWearableSnapshot('APPLE_HEALTH', localDate);
      const query = { startDate: start.toISOString(), endDate: end.toISOString() };
      const [steps, activeEnergy, exerciseTime, sleep, restingHeartRate, hrv, respiratoryRate] =
        await Promise.all([
          readMetricSafely('steps', appleHealth.getStepCount, query, localDate),
          readMetricSafely('activeEnergy', appleHealth.getActiveEnergyBurned, query, localDate),
          readMetricSafely('exerciseTime', appleHealth.getAppleExerciseTime, query, localDate),
          readMetricSafely('sleep', appleHealth.getSleepSamples, query, localDate),
          readMetricSafely('restingHeartRate', appleHealth.getRestingHeartRate, query, localDate),
          readMetricSafely('hrv', appleHealth.getHeartRateVariabilitySamples, query, localDate),
          readMetricSafely('respiratoryRate', appleHealth.getRespiratoryRateSamples, query, localDate)
        ]);

      snapshot.steps = firstNumericValue(steps, ['value', 'count']);
      snapshot.activeCaloriesKcal = sumNumericValues(activeEnergy, ['value', 'kilocalories']);
      snapshot.workoutMinutes =
        sumNumericValues(exerciseTime, ['value', 'minutes']) ?? sumDurationMinutes(exerciseTime);
      snapshot.sleepMinutes = sumDurationMinutes(sleep);
      snapshot.restingHeartRateBpm = firstNumericValue(restingHeartRate, ['value']);
      snapshot.hrvMs = firstNumericValue(hrv, ['value']);
      snapshot.respiratoryRate = firstNumericValue(respiratoryRate, ['value']);
      snapshot.capturedAt = new Date().toISOString();

      const sanitized = sanitizeWearableSnapshot(snapshot);
      if (sanitized) {
        logNativeHealthEvent('normalized wearable snapshot payload', {
          provider: 'APPLE_HEALTH',
          localDate,
          fieldsPresent: countPresentFields(sanitized),
          hasSteps: sanitized.steps !== null,
          hasActiveCalories: sanitized.activeCaloriesKcal !== null,
          hasWorkoutMinutes: sanitized.workoutMinutes !== null,
          hasSleepMinutes: sanitized.sleepMinutes !== null,
          hasRestingHeartRate: sanitized.restingHeartRateBpm !== null,
          hasHrv: sanitized.hrvMs !== null,
          hasRespiratoryRate: sanitized.respiratoryRate !== null
        });
        snapshots.push(sanitized);
      } else {
        logNativeHealthEvent('normalized wearable snapshot payload', {
          provider: 'APPLE_HEALTH',
          localDate,
          fieldsPresent: 0,
          reason: 'NO_USEFUL_FIELDS'
        }, 'warn');
      }
    }

    return snapshots;
  }
};

function loadAppleHealthKit() {
  try {
    const loaded = require('react-native-health');
    if (isRecord(loaded) && isRecord(loaded.default)) {
      return loaded.default as AppleHealthKitModule;
    }

    return loaded as AppleHealthKitModule;
  } catch {
    return null;
  }
}

function getReadPermissions(appleHealth: AppleHealthKitModule) {
  const permissions = appleHealth.Constants?.Permissions ?? {};
  return READ_PERMISSION_KEYS.map((key) => permissions[key] ?? key);
}

function emptyPermissions(): NativeHealthPermissions {
  return {
    steps: false,
    sleep: false,
    workouts: false,
    activeEnergy: false,
    weight: false,
    heartRate: false,
    restingHeartRate: false,
    hrv: false,
    respiratoryRate: false
  };
}

function readMetricSafely(
  metric: AppleHealthMetricName,
  method: HealthCallbackMethod | undefined,
  options: Record<string, unknown>,
  localDate: string
) {
  if (!method) {
    logNativeHealthEvent('metric read skipped', {
      provider: 'APPLE_HEALTH',
      metric,
      localDate,
      reason: 'METHOD_UNAVAILABLE'
    }, 'warn');
    return Promise.resolve(null);
  }

  return new Promise<unknown>((resolve) => {
    try {
      method(options, (error, result) => {
        if (error) {
          logNativeHealthEvent('metric read failed', {
            provider: 'APPLE_HEALTH',
            metric,
            localDate,
            reason: normalizeErrorReason(error)
          }, 'warn');
          resolve(null);
          return;
        }

        logNativeHealthEvent('metric read succeeded', {
          provider: 'APPLE_HEALTH',
          metric,
          localDate,
          resultKind: Array.isArray(result) ? 'array' : typeof result,
          itemCount: Array.isArray(result) ? result.length : isRecord(result) ? 1 : 0
        });
        resolve(result);
      });
    } catch (error) {
      logNativeHealthEvent('metric read failed', {
        provider: 'APPLE_HEALTH',
        metric,
        localDate,
        reason: normalizeErrorReason(error)
      }, 'warn');
      resolve(null);
    }
  });
}

function normalizeErrorReason(error: unknown) {
  if (error instanceof Error) {
    return error.name || 'ERROR';
  }

  if (typeof error === 'string') {
    return error.slice(0, 80);
  }

  return 'UNKNOWN';
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

function firstNumericValue(value: unknown, keys: string[]) {
  const values = collectRecords(value)
    .map((record) => firstNumber(record, keys))
    .filter((item): item is number => item !== null);

  if (values.length === 0) {
    return null;
  }

  return Math.round(values[values.length - 1]);
}

function sumNumericValues(value: unknown, keys: string[]) {
  const values = collectRecords(value)
    .map((record) => firstNumber(record, keys))
    .filter((item): item is number => item !== null);

  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((sum, item) => sum + item, 0));
}

function sumDurationMinutes(value: unknown) {
  const minutes = collectRecords(value).reduce((sum, record) => {
    const explicitValue = firstNumber(record, ['value', 'minutes']);
    if (explicitValue !== null) {
      return sum + explicitValue;
    }

    return sum + minutesBetween(stringValue(record.startDate), stringValue(record.endDate));
  }, 0);

  return minutes > 0 ? Math.round(minutes) : null;
}

function collectRecords(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (isRecord(value)) {
    return [value];
  }

  return [];
}

function firstNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
