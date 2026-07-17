import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

interface MiniBarChartProps {
  values: number[];
  color?: string;
}

export function MiniBarChart({ values, color: colorProp }: MiniBarChartProps) {
  const { colors } = useTheme();
  const color = colorProp ?? colors.health;
  const max = Math.max(...values, 1);

  return (
    <View style={styles.row} accessible={false}>
      {values.map((value, index) => (
        <View
          key={`${value}-${index}`}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              height: 10 + Math.round((value / max) * 28),
              opacity: 0.38 + (value / max) * 0.62
            }
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    height: 42
  },
  bar: {
    borderRadius: 999,
    flex: 1,
    minWidth: 5
  }
});
