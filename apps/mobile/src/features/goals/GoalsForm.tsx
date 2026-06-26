import { StyleSheet, View } from 'react-native';
import type { GoalImpactMode, GoalType, PrimaryGoal } from '@optime/shared-types';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/Field';
import { SelectChips } from '@/components/SelectChips';
import type { GoalRequest, GoalResponse } from '@/types/api';
import { enumOptions, getGoalImpactLabel, getGoalTypeLabel, getPrimaryGoalLabel } from '@/i18n/enum-labels';
import { useSettingsStore } from '@/store/settings-store';

export interface GoalsFormValue {
  goalType: GoalType;
  primaryGoal: PrimaryGoal;
  targetWeightKg: string;
  targetTimelineDays: string;
  impactMode: GoalImpactMode;
}

interface GoalsFormProps {
  value: GoalsFormValue;
  onChange: (value: GoalsFormValue) => void;
  validationMode?: 'onboarding' | 'standalone';
}

export const EMPTY_GOALS_FORM: GoalsFormValue = {
  goalType: 'HEALTHY_LIFESTYLE',
  primaryGoal: 'HEALTHY_EATING',
  targetWeightKg: '',
  targetTimelineDays: '',
  impactMode: 'NUTRITION_AND_TRAINING'
};

export const PRIMARY_GOAL_VALUES: PrimaryGoal[] = ['WEIGHT_LOSS', 'WEIGHT_MAINTENANCE', 'WEIGHT_GAIN', 'HEALTHY_EATING'];

export function GoalsForm({ value, onChange }: GoalsFormProps) {
  const { t } = useTranslation();
  const measurementSystem = useSettingsStore((state) => state.measurementSystem);
  const updatePrimaryGoal = (primaryGoal: PrimaryGoal) => {
    const goalType = goalTypeFromPrimaryGoal(primaryGoal);
    onChange(
      primaryGoal === 'WEIGHT_LOSS'
        ? { ...value, primaryGoal, goalType }
        : { ...value, primaryGoal, goalType, targetWeightKg: '', targetTimelineDays: '' }
    );
  };

  return (
    <View style={styles.form}>
      <SelectChips
        label={t('goals.primaryGoal')}
        value={value.primaryGoal}
        onChange={updatePrimaryGoal}
        options={enumOptions(PRIMARY_GOAL_VALUES, (item) => getPrimaryGoalLabel(t, item))}
      />
      <SelectChips
        label={t('goals.appMode')}
        value={value.impactMode}
        onChange={(impactMode) => onChange({ ...value, impactMode })}
        options={enumOptions(IMPACT_VALUES, (item) => getGoalImpactLabel(t, item))}
      />
      {value.primaryGoal === 'WEIGHT_LOSS' ? (
        <>
          <Field
            label={t('goals.targetWeight', { unit: measurementSystem === 'IMPERIAL' ? 'lb' : 'kg' })}
            keyboardType="numeric"
            value={displayWeight(value.targetWeightKg, measurementSystem)}
            onChangeText={(targetWeightKg) => onChange({ ...value, targetWeightKg: canonicalWeight(targetWeightKg, measurementSystem) })}
          />
          <Field
            label={t('goals.timeline')}
            keyboardType="numeric"
            value={value.targetTimelineDays}
            onChangeText={(targetTimelineDays) => onChange({ ...value, targetTimelineDays })}
          />
        </>
      ) : null}
    </View>
  );
}

const IMPACT_VALUES: GoalImpactMode[] = ['NUTRITION_ONLY', 'NUTRITION_AND_TRAINING'];

export function fromGoalResponse(goal: GoalResponse): GoalsFormValue {
  return {
    goalType: goal.goalType,
    primaryGoal: goal.primaryGoal ?? primaryGoalFromGoalType(goal.goalType),
    targetWeightKg: goal.targetWeightKg == null ? '' : String(goal.targetWeightKg),
    targetTimelineDays:
      goal.targetTimelineDays == null ? '' : String(goal.targetTimelineDays),
    impactMode: goal.appMode ?? goal.impactMode ?? 'NUTRITION_AND_TRAINING'
  };
}

export function toGoalRequest(value: GoalsFormValue): GoalRequest {
  if (value.primaryGoal !== 'WEIGHT_LOSS') {
    return {
      primaryGoal: value.primaryGoal,
      goalType: value.goalType,
      appMode: value.impactMode,
      impactMode: value.impactMode
    };
  }

  return {
    goalType: value.goalType,
    primaryGoal: value.primaryGoal,
    targetWeightKg: value.targetWeightKg ? Number(value.targetWeightKg) : undefined,
    targetTimelineDays: value.targetTimelineDays ? Number(value.targetTimelineDays) : undefined,
    appMode: value.impactMode,
    impactMode: value.impactMode
  };
}

export function getGoalLabel(goalType: GoalType, t: ReturnType<typeof useTranslation>['t']) {
  return getGoalTypeLabel(t, goalType);
}

export function getPrimaryGoalDisplayLabel(primaryGoal: PrimaryGoal | null | undefined, goalType: GoalType, t: ReturnType<typeof useTranslation>['t']) {
  return getPrimaryGoalLabel(t, primaryGoal ?? primaryGoalFromGoalType(goalType));
}

function goalTypeFromPrimaryGoal(primaryGoal: PrimaryGoal): GoalType {
  if (primaryGoal === 'WEIGHT_LOSS') return 'REDUCE_WEIGHT';
  if (primaryGoal === 'WEIGHT_GAIN') return 'BUILD_MUSCLE';
  return 'HEALTHY_LIFESTYLE';
}

function primaryGoalFromGoalType(goalType: GoalType): PrimaryGoal {
  if (goalType === 'REDUCE_WEIGHT') return 'WEIGHT_LOSS';
  if (goalType === 'BUILD_MUSCLE') return 'WEIGHT_GAIN';
  if (goalType === 'IMPROVE_FITNESS' || goalType === 'IMPROVE_ENDURANCE') return 'WEIGHT_MAINTENANCE';
  return 'HEALTHY_EATING';
}

function displayWeight(value: string, system: 'METRIC' | 'IMPERIAL') {
  if (system === 'METRIC' || value === '') return value;
  return String(Number((Number(value) * 2.2046226218).toFixed(1)));
}

function canonicalWeight(value: string, system: 'METRIC' | 'IMPERIAL') {
  if (system === 'METRIC' || value === '') return value;
  return String(Number((Number(value) / 2.2046226218).toFixed(4)));
}

const styles = StyleSheet.create({ form: { gap: 16 } });
