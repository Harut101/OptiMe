import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MeasurementSystem } from '@optime/shared-types';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Card>
          <Text variant="heading">{t('weight.updateWeight')}</Text>
          <Text variant="muted">{t('weight.futurePlansOnly')}</Text>
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
          <Button title={isSaving ? t('common.saving') : t('weight.saveWeight')} disabled={isSaving} onPress={submit} />
          <Button title={t('common.cancel')} variant="secondary" disabled={isSaving} onPress={onClose} />
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(16, 23, 19, 0.48)'
  },
  error: {
    color: colors.danger,
    fontWeight: '600'
  }
});
