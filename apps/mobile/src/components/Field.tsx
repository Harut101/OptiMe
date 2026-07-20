import { useState } from 'react';
import { TextInput, TextInputProps, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from '@/theme/theme-provider';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function Field({ label, error, style, multiline = false, onBlur, onFocus, ...props }: FieldProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          multiline ? styles.inputMultiline : styles.inputSingleLine,
          focused ? styles.inputFocused : null,
          error ? styles.inputError : null,
          style
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  wrap: {
    gap: 6
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22
  },
  inputSingleLine: {
    height: 52,
    paddingVertical: 0,
    textAlignVertical: 'center'
  },
  inputMultiline: {
    minHeight: 56,
    paddingBottom: 14,
    paddingTop: 14,
    textAlignVertical: 'center'
  },
  inputFocused: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.accent
  },
  inputError: {
    borderColor: colors.danger
  },
  error: {
    color: colors.danger,
    fontSize: 13
  }
});
