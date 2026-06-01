import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';

export default function WelcomeScreen() {
  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <Text variant="label">OptiMe</Text>
        <Text variant="title">A calmer way to plan food, training, and recovery.</Text>
        <Text variant="muted">
          Start with a simple profile and get a supportive daily plan built around consistency.
        </Text>
      </View>

      <Card>
        <Text variant="heading">Daily planning</Text>
        <Text variant="muted">
          Set up your profile and generate a simple plan for food, training, hydration, and recovery.
        </Text>
        <Button title="Create account" onPress={() => router.push('/(auth)/register')} />
        <Button title="Log in" variant="secondary" onPress={() => router.push('/(auth)/login')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    paddingLeft: 18
  }
});
