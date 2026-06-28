import {
  getLocalDayRange,
  makeEmptyDailySummary,
  minutesBetween,
  sanitizeDailySummary
} from './native-health.utils';
import type {
  NativeHealthAdapter,
  NativeHealthDailySummary,
  NativeHealthPermissions,
  NativeHealthReadOptions
} from './native-health.types';

declare const require: (moduleName: string) => unknown;

type HealthConnectPermission = {
  accessType: 'read' | 'write';
  recordType: string;
};

type HealthConnectModule = {
  initialize?: () => Promise<boolean> | boolean;
  requestPermission?: (
    permissions: HealthConnectPermission[]
  ) => Promise<HealthConnectPermission[]>;
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
      return { available: false, reason: 'MISSING_NATIVE_MODULE' };
    }

    try {
      const initialized = await healthConnect.initialize();
      return initialized ? { available: true } : { available: false, reason: 'UNKNOWN' };
    } catch {
      return { available: false, reason: 'MISSING_NATIVE_MODULE' };
    }
  },
  async requestPermissions() {
    const healthConnect = loadHealthConnect();

    if (!healthConnect?.requestPermission) {
      return emptyPermissions();
    }

    try {
      const granted = await healthConnect.requestPermission(CORE_PERMISSIONS);

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
    } catch {
      return emptyPermissions();
    }
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
      const summary = makeEmptyDailySummary('HEALTH_CONNECT', localDate);
      const startTime = start.toISOString();
      const endTime = end.toISOString();

      const [steps, sleep, workouts, activeEnergy] = await Promise.all([
        readRecordsSafely(healthConnect, 'Steps', startTime, endTime),
        readRecordsSafely(healthConnect, 'SleepSession', startTime, endTime),
        readRecordsSafely(healthConnect, 'ExerciseSession', startTime, endTime),
        readRecordsSafely(healthConnect, 'ActiveCaloriesBurned', startTime, endTime)
      ]);

      summary.steps = sumSteps(steps);
      summary.sleepMinutes = sumDurationMinutes(sleep);
      summary.workoutCount = workouts.length || undefined;
      summary.workoutMinutes = sumDurationMinutes(workouts);
      summary.activeEnergyKcal = sumActiveEnergyKcal(activeEnergy);

      const sanitized = sanitizeDailySummary(summary);
      if (sanitized) {
        summaries.push(sanitized);
      }
    }

    return summaries;
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

async function readRecordsSafely(
  healthConnect: HealthConnectModule,
  recordType: string,
  startTime: string,
  endTime: string
) {
  try {
    const response = await healthConnect.readRecords?.(recordType, {
      timeRangeFilter: {
        operator: 'between',
        startTime,
        endTime
      }
    });

    if (Array.isArray(response)) {
      return response;
    }

    return response?.records ?? response?.result ?? [];
  } catch {
    return [];
  }
}

function hasPermission(granted: HealthConnectPermission[], recordType: string) {
  return granted.some(
    (permission) => permission.accessType === 'read' && permission.recordType === recordType
  );
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

function sumSteps(records: unknown[]) {
  const total = records.reduce<number>((sum, record) => {
    const count = getNumber(record, 'count');
    return sum + count;
  }, 0);

  return total > 0 ? total : undefined;
}

function sumDurationMinutes(records: unknown[]) {
  const total = records.reduce<number>((sum, record) => {
    if (!isRecord(record)) {
      return sum;
    }

    return sum + minutesBetween(stringValue(record.startTime), stringValue(record.endTime));
  }, 0);

  return total > 0 ? total : undefined;
}

function sumActiveEnergyKcal(records: unknown[]) {
  const total = records.reduce<number>((sum, record) => {
    if (!isRecord(record)) {
      return sum;
    }

    const energy = record.energy;
    if (!isRecord(energy)) {
      return sum;
    }

    return sum + numberValue(energy.inKilocalories);
  }, 0);

  return total > 0 ? total : undefined;
}

function getNumber(record: unknown, key: string) {
  if (!isRecord(record)) {
    return 0;
  }

  return numberValue(record[key]);
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
