import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { colors } from '@/theme/colors';
import { Text } from './Text';

interface SettingsListItemProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
}

export function SettingsListItem({ icon, title, subtitle, value, onPress }: SettingsListItemProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join('. ')}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.copy}>
        <Text variant="body" style={styles.title}>{title}</Text>
        {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
      </View>
      {value ? <Text variant="caption" style={styles.value}>{value}</Text> : null}
      {onPress ? <ChevronRight size={18} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

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
    backgroundColor: colors.surfaceMuted,
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
  }
});
