import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert, StyleSheet, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { registerSchema } from '@optime/shared-schemas';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

import { registerUser } from '@/api/auth';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/store/auth-store';
import { detectDeviceLocale } from '@/i18n/locale-detection';
import { colors } from '@/theme/colors';

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const { t } = useTranslation();
  const setSession = useAuthStore((state) => state.setSession);
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      locale: detectDeviceLocale(),
      privacyConsentAccepted: true
    }
  });

  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess: async (data) => {
      await setSession(data.accessToken, data.user);
      router.replace('/(onboarding)/profile');
    },
    onError: () => Alert.alert(t('auth.createFailed'), t('errors.network'))
  });

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.logo}><Sparkles size={20} color={colors.health} /></View>
        <Text variant="title">{t('auth.createTitle')}</Text>
        <Text variant="muted">{t('auth.createMessage')}</Text>
      </View>

      <Card variant="elevated">
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

        <Text variant="caption">
          {t('auth.consent')}
        </Text>
        <Button
          title={mutation.isPending ? t('auth.creatingAccount') : t('auth.createAccount')}
          disabled={mutation.isPending}
          onPress={form.handleSubmit((values) => mutation.mutate(values))}
        />
      </Card>
      <Button title={t('auth.existingAccount')} variant="ghost" onPress={() => router.push('/(auth)/login')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 10,
    paddingTop: 30
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.healthMuted,
    borderRadius: 20,
    height: 48,
    justifyContent: 'center',
    width: 48
  }
});
