import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/AppHeader';
import { useTheme } from '@/theme/theme-provider';

export default function OnboardingLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={({ route }) => ({
        header: ({ options }) => (
          <AppHeader
            fallbackHref="/(onboarding)/profile"
            showBack={route.name !== 'profile'}
            title={typeof options.title === 'string' ? options.title : ''}
          />
        ),
        contentStyle: { backgroundColor: colors.background }
      })}
    >
      <Stack.Screen
        name="profile"
        options={{ title: t('onboarding.foundationTitle') }}
      />
      <Stack.Screen name="goal" options={{ title: t('onboarding.directionTitle') }} />
      <Stack.Screen name="nutrition-preferences" options={{ title: t('onboarding.foodTitle') }} />
      <Stack.Screen name="training-next-step" options={{ title: t('training.title') }} />
    </Stack>
  );
}
