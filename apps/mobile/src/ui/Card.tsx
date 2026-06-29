import { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { lightTheme } from './theme';

export function UICard({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  return <View {...props} style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: lightTheme.colors.card,
    borderWidth: 1,
    borderColor: lightTheme.colors.border,
    borderRadius: lightTheme.radius.xl,
    padding: lightTheme.spacing.lg,
    gap: lightTheme.spacing.md,
    ...lightTheme.shadows.card
  }
});
