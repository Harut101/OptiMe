import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import type { ThemeColors } from '@/theme/colors';
import { Text } from './Text';

type MetricCardTone = 'neutral' | 'nutrition' | 'training' | 'recovery' | 'health' | 'info';

interface MetricCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  hint?: string;
  tone?: MetricCardTone;
  icon?: ReactNode;
  comparison?: string;
}

export function MetricCard({ label, value, unit, hint, tone = 'neutral', icon, comparison }: MetricCardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const toneStyles = createToneStyles(colors);
  const displayValue = value === null ? '-' : String(value);

  return (
    <View
      style={[styles.card, styles[tone]]}
      accessible
      accessibilityLabel={[label, displayValue, unit, hint, comparison].filter(Boolean).join('. ')}
    >
      <View style={styles.header}>
        <Text variant="caption" style={styles.label}>{label}</Text>
        {icon ? <View style={styles.icon}>{icon}</View> : <View style={[styles.dot, toneStyles[tone]]} />}
      </View>
      <View style={styles.valueRow}>
        <Text variant="metric" style={styles.value}>{displayValue}</Text>
        {unit ? <Text variant="caption" style={styles.unit}>{unit}</Text> : null}
      </View>
      {hint ? <Text variant="caption">{hint}</Text> : null}
      {comparison ? <Text variant="caption" style={styles.comparison}>{comparison}</Text> : null}
    </View>
  );
}

const createToneStyles = (colors: ThemeColors) => StyleSheet.create({
  neutral: { backgroundColor: colors.textMuted },
  nutrition: { backgroundColor: colors.nutrition },
  training: { backgroundColor: colors.training },
  recovery: { backgroundColor: colors.recovery },
  health: { backgroundColor: colors.health },
  info: { backgroundColor: colors.info }
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    borderColor: 'rgba(209, 209, 214, 0.72)',
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    minWidth: '45%',
    padding: 15,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between'
  },
  label: {
    color: colors.textSecondary,
    fontWeight: '700'
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  dot: {
    borderRadius: 999,
    height: 10,
    width: 10
  },
  valueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 5
  },
  value: {
    fontSize: 29,
    lineHeight: 34
  },
  unit: {
    color: colors.textSecondary,
    fontWeight: '700',
    paddingBottom: 5
  },
  comparison: {
    color: colors.textPrimary,
    fontWeight: '700'
  },
  neutral: {
    backgroundColor: colors.card
  },
  nutrition: {
    backgroundColor: colors.card,
    borderColor: colors.nutritionMuted
  },
  training: {
    backgroundColor: colors.card,
    borderColor: colors.trainingMuted
  },
  recovery: {
    backgroundColor: colors.card,
    borderColor: colors.recoveryMuted
  },
  health: {
    backgroundColor: colors.card,
    borderColor: colors.healthMuted
  },
  info: {
    backgroundColor: colors.card,
    borderColor: colors.infoMuted
  }
});
