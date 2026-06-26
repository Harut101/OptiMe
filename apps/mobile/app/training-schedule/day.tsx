import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type {
  DayOfWeek,
  ExerciseEquipment,
  TargetMuscleGroup,
  TrainingEnvironment,
  TrainingScheduleDayRequest,
  TrainingScheduleOverrideMode
} from '@optime/shared-types';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { MultiSelectChips } from '@/components/MultiSelectChips';
import { Screen } from '@/components/Screen';
import { SelectChips } from '@/components/SelectChips';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { BodyMapSelector } from '@/features/body-map/BodyMapSelector';
import { ORDERED_DAYS } from '@/features/training-schedule/weekly-schedule';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import {
  enumOptions,
  getDayOfWeekLabel,
  getExerciseEquipmentLabel,
  getTrainingEnvironmentLabel
} from '@/i18n/enum-labels';
import { isDraftDirty } from '@/features/editor/draft-state';
import { useTrainingScheduleDraftStore } from '@/store/training-schedule-draft-store';
import { colors } from '@/theme/colors';

const ENVIRONMENTS: TrainingEnvironment[] = ['HOME', 'GYM', 'OUTDOOR'];
const EQUIPMENT: ExerciseEquipment[] = [
  'BODYWEIGHT',
  'DUMBBELLS',
  'BARBELL',
  'BENCH',
  'MACHINES',
  'CABLE_MACHINE',
  'PULL_UP_BAR',
  'KETTLEBELL',
  'RESISTANCE_BANDS',
  'CARDIO_MACHINE'
];

export default function TrainingScheduleDayScreen() {
  const { t } = useTranslation();
  const { dayOfWeek } = useLocalSearchParams<{ dayOfWeek?: DayOfWeek }>();
  const draft = useTrainingScheduleDraftStore((state) => state.draft);
  const updateDay = useTrainingScheduleDraftStore((state) => state.updateDay);
  const initialDay = draft?.days.find((item) => item.dayOfWeek === dayOfWeek);
  const [value, setValue] = useState<TrainingScheduleDayRequest | null>(initialDay ?? null);

  useEffect(() => {
    setValue(initialDay ?? null);
  }, [initialDay]);

  const dirty = Boolean(value && initialDay && isDraftDirty(value, initialDay));
  useUnsavedChangesGuard(dirty);

  if (!dayOfWeek || !ORDERED_DAYS.includes(dayOfWeek) || !value) {
    return <Screen><StateBlock title={t('schedule.dayUnavailable')} message={t('errors.unableLoad')} /></Screen>;
  }

  return (
    <Screen>
      <Text variant="heading">{getDayOfWeekLabel(t, dayOfWeek)}</Text>
      <Text variant="muted">{t('schedule.dayEditorHelp')}</Text>

      <SelectChips
        label={t('schedule.dayType')}
        value={value.isTrainingDay ? 'training' : 'rest'}
        onChange={(next) => setValue({ ...value, isTrainingDay: next === 'training' })}
        options={[
          { label: t('schedule.trainingDay'), value: 'training' },
          { label: t('schedule.restDay'), value: 'rest' }
        ]}
      />

      {value.isTrainingDay ? (
        <>
          <OverrideMode
            label={t('schedule.muscleFocus')}
            value={value.targetMusclesMode}
            onChange={(targetMusclesMode) => setValue({ ...value, targetMusclesMode })}
          />
          {value.targetMusclesMode === 'CUSTOM' ? (
            <Card>
              <Text variant="label">{t('schedule.customMuscleFocus')}</Text>
              <Text variant="muted">{t('training.targetHelp')}</Text>
              <BodyMapSelector
                value={(value.targetMuscles ?? []) as TargetMuscleGroup[]}
                onChange={(targetMuscles) => setValue({ ...value, targetMuscles })}
              />
            </Card>
          ) : null}

          <OverrideMode
            label={t('schedule.location')}
            value={value.environmentMode}
            onChange={(environmentMode) => setValue({ ...value, environmentMode })}
          />
          {value.environmentMode === 'CUSTOM' ? (
            <SelectChips
              label={t('schedule.location')}
              value={value.environment ?? 'HOME'}
              onChange={(environment) => setValue({ ...value, environment })}
              options={enumOptions(ENVIRONMENTS, (item) => getTrainingEnvironmentLabel(t, item))}
            />
          ) : null}

          <OverrideMode
            label={t('schedule.equipment')}
            value={value.equipmentMode}
            onChange={(equipmentMode) => setValue({ ...value, equipmentMode })}
          />
          {value.equipmentMode === 'CUSTOM' ? (
            <MultiSelectChips
              label={t('schedule.equipment')}
              value={(value.availableEquipment ?? []) as ExerciseEquipment[]}
              onChange={(availableEquipment) => setValue({ ...value, availableEquipment })}
              options={enumOptions(EQUIPMENT, (item) => getExerciseEquipmentLabel(t, item))}
            />
          ) : null}
          {value.equipmentMode === 'CUSTOM' && (value.availableEquipment ?? []).length === 0 ? (
            <Text variant="muted">{t('schedule.noOptionalEquipment')}</Text>
          ) : null}

          <OverrideMode
            label={t('schedule.duration')}
            value={value.durationMode}
            onChange={(durationMode) => setValue({ ...value, durationMode })}
          />
          {value.durationMode === 'CUSTOM' ? (
            <Field
              label={t('schedule.durationMinutes')}
              keyboardType="numeric"
              value={value.durationMinutes ? String(value.durationMinutes) : ''}
              onChangeText={(text) => setValue({ ...value, durationMinutes: Number(text) || null })}
            />
          ) : null}
        </>
      ) : (
        <Card>
          <Text variant="label">{t('schedule.restDay')}</Text>
          <Text variant="muted">{t('schedule.restDayHelp')}</Text>
        </Card>
      )}

      <View style={styles.actions}>
        <Button
          title={t('common.save')}
          disabled={!dirty}
          onPress={() => {
            updateDay(value);
            router.back();
          }}
        />
        <Button title={t('common.cancel')} variant="secondary" onPress={() => router.back()} />
      </View>
      {value.equipmentMode === 'CUSTOM' ? (
        <Text style={styles.note}>{t('schedule.equipmentRule')}</Text>
      ) : null}
    </Screen>
  );
}

function OverrideMode({
  label,
  value,
  onChange
}: {
  label: string;
  value: TrainingScheduleOverrideMode;
  onChange: (value: TrainingScheduleOverrideMode) => void;
}) {
  const { t } = useTranslation();
  return (
    <SelectChips
      label={label}
      value={value}
      onChange={onChange}
      options={[
        { label: t('schedule.useDefault'), value: 'USE_DEFAULT' },
        { label: t('schedule.customizeForDay'), value: 'CUSTOM' }
      ]}
    />
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  note: { color: colors.muted, fontSize: 13 }
});
