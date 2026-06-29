import { StyleSheet } from 'react-native';

import { colors } from '@/theme/colors';
import { Text } from './Text';

type StatusPillTone = 'neutral' | 'success' | 'warning' | 'danger';

interface StatusPillProps {
  label: string;
  tone?: StatusPillTone;
}

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  return (
    <Text
      accessibilityLabel={label}
      style={[styles.base, styles[tone]]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  neutral: {
    backgroundColor: '#eef3ef',
    color: colors.muted
  },
  success: {
    backgroundColor: '#e7f3ef',
    color: colors.primaryDark
  },
  warning: {
    backgroundColor: '#fff3df',
    color: colors.accent
  },
  danger: {
    backgroundColor: '#ffe8e8',
    color: colors.danger
  }
});
