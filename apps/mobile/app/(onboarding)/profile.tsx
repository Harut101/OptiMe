import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, StyleSheet, View } from 'react-native';
import { profileSchema } from '@optime/shared-schemas';
import { z } from 'zod';

import { saveProfile } from '@/api/profile';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { SelectChips } from '@/components/SelectChips';
import { Text } from '@/components/Text';
import { WELLNESS_DISCLAIMER } from '@/features/safety/safety-copy';
import { useAuthStore } from '@/store/auth-store';

type ProfileForm = z.input<typeof profileSchema>;

const GENDER_OPTIONS = [
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' }
] as const;

const PREGNANCY_STATUS_OPTIONS = [
  { label: 'Prefer not to say', value: 'PREFER_NOT_TO_SAY' },
  { label: 'Not pregnant', value: 'NOT_PREGNANT' },
  { label: 'Pregnant', value: 'PREGNANT' },
  { label: 'Postpartum', value: 'POSTPARTUM' },
  { label: 'Breastfeeding', value: 'BREASTFEEDING' }
] as const;

export default function ProfileSetupScreen() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      gender: 'prefer_not_to_say',
      pregnancyStatus: 'PREFER_NOT_TO_SAY',
      dateOfBirth: '',
      heightCm: 170,
      weightKg: 70,
      activityLevel: 'MODERATE',
      privacyConsentAccepted: true
    }
  });
  const selectedGender = useWatch({ control: form.control, name: 'gender' });
  const shouldShowPregnancyStatus = selectedGender === 'female';

  useEffect(() => {
    if (!shouldShowPregnancyStatus) {
      form.setValue('pregnancyStatus', 'PREFER_NOT_TO_SAY', { shouldDirty: true });
    }
  }, [form, shouldShowPregnancyStatus]);

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

      <Card>
        <Text variant="label">Safety note</Text>
        <Text variant="muted">{WELLNESS_DISCLAIMER}</Text>
      </Card>

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
        name="gender"
        render={({ field }) => (
          <SelectChips
            label="Gender"
            value={field.value ?? 'prefer_not_to_say'}
            onChange={field.onChange}
            options={[...GENDER_OPTIONS]}
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

      {shouldShowPregnancyStatus ? (
        <View style={styles.healthContext}>
          <View style={styles.healthCopy}>
            <Text variant="label">Optional health context</Text>
            <Text variant="heading">Pregnancy / postpartum context</Text>
            <Text variant="muted">
              Optional. Used only to keep nutrition and training guidance safer.
            </Text>
          </View>
          <Controller
            control={form.control}
            name="pregnancyStatus"
            render={({ field }) => (
              <SelectChips
                label="Choose what fits today"
                value={field.value ?? 'PREFER_NOT_TO_SAY'}
                onChange={field.onChange}
                options={[...PREGNANCY_STATUS_OPTIONS]}
              />
            )}
          />
        </View>
      ) : null}

      <Button
        title={mutation.isPending ? 'Saving...' : 'Continue'}
        disabled={mutation.isPending}
        onPress={form.handleSubmit((values) => mutation.mutate(values as z.output<typeof profileSchema>))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  healthContext: {
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#f3f7f5'
  },
  healthCopy: {
    gap: 6
  }
});
