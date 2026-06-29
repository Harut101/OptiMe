import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Text } from './Text';

interface MetricCardProps {
  label: string;
  value: string | number | null;
  hint?: string;
}

export function MetricCard({ label, value, hint }: MetricCardProps) {
  const displayValue = value === null ? '-' : String(value);

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={hint ? `${label}: ${displayValue}. ${hint}` : `${label}: ${displayValue}`}
    >
      <Text variant="muted">{label}</Text>
      <Text variant="body" style={styles.value}>
        {displayValue}
      </Text>
      {hint ? <Text variant="muted">{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardMuted,
    borderColor: colors.divider,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    minWidth: '45%',
    padding: 14
  },
  value: {
    fontWeight: '800'
  }
});
