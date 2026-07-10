import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type {
  DailyTrainingOverrideRequest,
  DayOfWeek,
  ExerciseEquipment,
  TargetMuscleGroup,
  TrainingEnvironment
} from '@optime/shared-types';

import { getTrainingSchedule } from '@/api/training-schedule';
import { getTrainingOverride, saveTrainingOverride } from '@/api/training-overrides';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { MultiSelectChips } from '@/components/MultiSelectChips';
import { Screen } from '@/components/Screen';
import { ScreenSkeleton } from '@/components/ScreenSkeleton';
import { SelectChips } from '@/components/SelectChips';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { BodyMapSelector } from '@/features/body-map/BodyMapSelector';
import { getLocalDateString } from '@/features/training-overrides/local-date';
import { ORDERED_DAYS } from '@/features/training-schedule/weekly-schedule';
import {
  enumOptions,
  getDayOfWeekLabel,
  getExerciseEquipmentLabel,
  getTrainingEnvironmentLabel
} from '@/i18n/enum-labels';
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

type EditorValue = {
  isTrainingDay: boolean;
  targetMuscles: TargetMuscleGroup[];
  environment: TrainingEnvironment | null;
  availableEquipment: ExerciseEquipment[];
  durationMinutes: number | null;
  protocolPreference: string | null;
};

export default function DailyTrainingOverrideDayScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { localDate, dayOfWeek, returnToGenerate } = useLocalSearchParams<{
    localDate?: string;
    dayOfWeek?: DayOfWeek;
    returnToGenerate?: string;
  }>();
  const effectiveLocalDate = localDate ?? getLocalDateString();
  const effectiveDayOfWeek = dayOfWeek && ORDERED_DAYS.includes(dayOfWeek)
    ? dayOfWeek
    : getTodayDayOfWeek();
  const schedule = useQuery({ queryKey: ['training-schedule'], queryFn: getTrainingSchedule });
  const override = useQuery({
    queryKey: ['training-override', effectiveLocalDate],
    queryFn: () => getTrainingOverride(effectiveLocalDate)
  });
  const [value, setValue] = useState<EditorValue | null>(null);
  const saveOverride = useMutation({
    mutationFn: (body: DailyTrainingOverrideRequest) => saveTrainingOverride(effectiveLocalDate, body),
    onSuccess: async (saved) => {
      queryClient.setQueryData(['training-override', effectiveLocalDate], saved);
      await queryClient.invalidateQueries({ queryKey: ['training-override', effectiveLocalDate] });
      await queryClient.invalidateQueries({ queryKey: ['training-schedule'] });
      await queryClient.invalidateQueries({ queryKey: ['nutrition-target-preview'] });

      if (returnToGenerate === '1') {
        router.replace({
          pathname: '/(tabs)/today' as never,
          params: { generateAfterOverride: '1' }
        });
        return;
      }

      router.back();
    },
    onError: () => Alert.alert(t('trainingOverrides.saveFailed'), t('errors.unableSave'))
  });

  const initialValue = useMemo(() => {
    if (override.data) {
      return {
        isTrainingDay: override.data.overrideType === 'TRAINING_DAY',
        targetMuscles: override.data.targetMuscles,
        environment: override.data.environment,
        availableEquipment: override.data.availableEquipment,
        durationMinutes: override.data.durationMinutes,
        protocolPreference: override.data.protocolPreference
      };
    }

    const day = schedule.data?.days.find((item) => item.dayOfWeek === effectiveDayOfWeek);
    const resolved = day?.resolved;
    return {
      isTrainingDay: true,
      targetMuscles: resolved?.targetMuscles ?? schedule.data?.defaults.targetMuscles ?? [],
      environment: resolved?.environment ?? schedule.data?.defaults.environment ?? null,
      availableEquipment: resolved?.availableEquipment ?? schedule.data?.defaults.availableEquipment ?? [],
      durationMinutes: resolved?.durationMinutes ?? schedule.data?.defaults.durationMinutes ?? 30,
      protocolPreference: resolved?.protocolPreference ?? schedule.data?.defaults.protocolPreference ?? null
    };
  }, [effectiveDayOfWeek, override.data, schedule.data]);

  useEffect(() => {
    if (!schedule.isLoading && !override.isLoading) {
      setValue(initialValue);
    }
  }, [initialValue, override.isLoading, schedule.isLoading]);

  if (schedule.isLoading || override.isLoading || !value) {
    return <ScreenSkeleton variant="detail" cardCount={4} />;
  }

  if (schedule.isError || override.isError) {
    return (
      <Screen>
        <StateBlock title={t('schedule.unavailable')} message={t('errors.unableLoad')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="label">{t('trainingOverrides.todayOnly')}</Text>
      <Text variant="heading">{getDayOfWeekLabel(t, effectiveDayOfWeek)}</Text>
      <Text variant="muted">{t('trainingOverrides.todayOnlyHelp')}</Text>

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
          <Card>
            <Text variant="label">{t('schedule.muscleFocus')}</Text>
            <Text variant="muted">{t('training.targetHelp')}</Text>
            <BodyMapSelector
              value={value.targetMuscles}
              onChange={(targetMuscles) => setValue({ ...value, targetMuscles })}
            />
          </Card>

          <SelectChips
            label={t('schedule.location')}
            value={value.environment ?? 'HOME'}
            onChange={(environment) => setValue({ ...value, environment })}
            options={enumOptions(ENVIRONMENTS, (item) => getTrainingEnvironmentLabel(t, item))}
          />

          <MultiSelectChips
            label={t('schedule.equipment')}
            value={value.availableEquipment}
            onChange={(availableEquipment) => setValue({ ...value, availableEquipment })}
            options={enumOptions(EQUIPMENT, (item) => getExerciseEquipmentLabel(t, item))}
          />
          {value.availableEquipment.length === 0 ? (
            <Text variant="muted">{t('schedule.noOptionalEquipment')}</Text>
          ) : null}

          <Field
            label={t('schedule.durationMinutes')}
            keyboardType="numeric"
            value={value.durationMinutes ? String(value.durationMinutes) : ''}
            onChangeText={(text) => setValue({ ...value, durationMinutes: Number(text) || null })}
          />
        </>
      ) : (
        <Card>
          <Text variant="label">{t('trainingOverrides.oneTimeRestDay')}</Text>
          <Text variant="muted">{t('trainingOverrides.restTodayHelp')}</Text>
        </Card>
      )}

      <View style={styles.actions}>
        <Button
          title={saveOverride.isPending ? t('common.saving') : t('common.save')}
          disabled={saveOverride.isPending}
          onPress={handleSave}
        />
        <Button
          title={t('trainingOverrides.editWeeklyRoutine')}
          variant="secondary"
          disabled={saveOverride.isPending}
          onPress={() => router.replace({
            pathname: '/training-schedule/day' as never,
            params: { dayOfWeek: effectiveDayOfWeek }
          })}
        />
      </View>

      <Text style={styles.note}>{t('trainingOverrides.usualRoutineUnaffected')}</Text>
      <Text style={styles.note}>{t('schedule.equipmentRule')}</Text>
    </Screen>
  );

  function handleSave() {
    if (!value) return;

    saveOverride.mutate({
      overrideType: value.isTrainingDay ? 'TRAINING_DAY' : 'REST_DAY',
      targetMuscles: value.isTrainingDay ? value.targetMuscles : [],
      environment: value.isTrainingDay ? value.environment : null,
      availableEquipment: value.isTrainingDay ? value.availableEquipment : [],
      durationMinutes: value.isTrainingDay ? value.durationMinutes : null,
      protocolPreference: value.isTrainingDay ? value.protocolPreference : null,
      source: value.isTrainingDay ? 'USER_SELECTED_TRAIN_TODAY' : 'USER_SELECTED_REST_TODAY'
    });
  }
}

function getTodayDayOfWeek() {
  const jsDay = new Date().getDay();
  return ORDERED_DAYS[(jsDay + 6) % 7];
}

const styles = StyleSheet.create({
  actions: {
    gap: 10
  },
  note: {
    color: colors.muted,
    fontSize: 13
  }
});
