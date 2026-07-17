import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import type { ThemeColors } from '@/theme/colors';
import { useTheme } from '@/theme/theme-provider';
import { StatusPill } from './StatusPill';
import { Text } from './Text';

interface WorkoutCardV2Props {
  label: string;
  title: string;
  subtitle?: string;
  meta?: string;
  statusLabel: string;
  statusTone?: 'neutral' | 'success' | 'warning' | 'danger' | 'nutrition' | 'training' | 'recovery' | 'health' | 'info';
  onPress?: () => void;
  accessibilityLabel?: string;
  children?: ReactNode;
}

export function WorkoutCardV2({
  label,
  title,
  subtitle,
  meta,
  statusLabel,
  statusTone = 'neutral',
  onPress,
  accessibilityLabel,
  children
}: WorkoutCardV2Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const content = (
    <>
      <View style={styles.header}>
        <Text variant="caption" style={styles.label}>{label}</Text>
        <StatusPill label={statusLabel} tone={statusTone} />
      </View>
      <Text variant="heading" style={styles.title}>{title}</Text>
      {subtitle ? <Text variant="body">{subtitle}</Text> : null}
      {meta ? <Text variant="caption">{meta}</Text> : null}
      {children}
    </>
  );

  if (!onPress) {
    return <View style={styles.card}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}. ${title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      {content}
      <ChevronRight size={20} color={colors.textMuted} style={styles.chevron} />
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.divider,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 16,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 2
  },
  pressed: {
    opacity: 0.86
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between'
  },
  label: {
    color: colors.training,
    fontWeight: '600'
  },
  title: {
    fontSize: 22,
    lineHeight: 27
  },
  chevron: {
    position: 'absolute',
    bottom: 16,
    right: 16
  }
});
