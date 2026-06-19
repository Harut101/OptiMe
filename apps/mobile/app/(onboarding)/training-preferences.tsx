import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

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
    onError: (error) => Alert.alert('Training preferences were not saved', error.message)
  });

  if (preferences.isLoading) {
    return <Screen><StateBlock title="Loading training preferences" message="Preparing your optional training setup." /></Screen>;
  }

  if (preferences.isError) {
    return <Screen><StateBlock title="Training preferences unavailable" message={preferences.error.message} actionTitle="Try again" onAction={() => preferences.refetch()} /></Screen>;
  }

  return (
    <Screen>
      <Text variant="heading">Personalize training</Text>
      <Text variant="muted">Optional. You can finish onboarding without this and update it later from Training.</Text>
      <TrainingSetupForm value={value} onChange={setValue} />
      <Button
        title={mutation.isPending ? 'Saving...' : 'Save training preferences'}
        disabled={mutation.isPending}
        onPress={() => mutation.mutate(toTrainingPreferenceRequest(value))}
      />
      <Button title="Not now" variant="ghost" disabled={mutation.isPending} onPress={() => router.back()} />
    </Screen>
  );
}
