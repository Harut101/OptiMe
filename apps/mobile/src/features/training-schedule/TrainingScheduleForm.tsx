import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { SelectChips } from '@/components/SelectChips';
import { Text } from '@/components/Text';
import type { IntensityLevel, SportType } from '@optime/shared-types';
import { enumOptions, getIntensityLabel, getSportTypeLabel } from '@/i18n/enum-labels';

export interface TrainingScheduleFormValues {
  dayOfWeek: string;
  localTime: string;
  sportType: SportType;
  durationMinutes: string;
  intensity: IntensityLevel;
  description: string;
}

interface TrainingScheduleFormProps {
  title: string;
  submitTitle: string;
  disabled?: boolean;
  defaultValues: TrainingScheduleFormValues;
  onSubmit: (values: TrainingScheduleFormValues) => void;
}

export function TrainingScheduleForm({
  title,
  submitTitle,
  disabled,
  defaultValues,
  onSubmit
}: TrainingScheduleFormProps) {
  const { t } = useTranslation();
  const form = useForm<TrainingScheduleFormValues>({ defaultValues });

  return (
    <Screen>
      <Text variant="heading">{title}</Text>
      <Text variant="muted">{t('schedule.weeklyHelp')}</Text>

      <Controller
        control={form.control}
        name="dayOfWeek"
        render={({ field }) => (
          <SelectChips
            label={t('schedule.day')}
            value={field.value}
            onChange={field.onChange}
            options={DAY_KEYS.map((key, value) => ({ label: t(`enums.weekdays.${key}` as never), value: String(value) }))}
          />
        )}
      />
      <Controller
        control={form.control}
        name="localTime"
        render={({ field }) => (
          <Field label={t('schedule.time')} placeholder="07:30" value={field.value} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={form.control}
        name="sportType"
        render={({ field }) => (
          <SelectChips
            label={t('schedule.sport')}
            value={field.value}
            onChange={field.onChange}
            options={enumOptions(SPORT_VALUES, (item) => getSportTypeLabel(t, item))}
          />
        )}
      />
      <Controller
        control={form.control}
        name="durationMinutes"
        render={({ field }) => (
          <Field label={t('schedule.durationMinutes')} keyboardType="numeric" value={field.value} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={form.control}
        name="intensity"
        render={({ field }) => (
          <SelectChips
            label={t('schedule.intensity')}
            value={field.value}
            onChange={field.onChange}
            options={enumOptions(INTENSITIES, (item) => getIntensityLabel(t, item))}
          />
        )}
      />
      <Controller
        control={form.control}
        name="description"
        render={({ field }) => (
          <Field label={t('schedule.description')} multiline value={field.value} onChangeText={field.onChange} />
        )}
      />

      <Button title={submitTitle} disabled={disabled} onPress={form.handleSubmit(onSubmit)} />
    </Screen>
  );
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const SPORT_VALUES: SportType[] = ['RUNNING', 'GYM', 'STRENGTH', 'CYCLING', 'YOGA', 'OTHER'];
const INTENSITIES: IntensityLevel[] = ['LOW', 'MODERATE', 'HIGH'];
