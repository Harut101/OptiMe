import { zodResolver } from '@hookform/resolvers/zod';
import { verifyEmailSchema } from '@optime/shared-schemas';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { resendVerification, verifyEmail } from '@/api/auth';
import { AppToast } from '@/components/AppToast';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/store/auth-store';

type VerifyEmailForm = z.infer<typeof verifyEmailSchema>;

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();
  const setSession = useAuthStore((state) => state.setSession);
  const form = useForm<VerifyEmailForm>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email: params.email ?? '', code: '' }
  });
  const verifyMutation = useMutation({
    mutationFn: verifyEmail,
    onSuccess: async (data) => {
      await setSession(data.accessToken, data.user);
      router.replace('/(onboarding)/profile');
    }
  });
  const resendMutation = useMutation({ mutationFn: resendVerification });

  return (
    <Screen topSafeArea={false}>
      <View style={styles.hero}>
        <BrandLogo style={styles.logo} width={252} />
        <Text variant="title" style={styles.title}>{t('auth.verifyEmail')}</Text>
        <Text variant="muted" style={styles.subtitle}>{t('auth.verifyEmailMessage')}</Text>
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
          name="code"
          render={({ field, fieldState }) => (
            <Field
              label={t('auth.verificationCode')}
              keyboardType="number-pad"
              maxLength={6}
              textContentType="oneTimeCode"
              value={field.value}
              onChangeText={(value) => field.onChange(value.replace(/\D/g, ''))}
              error={fieldState.error ? t('auth.invalidCode') : undefined}
            />
          )}
        />
        <Button
          title={verifyMutation.isPending ? t('auth.verifying') : t('auth.verifyAndContinue')}
          loading={verifyMutation.isPending}
          disabled={verifyMutation.isPending}
          onPress={form.handleSubmit((values) => verifyMutation.mutate(values))}
        />
        <Button
          title={resendMutation.isPending ? t('auth.resendingCode') : t('auth.resendCode')}
          variant="ghost"
          loading={resendMutation.isPending}
          disabled={resendMutation.isPending}
          onPress={() => {
            const email = form.getValues('email');
            if (email) resendMutation.mutate({ email });
          }}
        />
      </Card>
      {resendMutation.isSuccess ? (
        <AppToast title={t('auth.codeSent')} tone="success" />
      ) : null}
      {verifyMutation.isError ? (
        <AppToast title={t('auth.invalidOrExpiredCode')} tone="warning" />
      ) : null}
      {resendMutation.isError ? (
        <AppToast title={t('auth.codeSendFailed')} tone="warning" />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 10, paddingTop: 30 },
  logo: { alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 30, lineHeight: 35, textAlign: 'center' },
  subtitle: { textAlign: 'center' }
});
