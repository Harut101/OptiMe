import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors } from '@/theme/colors';

interface MultiSelectChipsProps<T extends string | number> {
  label: string;
  value: T[];
  options: Array<{ label: string; value: T }>;
  onChange: (value: T[]) => void;
}

export function MultiSelectChips<T extends string | number>({
  label,
  value,
  options,
  onChange
}: MultiSelectChipsProps<T>) {
  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const active = value.includes(option.value);
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              onPress={() =>
                onChange(
                  active
                    ? value.filter((item) => item !== option.value)
                    : [...value, option.value]
                )
              }
              style={[styles.chip, active ? styles.activeChip : null]}
            >
              <Text style={[styles.chipText, active ? styles.activeText : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  activeChip: { borderColor: colors.nutrition, backgroundColor: colors.nutritionMuted },
  chipText: { fontSize: 14, color: colors.textPrimary },
  activeText: { color: colors.primaryDark, fontWeight: '700' }
});
