import { PropsWithChildren } from 'react';
import { Platform, StyleSheet, Text as RNText, TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

interface TextProps extends RNTextProps, PropsWithChildren {
  variant?: 'largeTitle' | 'title' | 'heading' | 'metric' | 'bodyStrong' | 'body' | 'muted' | 'caption' | 'label' | 'button' | 'finePrint';
}

const systemFontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'system-ui'
});

export function Text({ variant = 'body', style, children, ...props }: TextProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <RNText {...props} style={[styles.base, styles[variant], style]}>
      {children}
    </RNText>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  base: {
    color: colors.textPrimary,
    fontFamily: systemFontFamily
  },
  largeTitle: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '600',
    letterSpacing: -0.4
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '600',
    letterSpacing: -0.35
  },
  heading: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '600',
    letterSpacing: -0.25
  },
  metric: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '600',
    letterSpacing: -0.45
  },
  bodyStrong: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.25
  },
  body: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '400',
    letterSpacing: -0.25
  },
  muted: {
    fontSize: 17,
    lineHeight: 25,
    color: colors.textSecondary,
    letterSpacing: -0.25
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    fontWeight: '400',
    letterSpacing: -0.2
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    color: colors.textMuted,
    fontWeight: '600',
    letterSpacing: -0.2
  },
  button: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.25
  },
  finePrint: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    fontWeight: '400',
    letterSpacing: -0.1
  }
});
