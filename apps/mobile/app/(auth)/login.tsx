import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { HeartPulse } from 'lucide-react-native';
import { loginSchema } from '@optime/shared-schemas';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

import { loginUser } from '@/api/auth';
import { AppFeedbackSheet } from '@/components/AppFeedbackSheet';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme/theme-provider';
import type { ThemeColors } from '@/theme/colors';

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const setSession = useAuthStore((state) => state.setSession);
  const [errorSheetVisible, setErrorSheetVisible] = useState(false);
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
    onError: () => setErrorSheetVisible(true)
  });

  return (
    <Screen topSafeArea={false}>
      <View style={styles.hero}>
        <BrandLogo style={styles.brandLogo} width={220} />
        <Text variant="title">{t('auth.welcomeBack')}</Text>
        <Text variant="muted">{t('auth.loginMessage')}</Text>
      </View>

      <Card variant="elevated">
        <View style={styles.formHeader}>
          <View style={styles.formIcon}><HeartPulse size={18} color={colors.health} /></View>
          <Text variant="label">{t('auth.signInSecurely')}</Text>
        </View>
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
          loading={mutation.isPending}
          onPress={form.handleSubmit((values) => mutation.mutate(values))}
        />
      </Card>
      <Button title={t('auth.createAccount')} variant="ghost" onPress={() => router.push('/(auth)/register')} />
      <AppFeedbackSheet
        visible={errorSheetVisible}
        title={t('auth.loginFailed')}
        message={t('auth.checkDetails')}
        tone="warning"
        onClose={() => setErrorSheetVisible(false)}
        actions={[{ label: t('common.close'), variant: 'secondary', onPress: () => setErrorSheetVisible(false) }]}
      />
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  hero: {
    gap: 10,
    paddingTop: 30
  },
  brandLogo: {
    alignSelf: 'center',
    marginBottom: 8
  },
  formHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10
  },
  formIcon: {
    alignItems: 'center',
    backgroundColor: colors.healthMuted,
    borderRadius: 13,
    height: 32,
    justifyContent: 'center',
    width: 32
  }
});
