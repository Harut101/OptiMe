import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/AppHeader';
import { AppLaunchSplash } from '@/components/AppLaunchSplash';
import { AppProviders } from '@/providers/app-providers';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme/theme-provider';

export default function RootLayout() {
  return (
    <AppProviders>
      <AppNavigation />
    </AppProviders>
  );
}

function AppNavigation() {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const hydrated = useAuthStore((state) => state.hydrated);
  const [showLaunchSplash, setShowLaunchSplash] = useState(true);

  useEffect(() => {
    if (!hydrated) return;

    const timeout = setTimeout(() => setShowLaunchSplash(false), 1600);
    return () => clearTimeout(timeout);
  }, [hydrated]);

  if (!hydrated || showLaunchSplash) {
    return (
      <>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <AppLaunchSplash />
      </>
    );
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          header: ({ options }) => (
            <AppHeader title={typeof options.title === 'string' ? options.title : ''} />
          ),
          contentStyle: { backgroundColor: colors.background }
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="plan-details" options={{ title: t('navigation.planDetails'), headerBackTitle: t('tabs.today') }} />
        <Stack.Screen name="weekly-routine" options={{ title: t('schedule.weeklySchedule'), headerBackTitle: t('tabs.profile') }} />
        <Stack.Screen name="training-setup" options={{ title: t('training.editSetup'), headerBackTitle: t('tabs.profile') }} />
        <Stack.Screen name="meal-details" options={{ title: t('navigation.mealDetails'), headerBackTitle: t('tabs.food') }} />
        <Stack.Screen name="exercise-details" options={{ title: t('plan.exerciseDetailsTitle'), headerBackTitle: t('navigation.planDetails') }} />
        <Stack.Screen name="workout-session" options={{ title: t('workout.title'), headerBackTitle: t('navigation.planDetails') }} />
        <Stack.Screen name="workout-history" options={{ title: t('workout.workoutHistory'), headerBackTitle: t('tabs.training') }} />
        <Stack.Screen name="weekly-summary" options={{ title: t('weeklySummary.title'), headerBackTitle: t('tabs.profile') }} />
        <Stack.Screen name="health-data" options={{ title: t('navigation.healthData'), headerBackTitle: t('tabs.profile') }} />
        <Stack.Screen name="subscription" options={{ title: t('billing.title'), headerBackTitle: t('tabs.profile') }} />
        <Stack.Screen name="goal-editor" options={{ title: t('navigation.goals'), headerBackTitle: t('tabs.profile') }} />
        <Stack.Screen name="design-system-preview" options={{ title: t('navigation.designSystem'), headerBackTitle: t('tabs.profile') }} />
        <Stack.Screen name="training-schedule/create" options={{ title: t('navigation.addWorkout'), headerBackTitle: t('tabs.training') }} />
        <Stack.Screen name="training-schedule/edit" options={{ title: t('navigation.editWorkout'), headerBackTitle: t('tabs.training') }} />
        <Stack.Screen name="training-overrides/day" options={{ title: t('trainingOverrides.todayOnly'), headerBackTitle: t('tabs.today') }} />
      </Stack>
    </>
  );
}
