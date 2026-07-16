import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { goalSchema } from '@optime/shared-schemas';

import { saveGoal } from '@/api/goals';
import { AppFeedbackSheet } from '@/components/AppFeedbackSheet';
import { Screen } from '@/components/Screen';
import {
  EMPTY_GOALS_FORM,
  GoalsForm,
  toGoalRequest
} from '@/features/goals/GoalsForm';
import { OnboardingStepShell } from '@/features/onboarding/OnboardingStepShell';
import { getFriendlyGoalErrorMessage } from '@/features/safety/safety-copy';

export default function GoalsOnboardingStep() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(EMPTY_GOALS_FORM);
  const [errorSheet, setErrorSheet] = useState<{ title: string; message: string } | null>(null);
  const mutation = useMutation({
    mutationFn: saveGoal,
    onSuccess: async (goal) => {
      queryClient.setQueryData(['goal'], goal);
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      router.push('/(onboarding)/nutrition-preferences');
    },
    onError: (error) =>
      setErrorSheet({ title: t('onboarding.safeGoalTitle'), message: getFriendlyGoalErrorMessage(error, t) })
  });

  const continueOnboarding = () => {
    const result = goalSchema.safeParse(toGoalRequest(value));
    if (!result.success) {
      setErrorSheet({ title: t('onboarding.checkGoal'), message: t('goals.checkGoal') });
      return;
    }
    mutation.mutate(result.data);
  };

  return (
    <Screen topSafeArea={false}>
      <OnboardingStepShell
        eyebrow={t('onboarding.stepGoal')}
        title={t('onboarding.directionTitle')}
        subtitle={t('onboarding.directionMessage')}
        progressLabel={t('onboarding.progressGoal')}
        progressValue={2 / 3}
        primaryLabel={mutation.isPending ? t('common.saving') : t('common.continue')}
        primaryLoading={mutation.isPending}
        onPrimary={continueOnboarding}
        secondaryLabel={t('common.back')}
        onSecondary={() => router.back()}
      >
        <GoalsForm value={value} onChange={setValue} validationMode="onboarding" />
      </OnboardingStepShell>
      <AppFeedbackSheet
        visible={errorSheet !== null}
        title={errorSheet?.title ?? t('onboarding.checkGoal')}
        message={errorSheet?.message ?? t('goals.checkGoal')}
        tone="warning"
        onClose={() => setErrorSheet(null)}
        actions={[{ label: t('common.close'), variant: 'secondary', onPress: () => setErrorSheet(null) }]}
      />
    </Screen>
  );
}
