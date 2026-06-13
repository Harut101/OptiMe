import { Injectable } from '@nestjs/common';
import { GoalType, PlanQualityMode, PregnancyStatus, TrainingEquipment, TrainingOutcome } from '@prisma/client';

import { nutritionProtocols } from './nutrition-protocols';
import { recoveryProtocols } from './recovery-protocols';
import {
  NutritionProtocolId,
  ProtocolSelectionInput,
  RecoveryProtocolId,
  SelectedProtocols,
  TrainingProtocolId
} from './protocol.types';
import { trainingProtocols } from './training-protocols';

const PREGNANCY_SENSITIVE_STATUSES = new Set<PregnancyStatus>([
  PregnancyStatus.PREGNANT,
  PregnancyStatus.POSTPARTUM,
  PregnancyStatus.BREASTFEEDING
]);

@Injectable()
export class ProtocolSelectorService {
  select(input: ProtocolSelectionInput): SelectedProtocols {
    const selectionReasons: string[] = [];
    const hasPregnancySensitiveContext = PREGNANCY_SENSITIVE_STATUSES.has(
      input.profile?.pregnancyStatus ?? PregnancyStatus.UNKNOWN
    );
    const hasLimitations = (input.trainingPreference?.limitationsOrPainAreas.length ?? 0) > 0;
    const hasPainSignal =
      input.checkInSummary?.painOrDiscomfortReported ||
      input.checkInSummary?.conservativeTrainingRecommended ||
      hasLimitations;
    const hasHighTiredness =
      input.checkInSummary?.highTirednessReported ||
      ((input.checkInSummary?.recentAverageTiredness ?? 0) >= 4 && input.checkInSummary?.recentAverageTiredness !== null);
    const healthSignals = input.healthPlanningContext?.signals;
    const hasHealthRecoverySignal = Boolean(
      healthSignals?.lowSleep || healthSignals?.highActivityYesterday
    );
    const hasRecentWorkoutSignal = Boolean(healthSignals?.recentWorkout);

    const nutritionProtocolId = this.selectNutritionProtocolId({
      ...input,
      hasPregnancySensitiveContext,
      hasHighTiredness,
      selectionReasons
    });
    const trainingProtocolId = this.selectTrainingProtocolId({
      ...input,
      hasPainSignal: Boolean(hasPainSignal),
      hasHighTiredness: Boolean(hasHighTiredness),
      hasHealthRecoverySignal,
      hasRecentWorkoutSignal,
      selectionReasons
    });
    const recoveryProtocolId = this.selectRecoveryProtocolId({
      ...input,
      hasPregnancySensitiveContext,
      hasPainSignal: Boolean(hasPainSignal),
      hasHighTiredness: Boolean(hasHighTiredness),
      hasHealthRecoverySignal,
      selectionReasons
    });

    this.addHealthSelectionReasons(input, selectionReasons);
    selectionReasons.push(this.getPlanQualityReason(input.planQualityMode));

    return {
      nutritionProtocol: nutritionProtocols[nutritionProtocolId],
      trainingProtocol: trainingProtocols[trainingProtocolId],
      recoveryProtocol: recoveryProtocols[recoveryProtocolId],
      selectionReasons
    };
  }

  private selectNutritionProtocolId(
    input: ProtocolSelectionInput & {
      hasPregnancySensitiveContext: boolean;
      hasHighTiredness: boolean;
      selectionReasons: string[];
    }
  ): NutritionProtocolId {
    if (input.hasPregnancySensitiveContext) {
      input.selectionReasons.push('Pregnancy, postpartum, or breastfeeding context selects conservative nutrition.');
      return 'PREGNANCY_POSTPARTUM_SAFE';
    }

    if (input.isMinor || input.safeMode) {
      input.selectionReasons.push('Safe mode or under-18 status selects under-18 safe nutrition.');
      return 'UNDER_18_SAFE';
    }

    if (input.hasHighTiredness) {
      input.selectionReasons.push('Recent high tiredness selects recovery-day nutrition.');
      return 'RECOVERY_DAY';
    }

    if (input.goal?.goalType === GoalType.REDUCE_WEIGHT) {
      input.selectionReasons.push('Weight reduction goal selects safe weight-loss nutrition.');
      return 'SAFE_WEIGHT_LOSS';
    }

    if (
      input.goal?.goalType === GoalType.BUILD_MUSCLE ||
      input.trainingPreference?.trainingOutcome === TrainingOutcome.MUSCLE_GROWTH
    ) {
      input.selectionReasons.push('Muscle-focused goal or outcome selects muscle-support nutrition.');
      return 'MUSCLE_GAIN';
    }

    if (input.goal?.goalType === GoalType.HEALTHY_LIFESTYLE) {
      input.selectionReasons.push('Healthy lifestyle goal selects simple habit-focused nutrition.');
      return 'HEALTHY_LIFESTYLE';
    }

    input.selectionReasons.push('Default balanced plan selects maintenance nutrition.');
    return 'MAINTENANCE';
  }

  private selectTrainingProtocolId(
    input: ProtocolSelectionInput & {
      hasPainSignal: boolean;
      hasHighTiredness: boolean;
      hasHealthRecoverySignal: boolean;
      hasRecentWorkoutSignal: boolean;
      selectionReasons: string[];
    }
  ): TrainingProtocolId {
    if (input.hasPainSignal) {
      input.selectionReasons.push('Pain, discomfort, or limitations select conservative training.');
      return 'CONSERVATIVE_PAIN_LIMITATION';
    }

    if (input.noTrainingPlanned || input.trainingSchedule.length === 0) {
      input.selectionReasons.push('No planned training selects rest/light movement training guidance.');
      return 'NO_TRAINING_PLANNED';
    }

    if (input.hasHighTiredness) {
      input.selectionReasons.push('Recent high tiredness selects recovery training.');
      return 'RECOVERY';
    }

    if (input.safeMode || input.isMinor) {
      input.selectionReasons.push('Safe mode keeps training light and movement-focused.');
      return 'MOBILITY';
    }

    if (input.hasHealthRecoverySignal) {
      input.selectionReasons.push('Summarized health signals select recovery-aware training.');
      return 'RECOVERY';
    }

    if (input.hasRecentWorkoutSignal) {
      input.selectionReasons.push('Recent workout signal keeps training mobility-focused to avoid repeated overload.');
      return 'MOBILITY';
    }

    if (
      input.trainingPreference?.trainingLevel === 'BEGINNER' &&
      (input.trainingPreference.equipment.includes(TrainingEquipment.GYM) ||
        input.trainingPreference.equipment.includes(TrainingEquipment.MACHINES))
    ) {
      input.selectionReasons.push('Beginner level with gym equipment selects beginner gym training.');
      return 'BEGINNER_GYM';
    }

    if (
      input.trainingPreference?.equipment.includes(TrainingEquipment.HOME) ||
      input.trainingPreference?.equipment.includes(TrainingEquipment.BODYWEIGHT)
    ) {
      input.selectionReasons.push('Home or bodyweight equipment selects home workout guidance.');
      return 'HOME_WORKOUT';
    }

    switch (input.trainingPreference?.trainingOutcome) {
      case TrainingOutcome.MUSCLE_GROWTH:
        input.selectionReasons.push('Muscle growth outcome selects muscle growth training.');
        return 'MUSCLE_GROWTH';
      case TrainingOutcome.STRENGTH:
        input.selectionReasons.push('Strength outcome selects strength training.');
        return 'STRENGTH';
      case TrainingOutcome.ENDURANCE:
        input.selectionReasons.push('Endurance outcome selects endurance training.');
        return 'ENDURANCE';
      case TrainingOutcome.MOBILITY:
        input.selectionReasons.push('Mobility outcome selects mobility training.');
        return 'MOBILITY';
      case TrainingOutcome.GENERAL_FITNESS:
      default:
        break;
    }

    if (input.goal?.goalType === GoalType.BUILD_MUSCLE) {
      input.selectionReasons.push('Build muscle goal selects strength-oriented training.');
      return 'STRENGTH';
    }

    if (input.goal?.goalType === GoalType.IMPROVE_ENDURANCE) {
      input.selectionReasons.push('Endurance goal selects endurance training.');
      return 'ENDURANCE';
    }

    input.selectionReasons.push('Default active plan selects mobility and general movement guidance.');
    return 'MOBILITY';
  }

  private selectRecoveryProtocolId(
    input: ProtocolSelectionInput & {
      hasPregnancySensitiveContext: boolean;
      hasPainSignal: boolean;
      hasHighTiredness: boolean;
      hasHealthRecoverySignal: boolean;
      selectionReasons: string[];
    }
  ): RecoveryProtocolId {
    if (input.hasPregnancySensitiveContext) {
      input.selectionReasons.push('Pregnancy, postpartum, or breastfeeding context selects conservative recovery.');
      return 'PREGNANCY_POSTPARTUM_CONSERVATIVE';
    }

    if (input.hasPainSignal) {
      input.selectionReasons.push('Pain or discomfort signal selects pain-aware recovery.');
      return 'PAIN_OR_DISCOMFORT';
    }

    if (input.noTrainingPlanned || input.trainingSchedule.length === 0) {
      input.selectionReasons.push('No planned training selects rest-day recovery.');
      return 'REST_DAY';
    }

    if (input.hasHighTiredness) {
      input.selectionReasons.push('Recent high tiredness selects high-tiredness recovery.');
      return 'HIGH_TIREDNESS';
    }

    if (input.hasHealthRecoverySignal) {
      input.selectionReasons.push('Summarized low sleep or high activity selects recovery-aware recovery.');
      return 'HIGH_TIREDNESS';
    }

    input.selectionReasons.push('No acute recovery signal selects normal recovery.');
    return 'NORMAL_RECOVERY';
  }

  private addHealthSelectionReasons(input: ProtocolSelectionInput, selectionReasons: string[]) {
    const healthContext = input.healthPlanningContext;

    if (!healthContext?.available) {
      return;
    }

    selectionReasons.push(...healthContext.selectionNotes);

    if (healthContext.signals.lowStepTrend) {
      selectionReasons.push('Low recent step trend adds gentle movement guidance without shame.');
    }
  }

  private getPlanQualityReason(planQualityMode: PlanQualityMode) {
    switch (planQualityMode) {
      case PlanQualityMode.ADAPTIVE:
        return 'PlanQualityMode ADAPTIVE increases explanation depth and use of history without changing safety rules.';
      case PlanQualityMode.PERSONALIZED:
        return 'PlanQualityMode PERSONALIZED increases preference detail without changing safety rules.';
      case PlanQualityMode.BASIC:
      default:
        return 'PlanQualityMode BASIC keeps protocol explanation concise without changing safety rules.';
    }
  }
}
