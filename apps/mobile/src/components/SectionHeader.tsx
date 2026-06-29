import { StyleSheet, View } from 'react-native';

import { Text } from './Text';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <View style={styles.container} accessible accessibilityRole="header">
      <Text variant="label">{title}</Text>
      {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4
  }
});
