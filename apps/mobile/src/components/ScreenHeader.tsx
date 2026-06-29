import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Text } from './Text';

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

export function ScreenHeader({ eyebrow, title, subtitle }: ScreenHeaderProps) {
  return (
    <View style={styles.container} accessible accessibilityRole="header">
      {eyebrow ? <Text variant="label">{eyebrow}</Text> : null}
      <Text variant="title" style={styles.title}>
        {title}
      </Text>
      {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingBottom: 2
  },
  title: {
    color: colors.ink
  }
});
