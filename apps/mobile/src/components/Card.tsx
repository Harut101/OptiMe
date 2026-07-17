import { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

interface CardProps extends PropsWithChildren<ViewProps> {
  variant?: 'default' | 'elevated' | 'muted' | 'hero';
}

export function Card({ children, style, variant = 'default', ...props }: CardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return <View {...props} style={[styles.card, styles[variant], style]}>{children}</View>;
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 26,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 18,
    gap: 12,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3
  },
  default: {},
  elevated: {
    backgroundColor: colors.surfaceElevated,
    shadowOpacity: 0.12,
    elevation: 5
  },
  muted: {
    backgroundColor: colors.cardMuted,
    shadowOpacity: 0.03
  },
  hero: {
    backgroundColor: colors.textPrimary,
    shadowOpacity: 0.15,
    elevation: 6
  }
});
