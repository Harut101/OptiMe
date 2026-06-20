import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <Text variant="label">OptiMe</Text>
        <Text variant="title">{t('auth.welcomeTitle')}</Text>
        <Text variant="muted">{t('auth.welcomeMessage')}</Text>
      </View>

      <Card>
        <Text variant="heading">{t('auth.dailyPlanning')}</Text>
        <Text variant="muted">{t('auth.dailyPlanningMessage')}</Text>
        <Button title={t('auth.createAccount')} onPress={() => router.push('/(auth)/register')} />
        <Button title={t('auth.login')} variant="secondary" onPress={() => router.push('/(auth)/login')} />
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
