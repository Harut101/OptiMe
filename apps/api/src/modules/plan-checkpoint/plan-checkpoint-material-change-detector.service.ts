import { Injectable } from '@nestjs/common';
import {
  EvaluatePlanCheckpointRequest,
  EvaluatePlanCheckpointResponse,
  PlanCheckpointFacts,
  PlanCheckpointReasonCode,
  PlanImpactSection,
  PlanImpactSeverity
} from '@optime/shared-types';

import {
  WEARABLE_HIGH_ACTIVITY_STEPS,
  WEARABLE_LOW_SLEEP_MINUTES
} from '../health/wearable-planning-context.resolver';

export const PLAN_CHECKPOINT_THRESHOLDS = {
  sleepDecreaseMinutes: 90,
  stepsIncrease: 6000,
  activeCaloriesIncreaseKcal: 500,
  workoutMinutesIncrease: 30,
  lowEnergyLevel: 3,
  highTirednessLevel: 8,
  highSorenessLevel: 8,
  checkInLevelChange: 3
} as const;

const SEVERITY_ORDER: Record<PlanImpactSeverity, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  SAFETY_CRITICAL: 4
};

interface MaterialChange {
  reasonCode: PlanCheckpointReasonCode;
  severity: PlanImpactSeverity;
  affectedSections: PlanImpactSection[];
  requiresSafetyReview?: boolean;
}

@Injectable()
export class PlanCheckpointMaterialChangeDetectorService {
  evaluate(input: EvaluatePlanCheckpointRequest): EvaluatePlanCheckpointResponse {
    const changes = [
      ...this.detectSafetyChanges(input.baseline, input.current),
      ...this.detectSleepChanges(input.baseline, input.current),
      ...this.detectActivityChanges(input.baseline, input.current),
      ...this.detectProgressChanges(input.baseline, input.current),
      ...this.detectCheckInChanges(input.baseline, input.current)
    ];

    const reasonCodes = this.unique(changes.map((change) => change.reasonCode));
    const affectedSections = this.unique(
      changes.flatMap((change) => change.affectedSections)
    );
    const materialChangeDetected = reasonCodes.length > 0;

    return {
      trigger: input.trigger,
      materialChangeDetected,
      reviewRecommended: materialChangeDetected,
      requiresSafetyReview: changes.some((change) => change.requiresSafetyReview === true),
      severity: this.maxSeverity(changes.map((change) => change.severity)),
      affectedSections,
      reasonCodes
    };
  }

  private detectSafetyChanges(
    baseline: PlanCheckpointFacts,
    current: PlanCheckpointFacts
  ): MaterialChange[] {
    const changes: MaterialChange[] = [];
    const safetySections: PlanImpactSection[] = ['TRAINING_PLAN', 'RECOVERY', 'SAFETY'];

    if (!baseline.safetySignals.painOrLimitation && current.safetySignals.painOrLimitation) {
      changes.push({
        reasonCode: 'NEW_PAIN_OR_LIMITATION',
        severity: 'SAFETY_CRITICAL',
        affectedSections: safetySections,
        requiresSafetyReview: true
      });
    }

    if (!baseline.safetySignals.illness && current.safetySignals.illness) {
      changes.push({
        reasonCode: 'NEW_ILLNESS_SIGNAL',
        severity: 'SAFETY_CRITICAL',
        affectedSections: safetySections,
        requiresSafetyReview: true
      });
    }

    if (!baseline.safetySignals.dizziness && current.safetySignals.dizziness) {
      changes.push({
        reasonCode: 'NEW_DIZZINESS_SIGNAL',
        severity: 'SAFETY_CRITICAL',
        affectedSections: safetySections,
        requiresSafetyReview: true
      });
    }

    if (!baseline.safetySignals.exhaustion && current.safetySignals.exhaustion) {
      changes.push({
        reasonCode: 'NEW_EXHAUSTION_SIGNAL',
        severity: 'HIGH',
        affectedSections: safetySections,
        requiresSafetyReview: true
      });
    }

    return changes;
  }

  private detectSleepChanges(
    baseline: PlanCheckpointFacts,
    current: PlanCheckpointFacts
  ): MaterialChange[] {
    const currentSleep = current.health.sleepMinutes;
    const baselineSleep = baseline.health.sleepMinutes;

    if (currentSleep === null) {
      return [];
    }

    const changes: MaterialChange[] = [];
    const sleepSections: PlanImpactSection[] = [
      'TRAINING_PLAN',
      'RECOVERY',
      'WEARABLE_CONTEXT'
    ];

    if (
      currentSleep < WEARABLE_LOW_SLEEP_MINUTES &&
      (baselineSleep === null || baselineSleep >= WEARABLE_LOW_SLEEP_MINUTES)
    ) {
      changes.push({
        reasonCode: 'LOW_SLEEP_DETECTED',
        severity: 'HIGH',
        affectedSections: sleepSections
      });
    }

    if (
      baselineSleep !== null &&
      baselineSleep - currentSleep >= PLAN_CHECKPOINT_THRESHOLDS.sleepDecreaseMinutes
    ) {
      changes.push({
        reasonCode: 'SLEEP_DECREASED',
        severity: 'MEDIUM',
        affectedSections: sleepSections
      });
    }

    return changes;
  }

  private detectActivityChanges(
    baseline: PlanCheckpointFacts,
    current: PlanCheckpointFacts
  ): MaterialChange[] {
    const changes: MaterialChange[] = [];
    const activitySections: PlanImpactSection[] = [
      'NUTRITION_TARGET',
      'TRAINING_PLAN',
      'RECOVERY',
      'WEARABLE_CONTEXT'
    ];
    const crossedHighSteps =
      current.health.steps !== null &&
      current.health.steps >= WEARABLE_HIGH_ACTIVITY_STEPS &&
      (baseline.health.steps === null || baseline.health.steps < WEARABLE_HIGH_ACTIVITY_STEPS);

    if (crossedHighSteps) {
      changes.push({
        reasonCode: 'HIGH_ACTIVITY_DETECTED',
        severity: 'MEDIUM',
        affectedSections: activitySections
      });
    }

    if (
      this.increasedBy(
        baseline.health.steps,
        current.health.steps,
        PLAN_CHECKPOINT_THRESHOLDS.stepsIncrease
      ) ||
      this.increasedBy(
        baseline.health.activeCaloriesKcal,
        current.health.activeCaloriesKcal,
        PLAN_CHECKPOINT_THRESHOLDS.activeCaloriesIncreaseKcal
      )
    ) {
      changes.push({
        reasonCode: 'ACTIVITY_INCREASED',
        severity: 'MEDIUM',
        affectedSections: activitySections
      });
    }

    if (
      this.increasedBy(
        baseline.health.workoutMinutes,
        current.health.workoutMinutes,
        PLAN_CHECKPOINT_THRESHOLDS.workoutMinutesIncrease
      )
    ) {
      changes.push({
        reasonCode: 'WORKOUT_LOAD_INCREASED',
        severity: 'MEDIUM',
        affectedSections: activitySections
      });
    }

    return changes;
  }

  private detectProgressChanges(
    baseline: PlanCheckpointFacts,
    current: PlanCheckpointFacts
  ): MaterialChange[] {
    const changes: MaterialChange[] = [];

    if (current.progress.skippedMeals > baseline.progress.skippedMeals) {
      changes.push({
        reasonCode: 'MEAL_SKIPPED',
        severity: 'LOW',
        affectedSections: ['FOOD_PLAN', 'REMINDERS']
      });
    }

    if (
      baseline.progress.workoutStatus !== 'COMPLETED' &&
      current.progress.workoutStatus === 'COMPLETED'
    ) {
      changes.push({
        reasonCode: 'WORKOUT_COMPLETED',
        severity: 'MEDIUM',
        affectedSections: ['TRAINING_PLAN', 'RECOVERY']
      });
    }

    return changes;
  }

  private detectCheckInChanges(
    baseline: PlanCheckpointFacts,
    current: PlanCheckpointFacts
  ): MaterialChange[] {
    const changes: MaterialChange[] = [];
    const trainingRecoverySections: PlanImpactSection[] = ['TRAINING_PLAN', 'RECOVERY'];

    if (
      this.crossedLowOrDropped(
        baseline.checkIn.energyLevel,
        current.checkIn.energyLevel,
        PLAN_CHECKPOINT_THRESHOLDS.lowEnergyLevel
      )
    ) {
      changes.push({
        reasonCode: 'LOW_ENERGY_REPORTED',
        severity: 'MEDIUM',
        affectedSections: trainingRecoverySections
      });
    }

    if (
      this.crossedHighOrIncreased(
        baseline.checkIn.tirednessLevel,
        current.checkIn.tirednessLevel,
        PLAN_CHECKPOINT_THRESHOLDS.highTirednessLevel
      )
    ) {
      changes.push({
        reasonCode: 'HIGH_TIREDNESS_REPORTED',
        severity: 'HIGH',
        affectedSections: trainingRecoverySections
      });
    }

    if (
      this.crossedHighOrIncreased(
        baseline.checkIn.sorenessLevel,
        current.checkIn.sorenessLevel,
        PLAN_CHECKPOINT_THRESHOLDS.highSorenessLevel
      )
    ) {
      changes.push({
        reasonCode: 'HIGH_SORENESS_REPORTED',
        severity: 'HIGH',
        affectedSections: trainingRecoverySections
      });
    }

    return changes;
  }

  private increasedBy(
    baseline: number | null,
    current: number | null,
    threshold: number
  ) {
    return baseline !== null && current !== null && current - baseline >= threshold;
  }

  private crossedLowOrDropped(
    baseline: number | null,
    current: number | null,
    lowThreshold: number
  ) {
    if (current === null) return false;
    if (baseline === null) return current <= lowThreshold;

    return (
      (baseline > lowThreshold && current <= lowThreshold) ||
      (baseline - current >= PLAN_CHECKPOINT_THRESHOLDS.checkInLevelChange && current <= 5)
    );
  }

  private crossedHighOrIncreased(
    baseline: number | null,
    current: number | null,
    highThreshold: number
  ) {
    if (current === null) return false;
    if (baseline === null) return current >= highThreshold;

    return (
      (baseline < highThreshold && current >= highThreshold) ||
      (current - baseline >= PLAN_CHECKPOINT_THRESHOLDS.checkInLevelChange && current >= 6)
    );
  }

  private maxSeverity(severities: PlanImpactSeverity[]): PlanImpactSeverity {
    return severities.reduce<PlanImpactSeverity>(
      (highest, severity) =>
        SEVERITY_ORDER[severity] > SEVERITY_ORDER[highest] ? severity : highest,
      'NONE'
    );
  }

  private unique<T>(items: T[]): T[] {
    return Array.from(new Set(items));
  }
}
