import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack>
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="goal" options={{ title: 'Goal' }} />
      <Stack.Screen name="nutrition-preferences" options={{ title: 'Nutrition' }} />
      <Stack.Screen name="training-preferences" options={{ title: 'Training preferences' }} />
      <Stack.Screen name="training-schedule/index" options={{ title: 'Training schedule' }} />
      <Stack.Screen name="training-schedule/create" options={{ title: 'Add workout' }} />
      <Stack.Screen name="training-schedule/edit" options={{ title: 'Edit workout' }} />
    </Stack>
  );
}
