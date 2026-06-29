import { TextInput, TextInputProps, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors } from '@/theme/colors';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function Field({ label, error, style, ...props }: FieldProps) {
  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    fontSize: 16
  },
  inputError: {
    borderColor: colors.danger
  },
  error: {
    color: colors.danger,
    fontSize: 13
  }
});
