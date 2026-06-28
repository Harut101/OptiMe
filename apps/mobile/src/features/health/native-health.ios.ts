import { Platform } from 'react-native';

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
      return { available: false, reason: 'PLATFORM_UNSUPPORTED' };
    }

    const appleHealth = loadAppleHealthKit();
    if (!appleHealth?.initHealthKit) {
      return { available: false, reason: 'MISSING_NATIVE_MODULE' };
    }

    if (!appleHealth.isAvailable) {
      return { available: true };
    }

    return new Promise((resolve) => {
      appleHealth.isAvailable?.((error, available) => {
        if (error) {
          resolve({ available: false, reason: 'PERMISSION_UNAVAILABLE' });
          return;
        }

        resolve(available ? { available: true } : { available: false, reason: 'PERMISSION_UNAVAILABLE' });
      });
    });
  },

  async requestPermissions() {
    const appleHealth = loadAppleHealthKit();
    if (!appleHealth?.initHealthKit) {
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
            resolve(emptyPermissions());
            return;
          }

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
          callHealthMethod(appleHealth.getStepCount, query),
          callHealthMethod(appleHealth.getActiveEnergyBurned, query),
          callHealthMethod(appleHealth.getAppleExerciseTime, query),
          callHealthMethod(appleHealth.getSleepSamples, query),
          callHealthMethod(appleHealth.getRestingHeartRate, query),
          callHealthMethod(appleHealth.getHeartRateVariabilitySamples, query),
          callHealthMethod(appleHealth.getRespiratoryRateSamples, query)
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
        snapshots.push(sanitized);
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

function callHealthMethod(method: HealthCallbackMethod | undefined, options: Record<string, unknown>) {
  if (!method) {
    return Promise.resolve(null);
  }

  return new Promise<unknown>((resolve) => {
    try {
      method(options, (error, result) => {
        resolve(error ? null : result);
      });
    } catch {
      resolve(null);
    }
  });
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
