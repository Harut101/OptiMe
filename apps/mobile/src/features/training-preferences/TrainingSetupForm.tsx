import { StyleSheet, View } from 'react-native';
import type {
  TargetMuscleGroup,
  TrainingEquipment,
  TrainingLevel,
  TrainingOutcome,
  TrainingPreferenceResponse
} from '@optime/shared-types';

import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { MultiSelectChips } from '@/components/MultiSelectChips';
import { SelectChips } from '@/components/SelectChips';
import { Text } from '@/components/Text';
import { BodyMapSelector } from '@/features/body-map/BodyMapSelector';
import type { TrainingPreferencesRequest } from '@/types/api';

export interface TrainingSetupFormValue {
  targetMuscleGroups: TargetMuscleGroup[];
  trainingOutcome: TrainingOutcome | null;
  equipment: TrainingEquipment[];
  trainingLevel: TrainingLevel | null;
  limitationsOrPainAreas: string;
  preferredTrainingDays: number[];
}

interface TrainingSetupFormProps {
  value: TrainingSetupFormValue;
  onChange: (value: TrainingSetupFormValue) => void;
}

export const EMPTY_TRAINING_SETUP: TrainingSetupFormValue = {
  targetMuscleGroups: [],
  trainingOutcome: null,
  equipment: [],
  trainingLevel: null,
  limitationsOrPainAreas: '',
  preferredTrainingDays: []
};

export function TrainingSetupForm({ value, onChange }: TrainingSetupFormProps) {
  return (
    <View style={styles.form}>
      <SelectChips
        label="Training focus"
        value={value.trainingOutcome ?? ('' as TrainingOutcome)}
        onChange={(trainingOutcome) => onChange({ ...value, trainingOutcome })}
        options={OUTCOME_OPTIONS}
      />
      <SelectChips
        label="Experience level"
        value={value.trainingLevel ?? ('' as TrainingLevel)}
        onChange={(trainingLevel) => onChange({ ...value, trainingLevel })}
        options={LEVEL_OPTIONS}
      />
      <MultiSelectChips
        label="Environment and equipment"
        value={value.equipment}
        onChange={(equipment) => onChange({ ...value, equipment })}
        options={EQUIPMENT_OPTIONS}
      />
      <MultiSelectChips
        label="Preferred training days"
        value={value.preferredTrainingDays}
        onChange={(preferredTrainingDays) => onChange({ ...value, preferredTrainingDays })}
        options={DAY_OPTIONS}
      />
      <Card>
        <Text variant="label">Target muscles</Text>
        <Text variant="muted">
          Select muscles you want to train. Pain and limitations belong in the separate field below.
        </Text>
        <BodyMapSelector
          value={value.targetMuscleGroups}
          onChange={(targetMuscleGroups) => onChange({ ...value, targetMuscleGroups })}
        />
      </Card>
      <Field
        label="Limitations or pain areas"
        placeholder="Separate items with commas"
        multiline
        value={value.limitationsOrPainAreas}
        onChangeText={(limitationsOrPainAreas) =>
          onChange({ ...value, limitationsOrPainAreas })
        }
      />
      <Text variant="muted">
        Workout type, duration, and frequency are also informed by your weekly schedule below.
      </Text>
    </View>
  );
}

const OUTCOME_OPTIONS: Array<{ label: string; value: TrainingOutcome }> = [
  { label: 'General fitness', value: 'GENERAL_FITNESS' },
  { label: 'Strength', value: 'STRENGTH' },
  { label: 'Muscle growth', value: 'MUSCLE_GROWTH' },
  { label: 'Endurance', value: 'ENDURANCE' },
  { label: 'Mobility', value: 'MOBILITY' }
];

const LEVEL_OPTIONS: Array<{ label: string; value: TrainingLevel }> = [
  { label: 'Beginner', value: 'BEGINNER' },
  { label: 'Intermediate', value: 'INTERMEDIATE' },
  { label: 'Advanced', value: 'ADVANCED' }
];

const EQUIPMENT_OPTIONS: Array<{ label: string; value: TrainingEquipment }> = [
  { label: 'Gym', value: 'GYM' },
  { label: 'Home', value: 'HOME' },
  { label: 'Dumbbells', value: 'DUMBBELLS' },
  { label: 'Bodyweight', value: 'BODYWEIGHT' },
  { label: 'Machines', value: 'MACHINES' }
];

const DAY_OPTIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, value) => ({
  label,
  value
}));

export function fromTrainingPreference(
  preference: TrainingPreferenceResponse
): TrainingSetupFormValue {
  return {
    ...preference,
    limitationsOrPainAreas: preference.limitationsOrPainAreas.join(', ')
  };
}

export function toTrainingPreferenceRequest(
  value: TrainingSetupFormValue
): TrainingPreferencesRequest {
  return {
    targetMuscleGroups: value.targetMuscleGroups,
    trainingOutcome: value.trainingOutcome,
    equipment: value.equipment,
    trainingLevel: value.trainingLevel,
    limitationsOrPainAreas: splitList(value.limitationsOrPainAreas),
    preferredTrainingDays: value.preferredTrainingDays
  };
}

export function hasTrainingSetup(value: TrainingSetupFormValue) {
  return Boolean(
    value.targetMuscleGroups.length || value.trainingOutcome || value.equipment.length ||
    value.trainingLevel || value.limitationsOrPainAreas.trim() || value.preferredTrainingDays.length
  );
}

function splitList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

const styles = StyleSheet.create({ form: { gap: 16 } });
