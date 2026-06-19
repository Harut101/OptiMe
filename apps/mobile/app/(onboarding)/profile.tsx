import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
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
    onError: (error) => Alert.alert('Profile was not saved', error.message)
  });

  const continueOnboarding = () => {
    const request = toProfileRequest(value);
    const result = profileSchema.safeParse({ ...request, privacyConsentAccepted: true });

    if (!result.success) {
      Alert.alert('Check your profile', result.error.issues[0]?.message ?? 'Please review the fields.');
      return;
    }

    mutation.mutate({ ...result.data, privacyConsentAccepted: true });
  };

  return (
    <Screen>
      <Text variant="heading">Your foundation</Text>
      <Text variant="muted">
        This helps OptiMe keep recommendations age-aware and practical. Safe mode is managed by the backend.
      </Text>
      <Card>
        <Text variant="label">Safety note</Text>
        <Text variant="muted">{WELLNESS_DISCLAIMER}</Text>
      </Card>
      <PersonalProfileForm value={value} onChange={setValue} />
      <Button
        title={mutation.isPending ? 'Saving...' : 'Continue'}
        disabled={mutation.isPending}
        onPress={continueOnboarding}
      />
    </Screen>
  );
}
