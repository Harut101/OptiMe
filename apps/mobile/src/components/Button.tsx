import { ActivityIndicator, Pressable, PressableProps, StyleSheet, View, ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors } from '@/theme/colors';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({ title, variant = 'primary', loading = false, disabled, style, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={variant === 'primary' ? colors.textInverse : colors.textPrimary} />
        ) : null}
        <Text style={[
          styles.text,
          variant === 'primary' ? styles.primaryText : null,
          variant === 'secondary' || variant === 'ghost' ? styles.darkText : null
        ]}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 18,
    elevation: 2
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center'
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  secondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }]
  },
  disabled: {
    opacity: 0.48,
    shadowOpacity: 0
  },
  text: {
    color: colors.textInverse,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.1
  },
  primaryText: {
    color: colors.textInverse
  },
  darkText: {
    color: colors.textPrimary
  }
});
