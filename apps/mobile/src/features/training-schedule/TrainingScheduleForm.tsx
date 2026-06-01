import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { SelectChips } from '@/components/SelectChips';
import { Text } from '@/components/Text';
import type { IntensityLevel, SportType } from '@optime/shared-types';

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
  const form = useForm<TrainingScheduleFormValues>({ defaultValues });

  return (
    <Screen>
      <Text variant="heading">{title}</Text>
      <Text variant="muted">Keep this close to what you actually plan to do most weeks.</Text>

      <Controller
        control={form.control}
        name="dayOfWeek"
        render={({ field }) => (
          <SelectChips
            label="Day"
            value={field.value}
            onChange={field.onChange}
            options={[
              { label: 'Sun', value: '0' },
              { label: 'Mon', value: '1' },
              { label: 'Tue', value: '2' },
              { label: 'Wed', value: '3' },
              { label: 'Thu', value: '4' },
              { label: 'Fri', value: '5' },
              { label: 'Sat', value: '6' }
            ]}
          />
        )}
      />
      <Controller
        control={form.control}
        name="localTime"
        render={({ field }) => (
          <Field label="Time" placeholder="07:30" value={field.value} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={form.control}
        name="sportType"
        render={({ field }) => (
          <SelectChips
            label="Sport"
            value={field.value}
            onChange={field.onChange}
            options={[
              { label: 'Run', value: 'RUNNING' },
              { label: 'Gym', value: 'GYM' },
              { label: 'Strength', value: 'STRENGTH' },
              { label: 'Cycle', value: 'CYCLING' },
              { label: 'Yoga', value: 'YOGA' },
              { label: 'Other', value: 'OTHER' }
            ]}
          />
        )}
      />
      <Controller
        control={form.control}
        name="durationMinutes"
        render={({ field }) => (
          <Field label="Duration (minutes)" keyboardType="numeric" value={field.value} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={form.control}
        name="intensity"
        render={({ field }) => (
          <SelectChips
            label="Intensity"
            value={field.value}
            onChange={field.onChange}
            options={[
              { label: 'Low', value: 'LOW' },
              { label: 'Moderate', value: 'MODERATE' },
              { label: 'High', value: 'HIGH' }
            ]}
          />
        )}
      />
      <Controller
        control={form.control}
        name="description"
        render={({ field }) => (
          <Field label="Description" multiline value={field.value} onChangeText={field.onChange} />
        )}
      />

      <Button title={submitTitle} disabled={disabled} onPress={form.handleSubmit(onSubmit)} />
    </Screen>
  );
}
