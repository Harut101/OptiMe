import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getTrainingPreferences, saveTrainingPreferences } from '@/api/training-preferences';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import {
  EMPTY_TRAINING_SETUP,
  fromTrainingPreference,
  toTrainingPreferenceRequest,
  TrainingSetupForm,
  TrainingSetupFormValue
} from '@/features/training-preferences/TrainingSetupForm';

export default function TrainingPreferencesOnboardingStep() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const preferences = useQuery({ queryKey: ['training-preferences'], queryFn: getTrainingPreferences });
  const [value, setValue] = useState<TrainingSetupFormValue>(EMPTY_TRAINING_SETUP);

  useEffect(() => {
    if (preferences.data) setValue(fromTrainingPreference(preferences.data));
  }, [preferences.data]);

  const mutation = useMutation({
    mutationFn: saveTrainingPreferences,
    onSuccess: async (data) => {
      queryClient.setQueryData(['training-preferences'], data);
      router.back();
    },
    onError: () => Alert.alert(t('onboarding.trainingNotSaved'), t('errors.unableSave'))
  });

  if (preferences.isLoading) {
    return <Screen><StateBlock title={t('common.loading')} message={t('training.optionalSetup')} /></Screen>;
  }

  if (preferences.isError) {
    return <Screen><StateBlock title={t('training.preferencesUnavailable')} message={t('errors.unableLoad')} actionTitle={t('common.retry')} onAction={() => preferences.refetch()} /></Screen>;
  }

  return (
    <Screen>
      <Text variant="heading">{t('onboarding.personalizeTraining')}</Text>
      <Text variant="muted">{t('onboarding.personalizeTrainingMessage')}</Text>
      <TrainingSetupForm value={value} onChange={setValue} />
      <Button
        title={mutation.isPending ? t('common.saving') : t('common.save')}
        disabled={mutation.isPending}
        onPress={() => mutation.mutate(toTrainingPreferenceRequest(value))}
      />
      <Button title={t('onboarding.notNow')} variant="ghost" disabled={mutation.isPending} onPress={() => router.back()} />
    </Screen>
  );
}
