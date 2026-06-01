import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/store/auth-store';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  return (
    <Screen>
      <Text variant="heading">Profile</Text>
      <Card>
        <Text variant="label">Account</Text>
        <Text variant="body">{user?.email ?? 'Signed in'}</Text>
        <Text variant="muted">Current plan: Free</Text>
      </Card>
      <Card>
        <Text variant="label">Safety</Text>
        <Text variant="body">{user?.safeMode ? 'Safe mode is active.' : 'Standard wellness mode is active.'}</Text>
        <Text variant="muted">Age-aware safety is managed by the backend from your date of birth.</Text>
      </Card>
      <Button
        title="Log out"
        variant="secondary"
        onPress={async () => {
          await clearSession();
          queryClient.clear();
          router.replace('/(auth)/welcome');
        }}
      />
    </Screen>
  );
}
