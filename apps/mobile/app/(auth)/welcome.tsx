import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Dumbbell, HeartPulse, Sparkles, Utensils } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Sparkles size={28} color={colors.textInverse} />
        </View>
        <Text variant="label" style={styles.brand}>OptiMe</Text>
        <Text variant="largeTitle">{t('auth.welcomeTitle')}</Text>
        <Text variant="muted">{t('auth.welcomeMessage')}</Text>
      </View>

      <Card variant="elevated">
        <Text variant="heading">{t('auth.dailyPlanning')}</Text>
        <Text variant="muted">{t('auth.dailyPlanningMessage')}</Text>
        <View style={styles.valueList}>
          <ValueItem icon={<Utensils size={17} color={colors.nutrition} />} title={t('auth.valueNutrition')} />
          <ValueItem icon={<Dumbbell size={17} color={colors.training} />} title={t('auth.valueTraining')} />
          <ValueItem icon={<HeartPulse size={17} color={colors.health} />} title={t('auth.valueHealth')} />
        </View>
        <Button title={t('auth.createAccount')} onPress={() => router.push('/(auth)/register')} />
        <Button title={t('auth.login')} variant="secondary" onPress={() => router.push('/(auth)/login')} />
      </Card>
      <Text variant="caption" style={styles.trust}>{t('auth.trustNote')}</Text>
    </Screen>
  );
}

function ValueItem({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <View style={styles.valueItem}>
      <View style={styles.valueIcon}>{icon}</View>
      <Text variant="caption" style={styles.valueText}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 12,
    paddingTop: 34
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 26,
    height: 60,
    justifyContent: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    width: 60
  },
  brand: {
    color: colors.primaryDark,
    fontWeight: '900'
  },
  valueList: {
    gap: 10
  },
  valueItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10
  },
  valueIcon: {
    alignItems: 'center',
    backgroundColor: colors.cardMuted,
    borderRadius: 13,
    height: 32,
    justifyContent: 'center',
    width: 32
  },
  valueText: {
    color: colors.textSecondary,
    flex: 1,
    fontWeight: '700'
  },
  trust: {
    textAlign: 'center'
  }
});
