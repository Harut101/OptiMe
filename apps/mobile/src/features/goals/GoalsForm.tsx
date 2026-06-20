import { StyleSheet, View } from 'react-native';
import type { GoalImpactMode, GoalType } from '@optime/shared-types';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/Field';
import { SelectChips } from '@/components/SelectChips';
import type { GoalRequest, GoalResponse } from '@/types/api';
import { enumOptions, getGoalImpactLabel, getGoalTypeLabel } from '@/i18n/enum-labels';
import { useSettingsStore } from '@/store/settings-store';

export interface GoalsFormValue {
  goalType: GoalType;
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
  goalType: 'IMPROVE_FITNESS',
  targetWeightKg: '',
  targetTimelineDays: '',
  impactMode: 'NUTRITION_AND_TRAINING'
};

export const GOAL_VALUES: GoalType[] = ['HEALTHY_LIFESTYLE', 'IMPROVE_FITNESS', 'BUILD_MUSCLE', 'IMPROVE_ENDURANCE', 'REDUCE_WEIGHT'];

export function GoalsForm({ value, onChange }: GoalsFormProps) {
  const { t } = useTranslation();
  const measurementSystem = useSettingsStore((state) => state.measurementSystem);
  const updateGoalType = (goalType: GoalType) =>
    onChange(
      goalType === 'REDUCE_WEIGHT'
        ? { ...value, goalType }
        : { ...value, goalType, targetWeightKg: '', targetTimelineDays: '' }
    );

  return (
    <View style={styles.form}>
      <SelectChips
        label={t('goals.goal')}
        value={value.goalType}
        onChange={updateGoalType}
        options={enumOptions(GOAL_VALUES, (item) => getGoalTypeLabel(t, item))}
      />
      {value.goalType === 'REDUCE_WEIGHT' ? (
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
          <SelectChips
            label={t('goals.adjustThrough')}
            value={value.impactMode}
            onChange={(impactMode) => onChange({ ...value, impactMode })}
            options={enumOptions(IMPACT_VALUES, (item) => getGoalImpactLabel(t, item))}
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
    targetWeightKg: goal.targetWeightKg == null ? '' : String(goal.targetWeightKg),
    targetTimelineDays:
      goal.targetTimelineDays == null ? '' : String(goal.targetTimelineDays),
    impactMode: goal.impactMode ?? 'NUTRITION_AND_TRAINING'
  };
}

export function toGoalRequest(value: GoalsFormValue): GoalRequest {
  if (value.goalType !== 'REDUCE_WEIGHT') {
    return { goalType: value.goalType };
  }

  return {
    goalType: value.goalType,
    targetWeightKg: value.targetWeightKg ? Number(value.targetWeightKg) : undefined,
    targetTimelineDays: value.targetTimelineDays ? Number(value.targetTimelineDays) : undefined,
    impactMode: value.impactMode
  };
}

export function getGoalLabel(goalType: GoalType, t: ReturnType<typeof useTranslation>['t']) {
  return getGoalTypeLabel(t, goalType);
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
