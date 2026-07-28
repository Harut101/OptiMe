import { zodResolver } from '@hookform/resolvers/zod';
import { emailRequestSchema } from '@optime/shared-schemas';
import { useMutation } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { requestPasswordReset } from '@/api/auth';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';

type ForgotPasswordForm = z.infer<typeof emailRequestSchema>;

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(emailRequestSchema),
    defaultValues: { email: '' }
  });
  const mutation = useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: () => {
      router.push(
        `/(auth)/reset-password?email=${encodeURIComponent(form.getValues('email'))}` as Href
      );
    }
  });

  return (
    <Screen topSafeArea={false}>
      <View style={styles.hero}>
        <BrandLogo style={styles.logo} width={252} />
        <Text variant="title" style={styles.title}>{t('auth.forgotPassword')}</Text>
        <Text variant="muted" style={styles.subtitle}>{t('auth.forgotPasswordMessage')}</Text>
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
        <Button
          title={mutation.isPending ? t('auth.sendingCode') : t('auth.sendResetCode')}
          loading={mutation.isPending}
          disabled={mutation.isPending}
          onPress={form.handleSubmit((values) => mutation.mutate(values))}
        />
        {mutation.isError ? <Text variant="caption">{t('auth.codeSendFailed')}</Text> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 10, paddingTop: 30 },
  logo: { alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 30, lineHeight: 35, textAlign: 'center' },
  subtitle: { textAlign: 'center' }
});
