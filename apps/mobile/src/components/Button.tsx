import { Pressable, PressableProps, StyleSheet, ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors } from '@/theme/colors';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: ViewStyle;
}

export function Button({ title, variant = 'primary', disabled, style, ...props }: ButtonProps) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style
      ]}
    >
      <Text style={[styles.text, variant === 'secondary' || variant === 'ghost' ? styles.darkText : null]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18
  },
  primary: {
    backgroundColor: colors.health
  },
  secondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border
  },
  ghost: {
    backgroundColor: 'transparent'
  },
  danger: {
    backgroundColor: colors.danger
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }]
  },
  disabled: {
    opacity: 0.5
  },
  text: {
    color: colors.textInverse,
    fontWeight: '700',
    textAlign: 'center'
  },
  darkText: {
    color: colors.textPrimary
  }
});
