import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { goalSchema } from '@optime/shared-schemas';

import { saveGoal } from '@/api/goals';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import {
  EMPTY_GOALS_FORM,
  GoalsForm,
  toGoalRequest
} from '@/features/goals/GoalsForm';
import { getFriendlyGoalErrorMessage } from '@/features/safety/safety-copy';

export default function GoalsOnboardingStep() {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(EMPTY_GOALS_FORM);
  const mutation = useMutation({
    mutationFn: saveGoal,
    onSuccess: async (goal) => {
      queryClient.setQueryData(['goal'], goal);
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      router.push('/(onboarding)/nutrition-preferences');
    },
    onError: (error) =>
      Alert.alert('Let’s keep this goal safe', getFriendlyGoalErrorMessage(error))
  });

  const continueOnboarding = () => {
    const result = goalSchema.safeParse(toGoalRequest(value));
    if (!result.success) {
      Alert.alert('Check your goal', result.error.issues[0]?.message ?? 'Please review your goal.');
      return;
    }
    mutation.mutate(result.data);
  };

  return (
    <Screen>
      <Text variant="heading">Choose your direction</Text>
      <Text variant="muted">Pick the outcome that best matches the season you are in.</Text>
      <GoalsForm value={value} onChange={setValue} validationMode="onboarding" />
      <Button
        title={mutation.isPending ? 'Saving...' : 'Continue'}
        disabled={mutation.isPending}
        onPress={continueOnboarding}
      />
    </Screen>
  );
}
