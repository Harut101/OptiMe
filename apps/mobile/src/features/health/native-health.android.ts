import {
  getLocalDayRange,
  sanitizeDailySummary
} from './native-health.utils';
import { logNativeHealthEvent } from './native-health.diagnostics';
import type {
  NativeHealthAdapter,
  NativeHealthDailySummary,
  NativeHealthPermissions,
  NativeHealthReadOptions,
  NativeWearableSnapshotInput
} from './native-health.types';

declare const require: (moduleName: string) => unknown;

type HealthConnectPermission = {
  accessType: 'read' | 'write';
  recordType: string;
};

type HealthConnectModule = {
  getSdkStatus?: () => Promise<number>;
  initialize?: () => Promise<boolean> | boolean;
  openHealthConnectSettings?: () => void;
  requestPermission?: (
    permissions: HealthConnectPermission[]
  ) => Promise<HealthConnectPermission[]>;
  getGrantedPermissions?: () => Promise<HealthConnectPermission[]>;
  aggregateRecord?: (request: {
    recordType: string;
    timeRangeFilter: {
      operator: 'between';
      startTime: string;
      endTime: string;
    };
  }) => Promise<Record<string, unknown>>;
  readRecords?: (
    recordType: string,
    options: {
      timeRangeFilter: {
        operator: 'between';
        startTime: string;
        endTime: string;
      };
    }
  ) => Promise<{ records?: unknown[]; result?: unknown[] } | unknown[]>;
};

const SDK_UNAVAILABLE = 1;
const SDK_UPDATE_REQUIRED = 2;
const SDK_AVAILABLE = 3;

const CORE_PERMISSIONS: HealthConnectPermission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' }
];

export const nativeHealthAdapter: NativeHealthAdapter = {
  provider: 'HEALTH_CONNECT',
  async getAvailability() {
    const healthConnect = loadHealthConnect();

    if (!healthConnect?.initialize) {
      logNativeHealthEvent('Health Connect unavailable', {
        provider: 'HEALTH_CONNECT',
        reason: 'MISSING_NATIVE_MODULE'
      }, 'warn');
      return { available: false, reason: 'MISSING_NATIVE_MODULE' };
    }

    try {
      if (healthConnect.getSdkStatus) {
        const sdkStatus = await healthConnect.getSdkStatus();
        logNativeHealthEvent('Health Connect SDK status checked', {
          provider: 'HEALTH_CONNECT',
          sdkStatus
        });

        if (sdkStatus === SDK_UNAVAILABLE) {
          return { available: false, reason: 'HEALTH_CONNECT_NOT_INSTALLED' };
        }

        if (sdkStatus === SDK_UPDATE_REQUIRED) {
          return { available: false, reason: 'HEALTH_CONNECT_UPDATE_REQUIRED' };
        }

        if (sdkStatus !== SDK_AVAILABLE) {
          return { available: false, reason: 'UNKNOWN' };
        }
      }

      const initialized = await healthConnect.initialize();
      logNativeHealthEvent('Health Connect initialized', {
        provider: 'HEALTH_CONNECT',
        initialized: Boolean(initialized)
      });
      return initialized ? { available: true } : { available: false, reason: 'UNKNOWN' };
    } catch (error) {
      logNativeHealthEvent('Health Connect initialization failed', {
        provider: 'HEALTH_CONNECT',
        errorCode: getSafeErrorCode(error)
      }, 'warn');
      return { available: false, reason: 'MISSING_NATIVE_MODULE' };
    }
  },
  async requestPermissions() {
    const healthConnect = loadHealthConnect();

    if (!healthConnect?.requestPermission) {
      return emptyPermissions();
    }

    try {
      const requested = await healthConnect.requestPermission(CORE_PERMISSIONS);
      const granted = healthConnect.getGrantedPermissions
        ? await healthConnect.getGrantedPermissions()
        : requested;
      const permissions = mapPermissions(granted);

      logNativeHealthEvent('Health Connect permissions resolved', {
        provider: 'HEALTH_CONNECT',
        grantedCorePermissions: countCorePermissions(permissions)
      });
      return permissions;
    } catch (error) {
      logNativeHealthEvent('Health Connect permission request failed', {
        provider: 'HEALTH_CONNECT',
        errorCode: getSafeErrorCode(error)
      }, 'warn');
      return emptyPermissions();
    }
  },
  openSettings() {
    const healthConnect = loadHealthConnect();
    if (!healthConnect?.openHealthConnectSettings) {
      throw new Error('HEALTH_CONNECT_SETTINGS_UNAVAILABLE');
    }

    healthConnect.openHealthConnectSettings();
  },
  async readDailySummaries(options: NativeHealthReadOptions) {
    const healthConnect = loadHealthConnect();

    if (!healthConnect?.readRecords) {
      return [];
    }

    const days = Math.max(1, Math.min(options.days, 7));
    const summaries: NativeHealthDailySummary[] = [];

    for (let daysAgo = days - 1; daysAgo >= 0; daysAgo -= 1) {
      const { localDate, start, end } = getLocalDayRange(daysAgo);
      const startTime = start.toISOString();
      const endTime = end.toISOString();

      const [steps, sleep, workouts, activeEnergy] = await Promise.all([
        aggregateSafely(healthConnect, 'Steps', startTime, endTime, localDate),
        aggregateSafely(healthConnect, 'SleepSession', startTime, endTime, localDate),
        readRecordsSafely(healthConnect, 'ExerciseSession', startTime, endTime, localDate),
        aggregateSafely(healthConnect, 'ActiveCaloriesBurned', startTime, endTime, localDate)
      ]);

      const sanitized = sanitizeDailySummary({
        localDate,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        sourceProvider: 'HEALTH_CONNECT',
        steps: positiveInteger(steps?.COUNT_TOTAL),
        sleepMinutes: positiveMinutes(sleep?.SLEEP_DURATION_TOTAL),
        workoutCount: workouts.length > 0 ? workouts.length : undefined,
        workoutMinutes: sumDurationMinutes(workouts),
        activeEnergyKcal: positiveInteger(
          getNestedNumber(activeEnergy, 'ACTIVE_CALORIES_TOTAL', 'inKilocalories')
        )
      });

      logNativeHealthEvent('Health Connect daily summary normalized', {
        provider: 'HEALTH_CONNECT',
        localDate,
        fieldsPresent: sanitized ? countSummaryFields(sanitized) : 0
      });

      if (sanitized) {
        summaries.push(sanitized);
      }
    }

    return summaries;
  },
  async readWearableSnapshots(options: NativeHealthReadOptions) {
    const summaries = await nativeHealthAdapter.readDailySummaries(options);

    return summaries.map<NativeWearableSnapshotInput>((summary) => ({
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
    }));
  }
};

function loadHealthConnect() {
  try {
    return require('react-native-health-connect') as HealthConnectModule;
  } catch {
    try {
      return require('expo-health-connect') as HealthConnectModule;
    } catch {
      return null;
    }
  }
}

async function aggregateSafely(
  healthConnect: HealthConnectModule,
  recordType: string,
  startTime: string,
  endTime: string,
  localDate: string
) {
  if (!healthConnect.aggregateRecord) {
    logNativeHealthEvent('Health Connect aggregate unavailable', {
      provider: 'HEALTH_CONNECT',
      metric: recordType,
      localDate
    }, 'warn');
    return null;
  }

  try {
    const result = await healthConnect.aggregateRecord({
      recordType,
      timeRangeFilter: {
        operator: 'between',
        startTime,
        endTime
      }
    });
    logNativeHealthEvent('Health Connect metric read succeeded', {
      provider: 'HEALTH_CONNECT',
      metric: recordType,
      localDate
    });
    return result;
  } catch (error) {
    logNativeHealthEvent('Health Connect metric read failed', {
      provider: 'HEALTH_CONNECT',
      metric: recordType,
      localDate,
      errorCode: getSafeErrorCode(error)
    }, 'warn');
    return null;
  }
}

async function readRecordsSafely(
  healthConnect: HealthConnectModule,
  recordType: string,
  startTime: string,
  endTime: string,
  localDate: string
) {
  try {
    const response = await healthConnect.readRecords?.(recordType, {
      timeRangeFilter: {
        operator: 'between',
        startTime,
        endTime
      }
    });
    const records = Array.isArray(response)
      ? response
      : response?.records ?? response?.result ?? [];
    logNativeHealthEvent('Health Connect metric read succeeded', {
      provider: 'HEALTH_CONNECT',
      metric: recordType,
      localDate,
      recordCount: records.length
    });
    return records;
  } catch (error) {
    logNativeHealthEvent('Health Connect metric read failed', {
      provider: 'HEALTH_CONNECT',
      metric: recordType,
      localDate,
      errorCode: getSafeErrorCode(error)
    }, 'warn');
    return [];
  }
}

function mapPermissions(granted: HealthConnectPermission[]): NativeHealthPermissions {
  return {
    steps: hasPermission(granted, 'Steps'),
    sleep: hasPermission(granted, 'SleepSession'),
    workouts: hasPermission(granted, 'ExerciseSession'),
    activeEnergy: hasPermission(granted, 'ActiveCaloriesBurned'),
    weight: false,
    heartRate: false,
    restingHeartRate: false,
    hrv: false,
    respiratoryRate: false
  };
}

function hasPermission(granted: HealthConnectPermission[], recordType: string) {
  return granted.some(
    (permission) => permission.accessType === 'read' && permission.recordType === recordType
  );
}

function countCorePermissions(permissions: NativeHealthPermissions) {
  return [
    permissions.steps,
    permissions.sleep,
    permissions.workouts,
    permissions.activeEnergy
  ].filter(Boolean).length;
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

function positiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : undefined;
}

function positiveMinutes(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  // The native bridge exposes Health Connect duration aggregates in seconds.
  return Math.round(value / 60);
}

function sumDurationMinutes(records: unknown[]) {
  const total = records.reduce<number>((sum, record) => {
    if (!isRecord(record)) {
      return sum;
    }

    const startTime = typeof record.startTime === 'string' ? Date.parse(record.startTime) : NaN;
    const endTime = typeof record.endTime === 'string' ? Date.parse(record.endTime) : NaN;
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
      return sum;
    }

    return sum + Math.round((endTime - startTime) / 60000);
  }, 0);

  return total > 0 ? total : undefined;
}

function getNestedNumber(
  record: Record<string, unknown> | null,
  parentKey: string,
  childKey: string
) {
  if (!record || !isRecord(record[parentKey])) {
    return undefined;
  }

  return record[parentKey][childKey];
}

function countSummaryFields(summary: NativeHealthDailySummary) {
  return [
    summary.steps,
    summary.sleepMinutes,
    summary.activeEnergyKcal,
    summary.workoutCount,
    summary.workoutMinutes
  ].filter((value) => value !== undefined).length;
}

function getSafeErrorCode(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    if ('code' in error && (typeof error.code === 'string' || typeof error.code === 'number')) {
      return String(error.code).slice(0, 80);
    }

    if ('name' in error && typeof error.name === 'string') {
      return error.name.slice(0, 80);
    }
  }

  return 'UNKNOWN';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
