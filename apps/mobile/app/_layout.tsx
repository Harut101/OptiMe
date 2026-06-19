import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '@/providers/app-providers';
import { colors } from '@/theme/colors';

export default function RootLayout() {
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
        <Stack.Screen name="plan-details" options={{ title: 'Plan details', headerBackTitle: 'Today' }} />
        <Stack.Screen name="health-data" options={{ title: 'Health data', headerBackTitle: 'Profile' }} />
        <Stack.Screen name="goal-editor" options={{ title: 'Goals', headerBackTitle: 'Profile' }} />
        <Stack.Screen name="training-schedule/create" options={{ title: 'Add workout', headerBackTitle: 'Training' }} />
        <Stack.Screen name="training-schedule/edit" options={{ title: 'Edit workout', headerBackTitle: 'Training' }} />
      </Stack>
    </AppProviders>
  );
}
