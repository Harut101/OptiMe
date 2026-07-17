import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import type { ThemeColors } from '@/theme/colors';
import { useTheme } from '@/theme/theme-provider';
import { StatusPill } from './StatusPill';
import { Text } from './Text';

interface MealCardV2Props {
  type: string;
  title: string;
  meta: string;
  prep?: string | null;
  statusLabel: string;
  statusTone?: 'neutral' | 'success' | 'warning' | 'danger';
  accessibilityLabel: string;
  onPress: () => void;
  actions?: ReactNode;
}

export function MealCardV2({
  type,
  title,
  meta,
  prep,
  statusLabel,
  statusTone = 'neutral',
  accessibilityLabel,
  onPress,
  actions
}: MealCardV2Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.pressable, pressed ? styles.pressed : null]}
      >
        <View style={styles.copy}>
          <Text variant="caption" style={styles.type}>{type}</Text>
          <Text variant="body" style={styles.title}>{title}</Text>
          <Text variant="caption">{meta}{prep ? ` · ${prep}` : ''}</Text>
        </View>
        <View style={styles.trailing}>
          <StatusPill label={statusLabel} tone={statusTone} />
          <ChevronRight size={18} color={colors.textMuted} />
        </View>
      </Pressable>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.divider,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden'
  },
  pressable: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 14
  },
  pressed: {
    backgroundColor: colors.cardPressed
  },
  copy: {
    flex: 1,
    gap: 3
  },
  type: {
    color: colors.nutrition,
    fontWeight: '600'
  },
  title: {
    fontWeight: '600'
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 8
  },
  actions: {
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 10
  }
});
