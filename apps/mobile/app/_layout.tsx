import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

import { AppProviders } from '@/providers/app-providers';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  const { t } = useTranslation();

  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.surface }
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="plan-details" options={{ title: t('navigation.planDetails'), headerBackTitle: t('tabs.today') }} />
        <Stack.Screen name="meal-details" options={{ title: t('navigation.mealDetails'), headerBackTitle: t('tabs.food') }} />
        <Stack.Screen name="exercise-details" options={{ title: t('plan.exerciseDetailsTitle'), headerBackTitle: t('navigation.planDetails') }} />
        <Stack.Screen name="health-data" options={{ title: t('navigation.healthData'), headerBackTitle: t('tabs.profile') }} />
        <Stack.Screen name="goal-editor" options={{ title: t('navigation.goals'), headerBackTitle: t('tabs.profile') }} />
        <Stack.Screen name="design-system-preview" options={{ title: t('navigation.designSystem'), headerBackTitle: t('tabs.profile') }} />
        <Stack.Screen name="training-schedule/create" options={{ title: t('navigation.addWorkout'), headerBackTitle: t('tabs.training') }} />
        <Stack.Screen name="training-schedule/edit" options={{ title: t('navigation.editWorkout'), headerBackTitle: t('tabs.training') }} />
      </Stack>
    </AppProviders>
  );
}
