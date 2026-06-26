import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { updateTrainingScheduleItem } from '@/api/training-schedule';
import { TrainingScheduleForm, TrainingScheduleFormValues } from '@/features/training-schedule/TrainingScheduleForm';
import type { IntensityLevel, SportType } from '@optime/shared-types';
import { useTranslation } from 'react-i18next';

export default function EditTrainingScheduleScreen() {
  const { t } = useTranslation();
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
      await queryClient.invalidateQueries({ queryKey: ['training-schedule-items'] });
      router.replace('/(onboarding)/training-schedule');
    },
    onError: () => Alert.alert(t('schedule.updateFailed'), t('errors.unableSave'))
  });

  return (
    <TrainingScheduleForm
      title={t('schedule.editWorkout')}
      submitTitle={mutation.isPending ? t('common.saving') : t('schedule.saveChanges')}
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
