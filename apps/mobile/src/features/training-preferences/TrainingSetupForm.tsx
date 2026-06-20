import { StyleSheet, View } from 'react-native';
import type {
  TargetMuscleGroup,
  TrainingEquipment,
  TrainingLevel,
  TrainingOutcome,
  TrainingPreferenceResponse
} from '@optime/shared-types';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { MultiSelectChips } from '@/components/MultiSelectChips';
import { SelectChips } from '@/components/SelectChips';
import { Text } from '@/components/Text';
import { BodyMapSelector } from '@/features/body-map/BodyMapSelector';
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
  const dayOptions = DAY_KEYS.map((key, value) => ({ label: t(`enums.weekdays.${key}` as never), value }));
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
        label={t('training.environmentEquipment')}
        value={value.equipment}
        onChange={(equipment) => onChange({ ...value, equipment })}
        options={enumOptions(EQUIPMENT, (item) => getEquipmentLabel(t, item))}
      />
      <MultiSelectChips
        label={t('training.preferredDays')}
        value={value.preferredTrainingDays}
        onChange={(preferredTrainingDays) => onChange({ ...value, preferredTrainingDays })}
        options={dayOptions}
      />
      <Card>
        <Text variant="label">{t('training.targetMuscles')}</Text>
        <Text variant="muted">
          {t('training.targetHelp')}
        </Text>
        <BodyMapSelector
          value={value.targetMuscleGroups}
          onChange={(targetMuscleGroups) => onChange({ ...value, targetMuscleGroups })}
        />
      </Card>
      <Field
        label={t('training.limitationsLabel')}
        placeholder={t('training.limitationsPlaceholder')}
        multiline
        value={value.limitationsOrPainAreas}
        onChangeText={(limitationsOrPainAreas) =>
          onChange({ ...value, limitationsOrPainAreas })
        }
      />
      <Text variant="muted">
        {t('training.scheduleHelp')}
      </Text>
    </View>
  );
}

const OUTCOMES: TrainingOutcome[] = ['GENERAL_FITNESS', 'STRENGTH', 'MUSCLE_GROWTH', 'ENDURANCE', 'MOBILITY'];
const LEVELS: TrainingLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const EQUIPMENT: TrainingEquipment[] = ['GYM', 'HOME', 'DUMBBELLS', 'BODYWEIGHT', 'MACHINES'];
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

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
