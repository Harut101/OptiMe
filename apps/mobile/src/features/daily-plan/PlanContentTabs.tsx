import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import type { ThemeColors } from '@/theme/colors';
import { useTheme } from '@/theme/theme-provider';

export type PlanContentTab = 'food' | 'training';

interface PlanContentTabsProps {
  value: PlanContentTab;
  foodLabel: string;
  trainingLabel: string;
  onChange: (value: PlanContentTab) => void;
}

export function PlanContentTabs({ value, foodLabel, trainingLabel, onChange }: PlanContentTabsProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {([
        ['food', foodLabel],
        ['training', trainingLabel]
      ] as const).map(([tab, label]) => {
        const selected = value === tab;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            onPress={() => onChange(tab)}
            style={({ pressed }) => [styles.tab, selected && styles.selectedTab, pressed && styles.pressed]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    gap: 4
  },
  tab: {
    flex: 1,
    minHeight: 46,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  selectedTab: {
    backgroundColor: colors.card,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1
  },
  pressed: { opacity: 0.78 },
  label: { color: colors.textSecondary, fontWeight: '700' },
  selectedLabel: { color: colors.textPrimary }
});
