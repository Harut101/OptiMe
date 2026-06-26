import { PropsWithChildren } from 'react';
import { Text as NativeText, StyleSheet, TextProps } from 'react-native';

import { lightTheme } from './theme';

export function AppText({
  children,
  variant = 'body',
  style,
  ...props
}: PropsWithChildren<TextProps & { variant?: 'title' | 'heading' | 'body' | 'label' | 'caption' | 'muted' }>) {
  return (
    <NativeText {...props} style={[styles.base, styles[variant], style]}>
      {children}
    </NativeText>
  );
}

const styles = StyleSheet.create({
  base: { color: lightTheme.colors.textPrimary },
  title: lightTheme.typography.title,
  heading: lightTheme.typography.heading,
  body: lightTheme.typography.body,
  label: { ...lightTheme.typography.label, textTransform: 'uppercase', color: lightTheme.colors.textSecondary },
  caption: lightTheme.typography.caption,
  muted: { ...lightTheme.typography.body, color: lightTheme.colors.textSecondary }
});
