import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { loginSchema } from '@optime/shared-schemas';
import { z } from 'zod';

import { loginUser } from '@/api/auth';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/store/auth-store';

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const setSession = useAuthStore((state) => state.setSession);
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const mutation = useMutation({
    mutationFn: loginUser,
    onSuccess: async (data) => {
      await setSession(data.accessToken, data.user);
      router.replace('/');
    },
    onError: (error) => Alert.alert('Login failed', error.message)
  });

  return (
    <Screen>
      <Text variant="heading">Welcome back</Text>
      <Text variant="muted">Log in to continue your daily plan flow.</Text>

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

      <Button
        title={mutation.isPending ? 'Logging in...' : 'Log in'}
        disabled={mutation.isPending}
        onPress={form.handleSubmit((values) => mutation.mutate(values))}
      />
      <Button title="Create account" variant="ghost" onPress={() => router.push('/(auth)/register')} />
    </Screen>
  );
}
