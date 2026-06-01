import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { createTrainingScheduleItem } from '@/api/training-schedule';
import { TrainingScheduleForm, TrainingScheduleFormValues } from '@/features/training-schedule/TrainingScheduleForm';

export default function CreateTrainingScheduleScreen() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: createTrainingScheduleItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['training-schedule'] });
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      router.replace('/(onboarding)/training-schedule');
    },
    onError: (error) => Alert.alert('Workout was not saved', error.message)
  });

  return (
    <TrainingScheduleForm
      title="Add workout"
      submitTitle={mutation.isPending ? 'Saving...' : 'Save workout'}
      disabled={mutation.isPending}
      defaultValues={{
        dayOfWeek: '1',
        localTime: '07:30',
        sportType: 'RUNNING',
        durationMinutes: '30',
        intensity: 'MODERATE',
        description: ''
      }}
      onSubmit={(values) => mutation.mutate(toRequest(values))}
    />
  );
}

function toRequest(values: TrainingScheduleFormValues) {
  return {
    dayOfWeek: Number(values.dayOfWeek),
    localTime: values.localTime,
    sportType: values.sportType,
    durationMinutes: Number(values.durationMinutes),
    intensity: values.intensity,
    description: values.description || undefined
  };
}
