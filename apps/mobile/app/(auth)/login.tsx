import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { loginSchema } from '@optime/shared-schemas';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

import { loginUser } from '@/api/auth';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/store/auth-store';

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { t } = useTranslation();
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
    onError: () => Alert.alert(t('auth.loginFailed'), t('errors.network'))
  });

  return (
    <Screen>
      <Text variant="heading">{t('auth.welcomeBack')}</Text>
      <Text variant="muted">{t('auth.loginMessage')}</Text>

      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <Field
            label={t('auth.email')}
            autoCapitalize="none"
            keyboardType="email-address"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error ? t('errors.validation') : undefined}
          />
        )}
      />
      <Controller
        control={form.control}
        name="password"
        render={({ field, fieldState }) => (
          <Field
            label={t('auth.password')}
            secureTextEntry
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error ? t('errors.validation') : undefined}
          />
        )}
      />

      <Button
        title={mutation.isPending ? t('auth.loggingIn') : t('auth.login')}
        disabled={mutation.isPending}
        onPress={form.handleSubmit((values) => mutation.mutate(values))}
      />
      <Button title={t('auth.createAccount')} variant="ghost" onPress={() => router.push('/(auth)/register')} />
    </Screen>
  );
}
