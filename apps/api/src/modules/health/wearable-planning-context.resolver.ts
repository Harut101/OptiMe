import { Injectable } from '@nestjs/common';
import { HealthProvider } from '@prisma/client';

import {
  EMPTY_WEARABLE_PLANNING_CONTEXT,
  WearableActivityLevelHint,
  WearablePlanningContext,
  WearablePlanningReasonCode,
  WearableRecoveryHint,
  WearableSleepHint
} from './health-planning.types';

export const WEARABLE_LOW_SLEEP_MINUTES = 360;
export const WEARABLE_HIGH_ACTIVITY_STEPS = 12000;
export const WEARABLE_MODERATE_ACTIVITY_STEPS = 6000;
export const WEARABLE_HIGH_ACTIVE_CALORIES_KCAL = 900;
export const WEARABLE_HIGH_WORKOUT_MINUTES = 60;

interface WearableSnapshotForPlanning {
  source: HealthProvider;
  localDate: string;
  steps: number | null;
  activeCaloriesKcal: number | null;
  workoutMinutes: number | null;
  sleepMinutes: number | null;
  recoveryScore: number | null;
  strainScore: number | null;
  restingHeartRateBpm: number | null;
  hrvMs: number | null;
  respiratoryRate: number | null;
}

@Injectable()
export class WearablePlanningContextResolver {
  resolve(
    snapshot: WearableSnapshotForPlanning | null,
    options: { isStale: boolean }
  ): WearablePlanningContext {
    if (!snapshot) {
      return EMPTY_WEARABLE_PLANNING_CONTEXT;
    }

    const activityLevelHint = this.resolveActivityLevelHint(snapshot);
    const sleepHint = this.resolveSleepHint(snapshot.sleepMinutes);
    const recoveryHint = this.resolveRecoveryHint(snapshot);
    const reasonCodes = this.resolveReasonCodes(snapshot, {
      activityLevelHint,
      sleepHint,
      recoveryHint,
      isStale: options.isStale
    });

    return {
      hasWearableData: true,
      source: snapshot.source,
      localDate: snapshot.localDate,
      isStale: options.isStale,
      activity: {
        steps: snapshot.steps,
        activeCaloriesKcal: snapshot.activeCaloriesKcal,
        workoutMinutes: snapshot.workoutMinutes,
        activityLevelHint
      },
      sleep: {
        sleepMinutes: snapshot.sleepMinutes,
        sleepHint
      },
      recovery: {
        recoveryScore: snapshot.recoveryScore,
        strainScore: snapshot.strainScore,
        restingHeartRateBpm: snapshot.restingHeartRateBpm,
        hrvMs: snapshot.hrvMs,
        respiratoryRate: snapshot.respiratoryRate,
        recoveryHint
      },
      reasonCodes
    };
  }

  private resolveActivityLevelHint(snapshot: WearableSnapshotForPlanning): WearableActivityLevelHint {
    if (
      (snapshot.steps ?? 0) >= WEARABLE_HIGH_ACTIVITY_STEPS ||
      (snapshot.activeCaloriesKcal ?? 0) >= WEARABLE_HIGH_ACTIVE_CALORIES_KCAL ||
      (snapshot.workoutMinutes ?? 0) >= WEARABLE_HIGH_WORKOUT_MINUTES ||
      (snapshot.strainScore ?? 0) >= 15
    ) {
      return 'HIGH';
    }

    if (
      (snapshot.steps ?? 0) >= WEARABLE_MODERATE_ACTIVITY_STEPS ||
      (snapshot.workoutMinutes ?? 0) > 0 ||
      (snapshot.activeCaloriesKcal ?? 0) > 0
    ) {
      return 'MODERATE';
    }

    return this.hasAnyActivityField(snapshot) ? 'LOW' : 'UNKNOWN';
  }

  private resolveSleepHint(sleepMinutes: number | null): WearableSleepHint {
    if (sleepMinutes === null) {
      return 'UNKNOWN';
    }

    return sleepMinutes < WEARABLE_LOW_SLEEP_MINUTES ? 'LOW_SLEEP' : 'OK_SLEEP';
  }

  private resolveRecoveryHint(snapshot: WearableSnapshotForPlanning): WearableRecoveryHint {
    if (snapshot.recoveryScore !== null || snapshot.strainScore !== null) {
      return 'RECOVERY_DATA_AVAILABLE';
    }

    if (
      snapshot.restingHeartRateBpm !== null ||
      snapshot.hrvMs !== null ||
      snapshot.respiratoryRate !== null
    ) {
      return 'LIMITED_RECOVERY_DATA';
    }

    return 'UNKNOWN';
  }

  private resolveReasonCodes(
    snapshot: WearableSnapshotForPlanning,
    hints: {
      activityLevelHint: WearableActivityLevelHint;
      sleepHint: WearableSleepHint;
      recoveryHint: WearableRecoveryHint;
      isStale: boolean;
    }
  ) {
    const reasonCodes = new Set<WearablePlanningReasonCode>();

    if (hints.isStale) reasonCodes.add('STALE_WEARABLE_DATA');
    if (this.isPartialSnapshot(snapshot)) reasonCodes.add('PARTIAL_WEARABLE_DATA');
    if (hints.sleepHint === 'LOW_SLEEP') reasonCodes.add('LOW_SLEEP');
    if (hints.sleepHint === 'OK_SLEEP') reasonCodes.add('OK_SLEEP');
    if (hints.activityLevelHint === 'HIGH') reasonCodes.add('HIGH_ACTIVITY');
    if (hints.activityLevelHint === 'MODERATE') reasonCodes.add('MODERATE_ACTIVITY');
    if ((snapshot.workoutMinutes ?? 0) > 0) reasonCodes.add('RECENT_WORKOUT_LOAD');
    if (hints.recoveryHint === 'RECOVERY_DATA_AVAILABLE') reasonCodes.add('RECOVERY_DATA_AVAILABLE');
    if (hints.recoveryHint === 'LIMITED_RECOVERY_DATA') reasonCodes.add('LIMITED_RECOVERY_DATA');
    if (
      snapshot.source === HealthProvider.APPLE_HEALTH &&
      snapshot.recoveryScore === null &&
      snapshot.strainScore === null
    ) {
      reasonCodes.add('APPLE_HEALTH_NO_RECOVERY_SCORE');
    }

    return Array.from(reasonCodes);
  }

  private hasAnyActivityField(snapshot: WearableSnapshotForPlanning) {
    return (
      snapshot.steps !== null ||
      snapshot.activeCaloriesKcal !== null ||
      snapshot.workoutMinutes !== null ||
      snapshot.strainScore !== null
    );
  }

  private isPartialSnapshot(snapshot: WearableSnapshotForPlanning) {
    const presentCount = [
      snapshot.steps,
      snapshot.activeCaloriesKcal,
      snapshot.workoutMinutes,
      snapshot.sleepMinutes,
      snapshot.recoveryScore,
      snapshot.strainScore,
      snapshot.restingHeartRateBpm,
      snapshot.hrvMs,
      snapshot.respiratoryRate
    ].filter((value) => value !== null).length;

    return presentCount > 0 && presentCount < 3;
  }
}
