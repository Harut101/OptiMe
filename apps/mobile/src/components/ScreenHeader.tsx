import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { Text } from './Text';

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  rightAccessory?: ReactNode;
}

export function ScreenHeader({ eyebrow, title, subtitle, rightAccessory }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container} accessible accessibilityRole="header">
      {eyebrow || rightAccessory ? (
        <View style={styles.topRow}>
          {eyebrow ? <Text variant="label">{eyebrow}</Text> : <View />}
          {rightAccessory ? <View>{rightAccessory}</View> : null}
        </View>
      ) : null}
      <Text variant="largeTitle" style={styles.title}>
        {title}
      </Text>
      {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    gap: 6,
    paddingBottom: 4,
    paddingTop: 6
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  title: {
    color: colors.textPrimary
  }
});
