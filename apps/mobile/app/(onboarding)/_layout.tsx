import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function OnboardingLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="profile" options={{ title: t('onboarding.foundationTitle') }} />
      <Stack.Screen name="goal" options={{ title: t('onboarding.directionTitle') }} />
      <Stack.Screen name="nutrition-preferences" options={{ title: t('onboarding.foodTitle') }} />
      <Stack.Screen name="training-next-step" options={{ title: t('training.title') }} />
    </Stack>
  );
}
