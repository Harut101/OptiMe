import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Field } from './Field';
import { useTheme } from '@/theme/theme-provider';

interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const { t, i18n } = useTranslation();
  const { colors, mode } = useTheme();
  const styles = createStyles(colors);
  const [visible, setVisible] = useState(false);
  const [draftTime, setDraftTime] = useState(() => parseTime(value));

  useEffect(() => {
    if (visible) setDraftTime(parseTime(value));
  }, [value, visible]);

  const updateTime = (nextTime?: Date) => {
    if (!nextTime) return;
    if (Platform.OS === 'android') {
      onChange(formatTimeValue(nextTime));
      setVisible(false);
      return;
    }
    setDraftTime(nextTime);
  };

  const picker = (
    <DateTimePicker
      accentColor={colors.accent}
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      is24Hour
      mode="time"
      onChange={(_, nextTime) => updateTime(nextTime)}
      style={styles.picker}
      textColor={colors.textPrimary}
      themeVariant={mode}
      value={draftTime}
    />
  );

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={() => setVisible(true)}
        style={({ pressed }) => (pressed ? styles.pressed : null)}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        >
          <Field
            caretHidden
            editable={false}
            label={label}
            style={visible ? styles.inputFocused : undefined}
            value={formatDisplayTime(value, i18n.language)}
          />
        </View>
      </Pressable>
      {Platform.OS === 'android' && visible ? picker : null}
      <BottomSheet visible={Platform.OS === 'ios' && visible} title={label} onClose={() => setVisible(false)}>
        <View style={styles.sheetContent}>
          {picker}
          <Button
            title={t('common.save')}
            onPress={() => {
              onChange(formatTimeValue(draftTime));
              setVisible(false);
            }}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

function parseTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(hours) ? hours : 7, Number.isFinite(minutes) ? minutes : 30, 0, 0);
  return date;
}

function formatTimeValue(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function formatDisplayTime(value: string, locale: string) {
  const date = parseTime(value);
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  wrap: { gap: 0 },
  inputFocused: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.accent
  },
  pressed: { opacity: 0.78 },
  sheetContent: { gap: 16 },
  picker: { alignSelf: 'center', height: 216, width: '100%' }
});
