import { Pressable, PressableProps, StyleSheet } from 'react-native';

import { AppText } from './AppText';
import { lightTheme } from './theme';

export function Chip({
  label,
  selected,
  ...props
}: PressableProps & { label: string; selected?: boolean }) {
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected ? styles.selected : null]}
    >
      <AppText style={[styles.text, selected ? styles.selectedText : null]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: lightTheme.sizing.touchTarget,
    borderRadius: lightTheme.radius.sm,
    borderWidth: 1,
    borderColor: lightTheme.colors.border,
    paddingHorizontal: lightTheme.spacing.md,
    justifyContent: 'center',
    backgroundColor: lightTheme.colors.surface
  },
  selected: { borderColor: lightTheme.colors.brand, backgroundColor: lightTheme.colors.brandSoft },
  text: { fontWeight: '700' },
  selectedText: { color: lightTheme.colors.primaryAction }
});
