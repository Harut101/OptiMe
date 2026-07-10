import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors } from '@/theme/colors';

interface SelectChipsProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}

export function SelectChips<T extends string>({ label, value, options, onChange }: SelectChipsProps<T>) {
  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [styles.chip, active ? styles.activeChip : null, pressed ? styles.pressed : null]}
            >
              <Text style={[styles.chipText, active ? styles.activeText : null]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    padding: 4
  },
  chip: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  activeChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1
  },
  pressed: {
    opacity: 0.82
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '700'
  },
  activeText: {
    color: colors.textPrimary,
    fontWeight: '800'
  }
});
