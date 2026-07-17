import { ActivityIndicator, Pressable, PressableProps, StyleSheet, View, ViewStyle } from 'react-native';

import { Text } from './Text';
import { useTheme } from '@/theme/theme-provider';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({ title, variant = 'primary', loading = false, disabled, style, ...props }: ButtonProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
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
          <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? colors.textOnAccent : colors.textPrimary} />
        ) : null}
        <Text variant="button" style={[
          styles.text,
          variant === 'primary' || variant === 'danger' ? styles.primaryText : null,
          variant === 'secondary' || variant === 'ghost' ? styles.darkText : null
        ]}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    borderWidth: 1
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center'
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
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
    textAlign: 'center'
  },
  primaryText: {
    color: colors.textOnAccent
  },
  darkText: {
    color: colors.textPrimary
  }
});
