import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MeasurementSystem } from '@optime/shared-types';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Text } from '@/components/Text';
import type { ThemeColors } from '@/theme/colors';
import { useTheme } from '@/theme/theme-provider';
import { getWeightUnit, getWeightUnitLabel, toDisplayWeight } from './weight-format';

interface WeightUpdateModalProps {
  visible: boolean;
  currentWeightKg: number | null;
  measurementSystem: MeasurementSystem;
  isSaving: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (value: { weight: number; unit: 'KG' | 'LB'; note?: string }) => void;
}

export function WeightUpdateModal({
  visible,
  currentWeightKg,
  measurementSystem,
  isSaving,
  error,
  onClose,
  onSave
}: WeightUpdateModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const unitLabel = getWeightUnitLabel(measurementSystem);
  const unit = getWeightUnit(measurementSystem);
  const initialValue = useMemo(() => {
    if (currentWeightKg === null) return '';
    return toDisplayWeight(currentWeightKg, measurementSystem).toFixed(1);
  }, [currentWeightKg, measurementSystem]);
  const [weight, setWeight] = useState(initialValue);
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setWeight(initialValue);
    setNote('');
    setLocalError(null);
  }, [initialValue, visible]);

  const submit = () => {
    const normalized = Number(weight.replace(',', '.'));
    if (!Number.isFinite(normalized) || normalized <= 0) {
      setLocalError(t('weight.invalidWeight'));
      return;
    }
    setLocalError(null);
    onSave({
      weight: normalized,
      unit,
      note: note.trim() || undefined
    });
  };

  return (
    <BottomSheet
      visible={visible}
      title={t('weight.updateWeight')}
      subtitle={t('weight.futurePlansOnly')}
      presentation="form"
      onClose={onClose}
    >
      <View style={styles.content}>
        <Field
          label={t('weight.weightValue', { unit: unitLabel })}
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          accessibilityLabel={t('weight.weightInputAccessibility', { unit: unitLabel })}
          error={localError ?? undefined}
        />
        <Field
          label={t('weight.optionalNote')}
          value={note}
          onChangeText={setNote}
          placeholder={t('weight.notePlaceholder')}
          accessibilityLabel={t('weight.optionalNote')}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          title={isSaving ? t('common.saving') : t('weight.saveWeight')}
          disabled={isSaving}
          style={styles.footerStart}
          onPress={submit}
        />
        <Button title={t('common.cancel')} variant="secondary" disabled={isSaving} onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    flex: 1,
    gap: 12
  },
  footerStart: {
    marginTop: 'auto'
  },
  error: {
    color: colors.danger,
    fontWeight: '600'
  }
});
