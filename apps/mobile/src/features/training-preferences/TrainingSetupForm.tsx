import { StyleSheet, View } from 'react-native';
import type {
  TargetMuscleGroup,
  TrainingEquipment,
  TrainingLevel,
  TrainingOutcome,
  TrainingPreferenceResponse
} from '@optime/shared-types';
import { useTranslation } from 'react-i18next';

import { MultiSelectChips } from '@/components/MultiSelectChips';
import { SelectChips } from '@/components/SelectChips';
import { Text } from '@/components/Text';
import type { TrainingPreferencesRequest } from '@/types/api';
import { enumOptions, getEquipmentLabel, getTrainingLevelLabel, getTrainingOutcomeLabel } from '@/i18n/enum-labels';

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
  const { t } = useTranslation();
  return (
    <View style={styles.form}>
      <SelectChips
        label={t('training.trainingFocus')}
        value={value.trainingOutcome ?? ('' as TrainingOutcome)}
        onChange={(trainingOutcome) => onChange({ ...value, trainingOutcome })}
        options={enumOptions(OUTCOMES, (item) => getTrainingOutcomeLabel(t, item))}
      />
      <SelectChips
        label={t('training.experienceLevel')}
        value={value.trainingLevel ?? ('' as TrainingLevel)}
        onChange={(trainingLevel) => onChange({ ...value, trainingLevel })}
        options={enumOptions(LEVELS, (item) => getTrainingLevelLabel(t, item))}
      />
      <MultiSelectChips
        label={t('training.defaultEquipment')}
        value={value.equipment}
        onChange={(equipment) => onChange({ ...value, equipment })}
        options={enumOptions(EQUIPMENT, (item) => getEquipmentLabel(t, item))}
      />
      <Text variant="muted">
        {t('training.scheduleHelp')}
      </Text>
    </View>
  );
}

const OUTCOMES: TrainingOutcome[] = ['GENERAL_FITNESS', 'STRENGTH', 'MUSCLE_GROWTH', 'ENDURANCE', 'MOBILITY'];
const LEVELS: TrainingLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const EQUIPMENT: TrainingEquipment[] = ['DUMBBELLS', 'BODYWEIGHT', 'MACHINES'];

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
    value.trainingOutcome || value.equipment.length || value.trainingLevel
  );
}

function splitList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

const styles = StyleSheet.create({ form: { gap: 16 } });
