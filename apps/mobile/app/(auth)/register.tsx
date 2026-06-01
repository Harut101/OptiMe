import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { registerSchema } from '@optime/shared-schemas';
import { z } from 'zod';

import { registerUser } from '@/api/auth';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/store/auth-store';

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const setSession = useAuthStore((state) => state.setSession);
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      locale: 'en',
      privacyConsentAccepted: true
    }
  });

  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess: async (data) => {
      await setSession(data.accessToken, data.user);
      router.replace('/(onboarding)/profile');
    },
    onError: (error) => Alert.alert('Could not create account', error.message)
  });

  return (
    <Screen>
      <Text variant="heading">Create your account</Text>
      <Text variant="muted">
        We use your setup details to create practical, supportive daily guidance.
      </Text>

      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <Field
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="password"
        render={({ field, fieldState }) => (
          <Field
            label="Password"
            secureTextEntry
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />

      <Text variant="muted">
        By continuing, you consent to using your profile and preferences to generate your plan.
      </Text>
      <Button
        title={mutation.isPending ? 'Creating account...' : 'Create account'}
        disabled={mutation.isPending}
        onPress={form.handleSubmit((values) => mutation.mutate(values))}
      />
      <Button title="I already have an account" variant="ghost" onPress={() => router.push('/(auth)/login')} />
    </Screen>
  );
}
