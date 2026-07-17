import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import {
  getDailyPlanCheckIns,
  getEveningReflectionTrend,
  submitDailyPlanCheckIn
} from '@/api/daily-plans';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { SelectChips } from '@/components/SelectChips';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';
import type { EveningReflectionCheckInPayload } from '@/types/api';

interface EveningReflectionSheetProps {
  visible: boolean;
  dailyPlanId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

type ReflectionLevel = '3' | '6' | '9';

const levelOptions: ReflectionLevel[] = ['3', '6', '9'];

export function EveningReflectionSheet({
  visible,
  dailyPlanId,
  onClose,
  onSaved
}: EveningReflectionSheetProps) {
  const { t } = useTranslation();
  const [energyLevel, setEnergyLevel] = useState<ReflectionLevel | null>(null);
  const [tirednessLevel, setTirednessLevel] = useState<ReflectionLevel | null>(null);
  const [sorenessLevel, setSorenessLevel] = useState<ReflectionLevel | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const checkIns = useQuery({
    queryKey: ['daily-plan-check-ins', dailyPlanId],
    queryFn: () => getDailyPlanCheckIns(dailyPlanId!),
    enabled: visible && Boolean(dailyPlanId)
  });
  const trend = useQuery({
    queryKey: ['evening-reflection-trend'],
    queryFn: getEveningReflectionTrend,
    enabled: visible
  });
  const saveReflection = useMutation({
    mutationFn: (payload: EveningReflectionCheckInPayload) =>
      submitDailyPlanCheckIn(dailyPlanId!, {
        type: 'EVENING_REFLECTION',
        payload
      }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['daily-plan-check-ins', dailyPlanId] });
      await queryClient.invalidateQueries({ queryKey: ['evening-reflection-trend'] });
      onSaved();
    },
    onError: () => setError(t('eveningReflection.saveFailed'))
  });

  const existing = checkIns.data?.items.find((item) => item.type === 'EVENING_REFLECTION');

  useEffect(() => {
    if (!visible) return;

    const payload = existing?.payload as EveningReflectionCheckInPayload | undefined;
    setEnergyLevel(toLevel(payload?.energyLevel));
    setTirednessLevel(toLevel(payload?.tirednessLevel));
    setSorenessLevel(toLevel(payload?.sorenessLevel));
    setNotes(payload?.notes ?? '');
    setError(null);
  }, [existing, visible]);

  const save = () => {
    const payload: EveningReflectionCheckInPayload = {
      energyLevel: energyLevel ? Number(energyLevel) : undefined,
      tirednessLevel: tirednessLevel ? Number(tirednessLevel) : undefined,
      sorenessLevel: sorenessLevel ? Number(sorenessLevel) : undefined,
      notes: notes.trim() || undefined
    };

    if (Object.values(payload).every((value) => value === undefined)) {
      setError(t('eveningReflection.chooseDetail'));
      return;
    }

    saveReflection.mutate(payload);
  };

  return (
    <BottomSheet
      visible={visible}
      title={t('eveningReflection.title')}
      subtitle={t('eveningReflection.subtitle')}
      onClose={onClose}
    >
      <View style={styles.content}>
        <Text variant="muted">{t('eveningReflection.help')}</Text>
        {trend.data && trend.data.items.length > 1 ? (
          <View style={styles.trend}>
            <Text variant="label">{t('eveningReflection.recent')}</Text>
            {trend.data.items.map((item) => (
              <Text key={item.planLocalDate} variant="caption">
                {t('eveningReflection.trendValue', {
                  date: item.planLocalDate,
                  energy: item.energyLevel ?? '-',
                  tiredness: item.tirednessLevel ?? '-',
                  soreness: item.sorenessLevel ?? '-'
                })}
              </Text>
            ))}
          </View>
        ) : null}
        <ReflectionSelector
          label={t('eveningReflection.energy')}
          value={energyLevel}
          onChange={setEnergyLevel}
        />
        <ReflectionSelector
          label={t('eveningReflection.tiredness')}
          value={tirednessLevel}
          onChange={setTirednessLevel}
        />
        <ReflectionSelector
          label={t('eveningReflection.soreness')}
          value={sorenessLevel}
          onChange={setSorenessLevel}
        />
        <Field
          label={t('eveningReflection.noteOptional')}
          placeholder={t('eveningReflection.notePlaceholder')}
          value={notes}
          multiline
          onChangeText={setNotes}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          title={saveReflection.isPending ? t('common.saving') : t('eveningReflection.save')}
          loading={saveReflection.isPending}
          disabled={checkIns.isLoading}
          onPress={save}
        />
      </View>
    </BottomSheet>
  );
}

function ReflectionSelector({
  label,
  value,
  onChange
}: {
  label: string;
  value: ReflectionLevel | null;
  onChange: (value: ReflectionLevel) => void;
}) {
  const { t } = useTranslation();

  return (
    <SelectChips
      label={label}
      value={value}
      onChange={onChange}
      options={levelOptions.map((level) => ({ value: level, label: getLevelLabel(level, t) }))}
    />
  );
}

function getLevelLabel(level: ReflectionLevel, t: TFunction) {
  if (level === '3') return t('eveningReflection.level3');
  if (level === '6') return t('eveningReflection.level6');
  return t('eveningReflection.level9');
}

function toLevel(value: unknown): ReflectionLevel | null {
  return value === 3 || value === 6 || value === 9 ? String(value) as ReflectionLevel : null;
}

const styles = StyleSheet.create({
  content: {
    gap: 14
  },
  trend: {
    gap: 4
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600'
  }
});
