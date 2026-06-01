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
    color: colors.ink,
    letterSpacing: 0
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800'
  },
  heading: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700'
  },
  body: {
    fontSize: 16,
    lineHeight: 23
  },
  muted: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    fontWeight: '700',
    textTransform: 'uppercase'
  }
});
