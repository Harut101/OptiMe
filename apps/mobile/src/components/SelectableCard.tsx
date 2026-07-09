import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

import { colors } from '@/theme/colors';
import { Text } from './Text';

interface SelectableCardProps {
  icon?: ReactNode;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

export function SelectableCard({
  icon,
  title,
  subtitle,
  selected,
  onPress,
  accessibilityLabel
}: SelectableCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? `${title}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.selected : null,
        pressed ? styles.pressed : null
      ]}
    >
      <View style={[styles.iconWrap, selected ? styles.iconSelected : null]}>
        {icon}
      </View>
      <View style={styles.copy}>
        <Text variant="body" style={styles.title}>{title}</Text>
        <Text variant="caption">{subtitle}</Text>
      </View>
      {selected ? <CheckCircle2 size={22} color={colors.primaryDark} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 78,
    padding: 14,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2
  },
  selected: {
    backgroundColor: colors.healthMuted,
    borderColor: colors.primary,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.13
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }]
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 17,
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  iconSelected: {
    backgroundColor: colors.primary
  },
  copy: {
    flex: 1,
    gap: 3
  },
  title: {
    fontWeight: '900'
  }
});
