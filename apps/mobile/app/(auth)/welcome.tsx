import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
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
        <View style={styles.logo}>
          <Sparkles size={24} color={colors.health} />
        </View>
        <Text variant="label" style={styles.brand}>OptiMe</Text>
        <Text variant="largeTitle">{t('auth.welcomeTitle')}</Text>
        <Text variant="muted">{t('auth.welcomeMessage')}</Text>
      </View>

      <Card variant="elevated">
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
    gap: 12
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.healthMuted,
    borderRadius: 24,
    height: 56,
    justifyContent: 'center',
    width: 56
  },
  brand: {
    color: colors.health,
    fontWeight: '900'
  }
});
