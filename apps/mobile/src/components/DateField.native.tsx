import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from '@/theme/theme-provider';

interface DateFieldProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  maximumDate?: Date;
}

export function DateField({ label, placeholder, value, onChange, maximumDate = new Date() }: DateFieldProps) {
  const { t, i18n } = useTranslation();
  const { colors, mode } = useTheme();
  const styles = createStyles(colors);
  const [visible, setVisible] = useState(false);
  const [draftDate, setDraftDate] = useState(() => parseDate(value));

  useEffect(() => {
    if (visible) setDraftDate(parseDate(value));
  }, [value, visible]);

  const updateDate = (nextDate?: Date) => {
    if (!nextDate) return;
    if (Platform.OS === 'android') {
      onChange(formatDateValue(nextDate));
      setVisible(false);
      return;
    }
    setDraftDate(nextDate);
  };

  const picker = (
    <DateTimePicker
      accentColor={colors.accent}
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      maximumDate={maximumDate}
      mode="date"
      onChange={(_, nextDate) => updateDate(nextDate)}
      style={styles.picker}
      textColor={colors.textPrimary}
      themeVariant={mode}
      value={draftDate}
    />
  );

  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.input,
          visible ? styles.inputFocused : null,
          pressed ? styles.pressed : null
        ]}
      >
        <Text style={value ? styles.value : styles.placeholder}>
          {value ? formatDisplayDate(value, i18n.language) : placeholder}
        </Text>
      </Pressable>
      {Platform.OS === 'android' && visible ? picker : null}
      <BottomSheet visible={Platform.OS === 'ios' && visible} title={label} onClose={() => setVisible(false)}>
        <View style={styles.sheetContent}>
          {picker}
          <Button
            title={t('common.save')}
            onPress={() => {
              onChange(formatDateValue(draftDate));
              setVisible(false);
            }}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

function parseDate(value: string) {
  const parsed = value ? new Date(`${value}T12:00:00`) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDateValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(parseDate(value));
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: 16
  },
  inputFocused: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.accent
  },
  value: { color: colors.textPrimary, fontSize: 16, fontWeight: '500' },
  placeholder: { color: colors.textMuted, fontSize: 16, fontWeight: '500' },
  pressed: { opacity: 0.78 },
  sheetContent: { gap: 16 },
  picker: { alignSelf: 'center', height: 216, width: '100%' }
});
