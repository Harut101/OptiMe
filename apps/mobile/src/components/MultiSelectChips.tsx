import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from '@/theme/theme-provider';

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
  const { colors } = useTheme();
  const styles = createStyles(colors);

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
              style={({ pressed }) => [styles.chip, active ? styles.activeChip : null, pressed ? styles.pressed : null]}
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

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  activeChip: {
    borderColor: colors.training,
    backgroundColor: colors.trainingMuted
  },
  pressed: { opacity: 0.82 },
  chipText: { fontSize: 14, color: colors.textSecondary, fontWeight: '700' },
  activeText: { color: colors.training, fontWeight: '800' }
});
