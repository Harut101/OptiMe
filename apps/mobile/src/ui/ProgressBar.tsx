import { DimensionValue, StyleSheet, View } from 'react-native';

import { lightTheme } from './theme';

export function ProgressBar({ value }: { value: number }) {
  const width = `${Math.min(Math.max(value, 0), 1) * 100}%` as DimensionValue;
  return <View style={styles.track}><View style={[styles.fill, { width }]} /></View>;
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: lightTheme.colors.surfaceSecondary,
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: lightTheme.colors.brand
  }
});
