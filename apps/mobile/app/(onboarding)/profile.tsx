import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { profileSchema } from '@optime/shared-schemas';
import { z } from 'zod';

import { saveProfile } from '@/api/profile';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { SelectChips } from '@/components/SelectChips';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/store/auth-store';

type ProfileForm = z.input<typeof profileSchema>;

export default function ProfileSetupScreen() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      gender: '',
      dateOfBirth: '',
      heightCm: 170,
      weightKg: 70,
      activityLevel: 'MODERATE',
      privacyConsentAccepted: true
    }
  });

  const mutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: async (data: any) => {
      setUser(data.user);
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      router.push('/(onboarding)/goal');
    },
    onError: (error) => Alert.alert('Profile was not saved', error.message)
  });

  return (
    <Screen>
      <Text variant="heading">Your foundation</Text>
      <Text variant="muted">
        This helps the backend keep recommendations age-aware and practical. Safe mode is handled by the server.
      </Text>

      <Controller
        control={form.control}
        name="firstName"
        render={({ field }) => (
          <Field label="First name" value={field.value ?? ''} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={form.control}
        name="lastName"
        render={({ field }) => (
          <Field label="Last name" value={field.value ?? ''} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={form.control}
        name="dateOfBirth"
        render={({ field, fieldState }) => (
          <Field
            label="Date of birth"
            placeholder="YYYY-MM-DD"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="heightCm"
        render={({ field, fieldState }) => (
          <Field
            label="Height (cm)"
            keyboardType="numeric"
            value={String(field.value ?? '')}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="weightKg"
        render={({ field, fieldState }) => (
          <Field
            label="Weight (kg)"
            keyboardType="numeric"
            value={String(field.value ?? '')}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="activityLevel"
        render={({ field }) => (
          <SelectChips
            label="Activity level"
            value={field.value}
            onChange={field.onChange}
            options={[
              { label: 'Light', value: 'LIGHT' },
              { label: 'Moderate', value: 'MODERATE' },
              { label: 'High', value: 'HIGH' },
              { label: 'Athlete', value: 'ATHLETE' }
            ]}
          />
        )}
      />

      <Button
        title={mutation.isPending ? 'Saving...' : 'Continue'}
        disabled={mutation.isPending}
        onPress={form.handleSubmit((values) => mutation.mutate(values as z.output<typeof profileSchema>))}
      />
    </Screen>
  );
}
