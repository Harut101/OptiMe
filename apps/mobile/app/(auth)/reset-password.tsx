import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema } from '@optime/shared-schemas';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { resetPassword } from '@/api/auth';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';

const formSchema = resetPasswordSchema
  .extend({ confirmPassword: z.string().min(8) })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'password_mismatch'
  });
type ResetPasswordForm = z.infer<typeof formSchema>;

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();
  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: params.email ?? '', code: '', newPassword: '', confirmPassword: '' }
  });
  const mutation = useMutation({
    mutationFn: ({ confirmPassword: _confirmPassword, ...values }: ResetPasswordForm) =>
      resetPassword(values),
    onSuccess: () => router.replace('/(auth)/login')
  });

  return (
    <Screen topSafeArea={false}>
      <View style={styles.hero}>
        <BrandLogo style={styles.logo} width={252} />
        <Text variant="title" style={styles.title}>{t('auth.resetPassword')}</Text>
        <Text variant="muted" style={styles.subtitle}>{t('auth.resetPasswordMessage')}</Text>
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
        <Controller
          control={form.control}
          name="newPassword"
          render={({ field, fieldState }) => (
            <Field
              label={t('auth.newPassword')}
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error ? t('errors.validation') : undefined}
            />
          )}
        />
        <Controller
          control={form.control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <Field
              label={t('auth.confirmPassword')}
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error ? t('auth.passwordsDoNotMatch') : undefined}
            />
          )}
        />
        <Button
          title={mutation.isPending ? t('auth.resettingPassword') : t('auth.resetPassword')}
          loading={mutation.isPending}
          disabled={mutation.isPending}
          onPress={form.handleSubmit((values) => mutation.mutate(values))}
        />
        {mutation.isError ? <Text variant="caption">{t('auth.invalidOrExpiredCode')}</Text> : null}
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
