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
    borderWidth: 1,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  neutral: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    color: colors.textSecondary
  },
  success: {
    backgroundColor: colors.successMuted,
    borderColor: colors.success,
    color: colors.success
  },
  nutrition: {
    backgroundColor: colors.nutritionMuted,
    borderColor: colors.nutrition,
    color: colors.primaryDark
  },
  training: {
    backgroundColor: colors.trainingMuted,
    borderColor: colors.training,
    color: colors.training
  },
  recovery: {
    backgroundColor: colors.recoveryMuted,
    borderColor: colors.recovery,
    color: colors.recovery
  },
  health: {
    backgroundColor: colors.healthMuted,
    borderColor: colors.health,
    color: colors.health
  },
  info: {
    backgroundColor: colors.infoMuted,
    borderColor: colors.info,
    color: colors.info
  },
  warning: {
    backgroundColor: colors.warningMuted,
    borderColor: colors.warning,
    color: colors.warning
  },
  danger: {
    backgroundColor: colors.dangerMuted,
    borderColor: colors.danger,
    color: colors.danger
  }
});
