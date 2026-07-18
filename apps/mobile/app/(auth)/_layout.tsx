import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppBackButton } from '@/components/AppBackButton';
import { useTheme } from '@/theme/theme-provider';

export default function AuthLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerBackVisible: false,
        headerLeft: () => <AppBackButton fallbackHref="/(auth)/welcome" />,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleAlign: 'center',
        headerTitleStyle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
        headerTintColor: colors.textPrimary,
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: t('auth.login') }} />
      <Stack.Screen name="register" options={{ title: t('auth.createAccount') }} />
    </Stack>
  );
}
