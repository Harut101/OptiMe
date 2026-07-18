import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, ShieldCheck } from 'lucide-react-native';
import { registerSchema } from '@optime/shared-schemas';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

import { registerUser } from '@/api/auth';
import { AppFeedbackSheet } from '@/components/AppFeedbackSheet';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/store/auth-store';
import { detectDeviceLocale } from '@/i18n/locale-detection';
import { useTheme } from '@/theme/theme-provider';
import type { ThemeColors } from '@/theme/colors';

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const setSession = useAuthStore((state) => state.setSession);
  const [errorSheetVisible, setErrorSheetVisible] = useState(false);
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      locale: detectDeviceLocale(),
      privacyConsentAccepted: false
    }
  });

  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess: async (data) => {
      await setSession(data.accessToken, data.user);
      router.replace('/(onboarding)/profile');
    },
    onError: () => setErrorSheetVisible(true)
  });

  return (
    <Screen topSafeArea={false}>
      <View style={styles.hero}>
        <BrandLogo style={styles.brandLogo} width={252} />
        <Text variant="title">{t('auth.createTitle')}</Text>
        <Text variant="muted">{t('auth.createMessage')}</Text>
      </View>

      <Card variant="elevated">
        <View style={styles.formHeader}>
          <View style={styles.formIcon}><ShieldCheck size={18} color={colors.success} /></View>
          <Text variant="label">{t('auth.createSecurely')}</Text>
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

        <Controller
          control={form.control}
          name="privacyConsentAccepted"
          render={({ field, fieldState }) => (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: field.value }}
              accessibilityLabel={t('auth.consent')}
              onPress={() => field.onChange(!field.value)}
              style={styles.consentRow}
            >
              <View style={[styles.checkbox, field.value && styles.checkboxSelected]}>
                {field.value ? <Check size={15} color={colors.textOnAccent} strokeWidth={3} /> : null}
              </View>
              <View style={styles.consentCopy}>
                <Text variant="caption">{t('auth.consent')}</Text>
                {fieldState.error ? <Text style={styles.error}>{t('auth.consentRequired')}</Text> : null}
              </View>
            </Pressable>
          )}
        />
        <Button
          title={mutation.isPending ? t('auth.creatingAccount') : t('auth.createAccount')}
          disabled={mutation.isPending}
          loading={mutation.isPending}
          onPress={form.handleSubmit((values) => mutation.mutate(values))}
        />
      </Card>
      <Button title={t('auth.existingAccount')} variant="ghost" onPress={() => router.push('/(auth)/login')} />
      <AppFeedbackSheet
        visible={errorSheetVisible}
        title={t('auth.createFailed')}
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
    backgroundColor: colors.successMuted,
    borderRadius: 13,
    height: 32,
    justifyContent: 'center',
    width: 32
  },
  consentRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 7,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    marginTop: 1,
    width: 24
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  consentCopy: {
    flex: 1,
    gap: 4
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700'
  }
});
