import type { HealthProvider } from '@/types/api';
import type { NativeHealthDailySummary, NativeWearableSnapshotInput } from './native-health.types';

export function getDeviceTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function getLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getLocalDayRange(daysAgo: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysAgo);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    localDate: getLocalDate(start),
    start,
    end
  };
}

export function sanitizeDailySummary(
  summary: NativeHealthDailySummary
): NativeHealthDailySummary | null {
  const sanitized: NativeHealthDailySummary = {
    localDate: summary.localDate,
    timezone: summary.timezone,
    sourceProvider: summary.sourceProvider
  };

  sanitized.steps = sanitizeInteger(summary.steps, 0, 100000);
  sanitized.sleepMinutes = sanitizeInteger(summary.sleepMinutes, 0, 1440);
  sanitized.activeEnergyKcal = sanitizeInteger(summary.activeEnergyKcal, 0, 10000);
  sanitized.workoutCount = sanitizeInteger(summary.workoutCount, 0, 20);
  sanitized.workoutMinutes = sanitizeInteger(summary.workoutMinutes, 0, 1440);

  if (!hasSummaryData(sanitized)) {
    return null;
  }

  return sanitized;
}

export function sanitizeWearableSnapshot(
  snapshot: NativeWearableSnapshotInput
): NativeWearableSnapshotInput | null {
  const sanitized: NativeWearableSnapshotInput = {
    localDate: snapshot.localDate,
    timezone: snapshot.timezone,
    source: 'APPLE_HEALTH',
    steps: sanitizeIntegerOrNull(snapshot.steps, 0, 100000),
    activeCaloriesKcal: sanitizeIntegerOrNull(snapshot.activeCaloriesKcal, 0, 10000),
    workoutMinutes: sanitizeIntegerOrNull(snapshot.workoutMinutes, 0, 1440),
    sleepMinutes: sanitizeIntegerOrNull(snapshot.sleepMinutes, 0, 1440),
    sleepQualityScore: null,
    recoveryScore: null,
    strainScore: null,
    restingHeartRateBpm: sanitizeIntegerOrNull(snapshot.restingHeartRateBpm, 30, 220),
    hrvMs: sanitizeIntegerOrNull(snapshot.hrvMs, 1, 300),
    respiratoryRate: sanitizeNumberOrNull(snapshot.respiratoryRate, 5, 40),
    capturedAt: snapshot.capturedAt ?? new Date().toISOString()
  };

  return hasWearableSnapshotData(sanitized) ? sanitized : null;
}

export function makeEmptyDailySummary(
  provider: HealthProvider,
  localDate: string
): NativeHealthDailySummary {
  return {
    localDate,
    timezone: getDeviceTimezone(),
    sourceProvider: provider
  };
}

export function makeEmptyWearableSnapshot(
  provider: Extract<HealthProvider, 'APPLE_HEALTH'>,
  localDate: string
): NativeWearableSnapshotInput {
  return {
    localDate,
    timezone: getDeviceTimezone(),
    source: provider,
    recoveryScore: null,
    strainScore: null
  };
}

export function hasSummaryData(summary: NativeHealthDailySummary) {
  return (
    summary.steps !== undefined ||
    summary.sleepMinutes !== undefined ||
    summary.activeEnergyKcal !== undefined ||
    summary.workoutCount !== undefined ||
    summary.workoutMinutes !== undefined
  );
}

export function hasWearableSnapshotData(snapshot: NativeWearableSnapshotInput) {
  return (
    snapshot.steps !== undefined && snapshot.steps !== null ||
    snapshot.sleepMinutes !== undefined && snapshot.sleepMinutes !== null ||
    snapshot.activeCaloriesKcal !== undefined && snapshot.activeCaloriesKcal !== null ||
    snapshot.workoutMinutes !== undefined && snapshot.workoutMinutes !== null ||
    snapshot.restingHeartRateBpm !== undefined && snapshot.restingHeartRateBpm !== null ||
    snapshot.hrvMs !== undefined && snapshot.hrvMs !== null ||
    snapshot.respiratoryRate !== undefined && snapshot.respiratoryRate !== null
  );
}

export function minutesBetween(start?: string, end?: string) {
  if (!start || !end) {
    return 0;
  }

  const startMs = Date.parse(start);
  const endMs = Date.parse(end);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }

  return Math.round((endMs - startMs) / 60000);
}

function sanitizeInteger(value: number | undefined, min: number, max: number) {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

function sanitizeIntegerOrNull(value: number | null | undefined, min: number, max: number) {
  if (value === null) {
    return null;
  }

  return sanitizeInteger(value, min, max) ?? null;
}

function sanitizeNumberOrNull(value: number | null | undefined, min: number, max: number) {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(min, Math.min(max, value));
}
