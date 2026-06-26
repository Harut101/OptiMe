import { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { lightTheme } from './theme';

export function UICard({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  return <View {...props} style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: lightTheme.colors.surface,
    borderWidth: 1,
    borderColor: lightTheme.colors.border,
    borderRadius: lightTheme.radius.lg,
    padding: lightTheme.spacing.lg,
    gap: lightTheme.spacing.md,
    ...lightTheme.shadows.card
  }
});
