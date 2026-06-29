import { StyleSheet } from 'react-native';

import { colors } from '@/theme/colors';
import { Text } from './Text';

type StatusPillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'nutrition' | 'training' | 'recovery' | 'health' | 'info';

interface StatusPillProps {
  label: string;
  tone?: StatusPillTone;
}

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  return (
    <Text
      accessibilityLabel={label}
      style={[styles.base, styles[tone]]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  neutral: {
    backgroundColor: colors.surfaceMuted,
    color: colors.textSecondary
  },
  success: {
    backgroundColor: colors.successMuted,
    color: colors.success
  },
  nutrition: {
    backgroundColor: colors.nutritionMuted,
    color: colors.primaryDark
  },
  training: {
    backgroundColor: colors.trainingMuted,
    color: colors.training
  },
  recovery: {
    backgroundColor: colors.recoveryMuted,
    color: colors.recovery
  },
  health: {
    backgroundColor: colors.healthMuted,
    color: colors.health
  },
  info: {
    backgroundColor: colors.infoMuted,
    color: colors.info
  },
  warning: {
    backgroundColor: colors.warningMuted,
    color: colors.warning
  },
  danger: {
    backgroundColor: colors.dangerMuted,
    color: colors.danger
  }
});
