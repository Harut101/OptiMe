import { PropsWithChildren } from 'react';
import { Text as NativeText, StyleSheet, TextProps } from 'react-native';

import { lightTheme } from './theme';

export type AppTextVariant =
  | 'hero'
  | 'title'
  | 'heading'
  | 'bodyStrong'
  | 'body'
  | 'label'
  | 'caption'
  | 'button'
  | 'finePrint'
  | 'muted';

export function AppText({
  children,
  variant = 'body',
  style,
  ...props
}: PropsWithChildren<TextProps & { variant?: AppTextVariant }>) {
  return (
    <NativeText {...props} style={[styles.base, styles[variant], style]}>
      {children}
    </NativeText>
  );
}

const styles = StyleSheet.create({
  base: { color: lightTheme.colors.textPrimary },
  hero: lightTheme.typography.hero,
  title: lightTheme.typography.title,
  heading: lightTheme.typography.heading,
  bodyStrong: lightTheme.typography.bodyStrong,
  body: lightTheme.typography.body,
  label: { ...lightTheme.typography.label, color: lightTheme.colors.textSecondary },
  caption: lightTheme.typography.caption,
  button: lightTheme.typography.button,
  finePrint: { ...lightTheme.typography.finePrint, color: lightTheme.colors.textSecondary },
  muted: { ...lightTheme.typography.body, color: lightTheme.colors.textSecondary }
});
