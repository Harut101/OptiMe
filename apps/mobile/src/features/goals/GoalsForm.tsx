import { StyleSheet, View } from 'react-native';
import type { GoalImpactMode, GoalType } from '@optime/shared-types';

import { Field } from '@/components/Field';
import { SelectChips } from '@/components/SelectChips';
import type { GoalRequest, GoalResponse } from '@/types/api';

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

export const GOAL_OPTIONS: Array<{ label: string; value: GoalType }> = [
  { label: 'Healthy lifestyle', value: 'HEALTHY_LIFESTYLE' },
  { label: 'Improve fitness', value: 'IMPROVE_FITNESS' },
  { label: 'Build muscle', value: 'BUILD_MUSCLE' },
  { label: 'Improve endurance', value: 'IMPROVE_ENDURANCE' },
  { label: 'Reduce weight safely', value: 'REDUCE_WEIGHT' }
];

export function GoalsForm({ value, onChange }: GoalsFormProps) {
  const updateGoalType = (goalType: GoalType) =>
    onChange(
      goalType === 'REDUCE_WEIGHT'
        ? { ...value, goalType }
        : { ...value, goalType, targetWeightKg: '', targetTimelineDays: '' }
    );

  return (
    <View style={styles.form}>
      <SelectChips
        label="Goal"
        value={value.goalType}
        onChange={updateGoalType}
        options={GOAL_OPTIONS}
      />
      {value.goalType === 'REDUCE_WEIGHT' ? (
        <>
          <Field
            label="Target weight (kg)"
            keyboardType="numeric"
            value={value.targetWeightKg}
            onChangeText={(targetWeightKg) => onChange({ ...value, targetWeightKg })}
          />
          <Field
            label="Timeline (days)"
            keyboardType="numeric"
            value={value.targetTimelineDays}
            onChangeText={(targetTimelineDays) => onChange({ ...value, targetTimelineDays })}
          />
          <SelectChips
            label="Adjust through"
            value={value.impactMode}
            onChange={(impactMode) => onChange({ ...value, impactMode })}
            options={IMPACT_OPTIONS}
          />
        </>
      ) : null}
    </View>
  );
}

const IMPACT_OPTIONS: Array<{ label: string; value: GoalImpactMode }> = [
  { label: 'Nutrition only', value: 'NUTRITION_ONLY' },
  { label: 'Nutrition + training', value: 'NUTRITION_AND_TRAINING' }
];

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

export function getGoalLabel(goalType: GoalType) {
  return GOAL_OPTIONS.find((option) => option.value === goalType)?.label ?? goalType;
}

const styles = StyleSheet.create({ form: { gap: 16 } });
