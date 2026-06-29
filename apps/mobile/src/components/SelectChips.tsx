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
              onPress={() => onChange(option.value)}
              style={[styles.chip, active ? styles.activeChip : null]}
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
    gap: 8
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  activeChip: {
    borderColor: colors.nutrition,
    backgroundColor: colors.nutritionMuted
  },
  chipText: {
    fontSize: 14,
    color: colors.textPrimary
  },
  activeText: {
    color: colors.primaryDark,
    fontWeight: '700'
  }
});
