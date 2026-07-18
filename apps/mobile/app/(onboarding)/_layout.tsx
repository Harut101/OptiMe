import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppBackButton } from '@/components/AppBackButton';
import { useTheme } from '@/theme/theme-provider';

export default function OnboardingLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerBackVisible: false,
        headerLeft: () => <AppBackButton fallbackHref="/(onboarding)/profile" />,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleAlign: 'center',
        headerTitleStyle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
        headerTintColor: colors.textPrimary,
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <Stack.Screen
        name="profile"
        options={{ headerLeft: () => null, title: t('onboarding.foundationTitle') }}
      />
      <Stack.Screen name="goal" options={{ title: t('onboarding.directionTitle') }} />
      <Stack.Screen name="nutrition-preferences" options={{ title: t('onboarding.foodTitle') }} />
      <Stack.Screen name="training-next-step" options={{ title: t('training.title') }} />
    </Stack>
  );
}
