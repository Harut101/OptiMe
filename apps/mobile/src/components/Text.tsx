import { PropsWithChildren } from 'react';
import { StyleSheet, Text as RNText, TextProps as RNTextProps } from 'react-native';

import { colors } from '@/theme/colors';

interface TextProps extends RNTextProps, PropsWithChildren {
  variant?: 'title' | 'heading' | 'body' | 'muted' | 'label';
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
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800'
  },
  heading: {
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800'
  },
  body: {
    fontSize: 16,
    lineHeight: 23
  },
  muted: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase'
  }
});
