import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/AppHeader';
import { useTheme } from '@/theme/theme-provider';

export default function AuthLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        header: ({ options }) => (
          <AppHeader
            fallbackHref="/(auth)/welcome"
            title={typeof options.title === 'string' ? options.title : ''}
          />
        ),
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: t('auth.login') }} />
      <Stack.Screen name="register" options={{ title: t('auth.createAccount') }} />
    </Stack>
  );
}
