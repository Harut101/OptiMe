import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Text } from './Text';

type MetricCardTone = 'neutral' | 'nutrition' | 'training' | 'recovery' | 'health' | 'info';

interface MetricCardProps {
  label: string;
  value: string | number | null;
  hint?: string;
  tone?: MetricCardTone;
}

export function MetricCard({ label, value, hint, tone = 'neutral' }: MetricCardProps) {
  const displayValue = value === null ? '-' : String(value);

  return (
    <View
      style={[styles.card, styles[tone]]}
      accessible
      accessibilityLabel={hint ? `${label}: ${displayValue}. ${hint}` : `${label}: ${displayValue}`}
    >
      <Text variant="muted">{label}</Text>
      <Text variant="body" style={styles.value}>
        {displayValue}
      </Text>
      {hint ? <Text variant="muted">{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.divider,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    minWidth: '45%',
    padding: 14
  },
  value: {
    fontWeight: '800'
  },
  neutral: {
    backgroundColor: colors.cardMuted
  },
  nutrition: {
    backgroundColor: colors.nutritionMuted,
    borderColor: colors.nutrition
  },
  training: {
    backgroundColor: colors.trainingMuted,
    borderColor: colors.training
  },
  recovery: {
    backgroundColor: colors.recoveryMuted,
    borderColor: colors.recovery
  },
  health: {
    backgroundColor: colors.healthMuted,
    borderColor: colors.health
  },
  info: {
    backgroundColor: colors.infoMuted,
    borderColor: colors.info
  }
});
