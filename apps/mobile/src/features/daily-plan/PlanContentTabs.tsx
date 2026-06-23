import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';

export type PlanContentTab = 'food' | 'training';

interface PlanContentTabsProps {
  value: PlanContentTab;
  foodLabel: string;
  trainingLabel: string;
  onChange: (value: PlanContentTab) => void;
}

export function PlanContentTabs({ value, foodLabel, trainingLabel, onChange }: PlanContentTabsProps) {
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.line,
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
  selectedTab: { backgroundColor: colors.card },
  pressed: { opacity: 0.78 },
  label: { color: colors.muted, fontWeight: '700' },
  selectedLabel: { color: colors.primaryDark }
});
