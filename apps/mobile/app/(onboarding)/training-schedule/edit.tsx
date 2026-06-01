import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { updateTrainingScheduleItem } from '@/api/training-schedule';
import { TrainingScheduleForm, TrainingScheduleFormValues } from '@/features/training-schedule/TrainingScheduleForm';
import type { IntensityLevel, SportType } from '@optime/shared-types';

export default function EditTrainingScheduleScreen() {
  const params = useLocalSearchParams<{
    id: string;
    dayOfWeek: string;
    localTime: string;
    sportType: SportType;
    durationMinutes: string;
    intensity: IntensityLevel;
    description?: string;
  }>();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (values: TrainingScheduleFormValues) =>
      updateTrainingScheduleItem(params.id, {
        dayOfWeek: Number(values.dayOfWeek),
        localTime: values.localTime,
        sportType: values.sportType,
        durationMinutes: Number(values.durationMinutes),
        intensity: values.intensity,
        description: values.description || undefined
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['training-schedule'] });
      router.replace('/(onboarding)/training-schedule');
    },
    onError: (error) => Alert.alert('Workout was not updated', error.message)
  });

  return (
    <TrainingScheduleForm
      title="Edit workout"
      submitTitle={mutation.isPending ? 'Saving...' : 'Save changes'}
      disabled={mutation.isPending}
      defaultValues={{
        dayOfWeek: params.dayOfWeek ?? '1',
        localTime: params.localTime ?? '07:30',
        sportType: params.sportType ?? 'RUNNING',
        durationMinutes: params.durationMinutes ?? '30',
        intensity: params.intensity ?? 'MODERATE',
        description: params.description ?? ''
      }}
      onSubmit={(values) => mutation.mutate(values)}
    />
  );
}
