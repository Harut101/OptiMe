import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createTrainingScheduleItem } from '@/api/training-schedule';
import {
  TrainingScheduleForm,
  TrainingScheduleFormValues
} from '@/features/training-schedule/TrainingScheduleForm';

export default function CreateTrainingScheduleScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: createTrainingScheduleItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['training-schedule-items'] });
      router.back();
    },
    onError: () => Alert.alert(t('schedule.saveFailed'), t('errors.unableSave'))
  });

  return (
    <TrainingScheduleForm
      title={t('schedule.addWorkout')}
      submitTitle={mutation.isPending ? t('common.saving') : t('schedule.saveWorkout')}
      disabled={mutation.isPending}
      defaultValues={{
        dayOfWeek: '1', localTime: '07:30', sportType: 'STRENGTH',
        durationMinutes: '45', intensity: 'MODERATE', description: ''
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
