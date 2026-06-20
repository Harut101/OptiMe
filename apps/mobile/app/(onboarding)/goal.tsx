import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      Alert.alert(t('onboarding.safeGoalTitle'), getFriendlyGoalErrorMessage(error, t))
  });

  const continueOnboarding = () => {
    const result = goalSchema.safeParse(toGoalRequest(value));
    if (!result.success) {
      Alert.alert(t('onboarding.checkGoal'), t('goals.checkGoal'));
      return;
    }
    mutation.mutate(result.data);
  };

  return (
    <Screen>
      <Text variant="heading">{t('onboarding.directionTitle')}</Text>
      <Text variant="muted">{t('onboarding.directionMessage')}</Text>
      <GoalsForm value={value} onChange={setValue} validationMode="onboarding" />
      <Button
        title={mutation.isPending ? t('common.saving') : t('common.continue')}
        disabled={mutation.isPending}
        onPress={continueOnboarding}
      />
    </Screen>
  );
}
