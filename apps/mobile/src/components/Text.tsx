import { PropsWithChildren } from 'react';
import { StyleSheet, Text as RNText, TextProps as RNTextProps } from 'react-native';

import { colors } from '@/theme/colors';

interface TextProps extends RNTextProps, PropsWithChildren {
  variant?: 'largeTitle' | 'title' | 'heading' | 'metric' | 'body' | 'muted' | 'caption' | 'label';
}

export function Text({ variant = 'body', style, children, ...props }: TextProps) {
  return (
    <RNText {...props} style={[styles.base, styles[variant], style]}>
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.textPrimary,
    letterSpacing: 0
  },
  largeTitle: {
    fontSize: 40,
    lineHeight: 45,
    fontWeight: '900',
    letterSpacing: -0.8
  },
  title: {
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -0.55
  },
  heading: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.25
  },
  metric: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -0.7
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500'
  },
  muted: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    fontWeight: '500'
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    fontWeight: '700'
  }
});
