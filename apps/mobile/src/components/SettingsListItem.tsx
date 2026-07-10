import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { colors } from '@/theme/colors';
import { StatusPill } from './StatusPill';
import { Text } from './Text';

interface SettingsListItemProps {
  icon?: ReactNode;
  tone?: 'profile' | 'goal' | 'nutrition' | 'training' | 'health' | 'weight' | 'plan' | 'settings' | 'support' | 'danger' | 'neutral';
  title: string;
  subtitle?: string;
  value?: string;
  statusLabel?: string;
  statusTone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function SettingsListItem({
  icon,
  tone = 'neutral',
  title,
  subtitle,
  value,
  statusLabel,
  statusTone = 'neutral',
  trailing,
  onPress,
  accessibilityLabel
}: SettingsListItemProps) {
  const toneStyle = toneStyles[tone];
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? [title, subtitle, value, statusLabel].filter(Boolean).join('. ')}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      {icon ? <View style={[styles.icon, { backgroundColor: toneStyle.background }]}>{icon}</View> : null}
      <View style={styles.copy}>
        <Text variant="body" style={styles.title}>{title}</Text>
        {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
      </View>
      <View style={styles.trailingGroup}>
        {statusLabel ? <StatusPill label={statusLabel} tone={statusTone} /> : null}
        {value ? <Text variant="caption" style={[styles.value, { color: toneStyle.color }]}>{value}</Text> : null}
        {trailing}
        {onPress ? <ChevronRight size={18} color={colors.textMuted} /> : null}
      </View>
    </Pressable>
  );
}

const toneStyles = {
  profile: { background: colors.healthMuted, color: colors.health },
  goal: { background: colors.accentMuted, color: colors.accent },
  nutrition: { background: colors.nutritionMuted, color: colors.nutrition },
  training: { background: colors.trainingMuted, color: colors.training },
  health: { background: colors.healthMuted, color: colors.health },
  weight: { background: colors.successMuted, color: colors.success },
  plan: { background: colors.recoveryMuted, color: colors.recovery },
  settings: { background: colors.infoMuted, color: colors.info },
  support: { background: colors.cardMuted, color: colors.textSecondary },
  danger: { background: colors.dangerMuted, color: colors.danger },
  neutral: { background: colors.surfaceMuted, color: colors.textPrimary }
} as const;

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingVertical: 10
  },
  pressed: {
    opacity: 0.74
  },
  icon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  copy: {
    flex: 1,
    gap: 2
  },
  title: {
    fontWeight: '800'
  },
  value: {
    color: colors.textPrimary,
    fontWeight: '700'
  },
  trailingGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
    justifyContent: 'flex-end'
  }
});
