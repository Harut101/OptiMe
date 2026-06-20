import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { profileSchema } from '@optime/shared-schemas';

import { saveProfile } from '@/api/profile';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import {
  EMPTY_PERSONAL_PROFILE,
  PersonalProfileForm,
  toProfileRequest
} from '@/features/profile/PersonalProfileForm';
import { WELLNESS_DISCLAIMER } from '@/features/safety/safety-copy';
import { useAuthStore } from '@/store/auth-store';

export default function ProfileSetupScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const [value, setValue] = useState(EMPTY_PERSONAL_PROFILE);
  const mutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: async (data) => {
      setUser(data.user);
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      router.push('/(onboarding)/goal');
    },
    onError: () => Alert.alert(t('onboarding.profileNotSaved'), t('errors.unableSave'))
  });

  const continueOnboarding = () => {
    const request = toProfileRequest(value);
    const result = profileSchema.safeParse({ ...request, privacyConsentAccepted: true });

    if (!result.success) {
      Alert.alert(t('onboarding.checkProfile'), t('errors.validation'));
      return;
    }

    mutation.mutate({ ...result.data, privacyConsentAccepted: true });
  };

  return (
    <Screen>
      <Text variant="heading">{t('onboarding.foundationTitle')}</Text>
      <Text variant="muted">{t('onboarding.foundationMessage')}</Text>
      <Card>
        <Text variant="label">{t('onboarding.safetyNote')}</Text>
        <Text variant="muted">{WELLNESS_DISCLAIMER}</Text>
      </Card>
      <PersonalProfileForm value={value} onChange={setValue} />
      <Button
        title={mutation.isPending ? t('common.saving') : t('common.continue')}
        disabled={mutation.isPending}
        onPress={continueOnboarding}
      />
    </Screen>
  );
}
