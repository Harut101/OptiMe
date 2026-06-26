import { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { AppIcon, AppIconName } from './AppIcon';
import { lightTheme } from './theme';

export function UIButton({
  title,
  icon,
  variant = 'primary',
  loading,
  disabled,
  style,
  ...props
}: PropsWithChildren<Omit<PressableProps, 'style'> & {
  title: string;
  icon?: AppIconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style
      ]}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={variant === 'primary' ? lightTheme.colors.surface : lightTheme.colors.textPrimary} /> : null}
        {!loading && icon ? <AppIcon name={icon} color={variant === 'primary' ? lightTheme.colors.surface : lightTheme.colors.textPrimary} /> : null}
        <AppText style={[styles.text, variant === 'primary' || variant === 'danger' ? styles.lightText : null]}>{title}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: lightTheme.sizing.touchTarget,
    borderRadius: lightTheme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: lightTheme.spacing.lg,
    borderWidth: 1
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: lightTheme.spacing.sm },
  primary: { backgroundColor: lightTheme.colors.primaryAction, borderColor: lightTheme.colors.primaryAction },
  secondary: { backgroundColor: lightTheme.colors.surface, borderColor: lightTheme.colors.border },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { backgroundColor: lightTheme.colors.error, borderColor: lightTheme.colors.error },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.5 },
  text: { fontWeight: '800', textAlign: 'center' },
  lightText: { color: lightTheme.colors.surface }
});
