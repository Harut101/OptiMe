import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Text } from './Text';

type StatusPillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'nutrition' | 'training' | 'recovery' | 'health' | 'info';

interface StatusPillProps {
  label: string;
  tone?: StatusPillTone;
}

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  return (
    <View accessibilityLabel={label} style={[styles.base, styles[tone]]}>
      <Text style={[styles.label, styles[`${tone}Label`]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    maxWidth: '100%',
    minHeight: 28,
    overflow: 'hidden',
    paddingHorizontal: 10,
    flexShrink: 1
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
    lineHeight: 16
  },
  neutral: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  neutralLabel: {
    color: colors.textSecondary
  },
  success: {
    backgroundColor: colors.successMuted,
    borderColor: colors.success
  },
  successLabel: { color: colors.success },
  nutrition: {
    backgroundColor: colors.nutritionMuted,
    borderColor: colors.nutrition
  },
  nutritionLabel: { color: colors.primaryDark },
  training: {
    backgroundColor: colors.trainingMuted,
    borderColor: colors.training
  },
  trainingLabel: { color: colors.training },
  recovery: {
    backgroundColor: colors.recoveryMuted,
    borderColor: colors.recovery
  },
  recoveryLabel: { color: colors.recovery },
  health: {
    backgroundColor: colors.healthMuted,
    borderColor: colors.health
  },
  healthLabel: { color: colors.health },
  info: {
    backgroundColor: colors.infoMuted,
    borderColor: colors.info
  },
  infoLabel: { color: colors.info },
  warning: {
    backgroundColor: colors.warningMuted,
    borderColor: colors.warning
  },
  warningLabel: { color: colors.warning },
  danger: {
    backgroundColor: colors.dangerMuted,
    borderColor: colors.danger
  },
  dangerLabel: { color: colors.danger }
});
