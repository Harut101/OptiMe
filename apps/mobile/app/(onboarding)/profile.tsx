import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { profileSchema } from '@optime/shared-schemas';

import { saveProfile } from '@/api/profile';
import { AppFeedbackSheet } from '@/components/AppFeedbackSheet';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { OnboardingStepShell } from '@/features/onboarding/OnboardingStepShell';
import {
  EMPTY_PERSONAL_PROFILE,
  PersonalProfileForm,
  toProfileRequest
} from '@/features/profile/PersonalProfileForm';
import { useAuthStore } from '@/store/auth-store';

export default function ProfileSetupScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const [value, setValue] = useState(EMPTY_PERSONAL_PROFILE);
  const [errorSheet, setErrorSheet] = useState<{ title: string; message: string } | null>(null);
  const mutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: async (data) => {
      setUser(data.user);
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      router.push('/(onboarding)/goal');
    },
    onError: () => setErrorSheet({ title: t('onboarding.profileNotSaved'), message: t('errors.unableSave') })
  });

  const continueOnboarding = () => {
    const request = toProfileRequest(value);
    const result = profileSchema.safeParse({ ...request, privacyConsentAccepted: true });

    if (!result.success) {
      setErrorSheet({ title: t('onboarding.checkProfile'), message: t('errors.validation') });
      return;
    }

    mutation.mutate({ ...result.data, privacyConsentAccepted: true });
  };

  return (
    <Screen>
      <OnboardingStepShell
        eyebrow={t('onboarding.stepProfile')}
        title={t('onboarding.foundationTitle')}
        subtitle={t('onboarding.foundationMessage')}
        progressLabel={t('onboarding.progressProfile')}
        progressValue={1 / 3}
        primaryLabel={mutation.isPending ? t('common.saving') : t('common.continue')}
        primaryLoading={mutation.isPending}
        onPrimary={continueOnboarding}
      >
        <Text variant="label">{t('onboarding.safetyNote')}</Text>
        <Text variant="muted">{t('safety.disclaimer')}</Text>
        <PersonalProfileForm value={value} onChange={setValue} />
      </OnboardingStepShell>
      <AppFeedbackSheet
        visible={errorSheet !== null}
        title={errorSheet?.title ?? t('errors.validation')}
        message={errorSheet?.message ?? t('errors.unableSave')}
        tone="warning"
        onClose={() => setErrorSheet(null)}
        actions={[{ label: t('common.close'), variant: 'secondary', onPress: () => setErrorSheet(null) }]}
      />
    </Screen>
  );
}
