import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getTrainingPreferences, saveTrainingPreferences } from '@/api/training-preferences';
import { deleteTrainingScheduleItem, getTrainingSchedule } from '@/api/training-schedule';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import {
  EMPTY_TRAINING_SETUP,
  fromTrainingPreference,
  hasTrainingSetup,
  toTrainingPreferenceRequest,
  TrainingSetupForm,
  TrainingSetupFormValue
} from '@/features/training-preferences/TrainingSetupForm';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { colors } from '@/theme/colors';
import { isDraftDirty } from '@/features/editor/draft-state';
import type { TrainingScheduleItem } from '@/types/api';
import { getEquipmentLabel, getIntensityLabel, getMuscleGroupLabel, getSportTypeLabel, getTrainingLevelLabel, getTrainingOutcomeLabel } from '@/i18n/enum-labels';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export default function TrainingScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const preferences = useQuery({ queryKey: ['training-preferences'], queryFn: getTrainingPreferences });
  const schedule = useQuery({ queryKey: ['training-schedule'], queryFn: getTrainingSchedule });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<TrainingSetupFormValue>(EMPTY_TRAINING_SETUP);
  const [savedValue, setSavedValue] = useState<TrainingSetupFormValue>(EMPTY_TRAINING_SETUP);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (preferences.data) {
      const next = fromTrainingPreference(preferences.data);
      setValue(next);
      setSavedValue(next);
    }
  }, [preferences.data]);

  const dirty = isDraftDirty(value, savedValue);
  useUnsavedChangesGuard(editing && dirty);

  const saveMutation = useMutation({
    mutationFn: saveTrainingPreferences,
    onSuccess: (data) => {
      const next = fromTrainingPreference(data);
      setValue(next);
      setSavedValue(next);
      setEditing(false);
      setSuccessMessage(t('training.savedMessage'));
      queryClient.setQueryData(['training-preferences'], data);
    }
  });
  const deleteMutation = useMutation({
    mutationFn: deleteTrainingScheduleItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['training-schedule'] }),
    onError: () => Alert.alert(t('schedule.deleteFailed'), t('errors.unableSave'))
  });

  if (preferences.isLoading || schedule.isLoading) {
    return <Screen><StateBlock title={t('common.loading')} message={t('training.loadingMessage')} /></Screen>;
  }

  if (preferences.isError || schedule.isError) {
    const message = preferences.error?.message ?? schedule.error?.message ?? 'Training setup is unavailable.';
    return (
      <Screen>
        <StateBlock title={t('training.unavailable')} message={message} actionTitle={t('common.retry')} onAction={() => { preferences.refetch(); schedule.refetch(); }} />
      </Screen>
    );
  }

  const hasPreferences = hasTrainingSetup(savedValue);
  const scheduleItems = schedule.data ?? [];

  return (
    <Screen>
      <Text variant="heading">{t('training.title')}</Text>
      <Text variant="muted">{t('training.intro')}</Text>

      {!hasPreferences && scheduleItems.length === 0 && !editing ? (
        <StateBlock
          title={t('training.emptyTitle')}
          message={t('training.emptyMessage')}
          actionTitle={t('training.setup')}
          onAction={() => { setSuccessMessage(null); setEditing(true); }}
        />
      ) : editing ? (
        <>
          <TrainingSetupForm value={value} onChange={setValue} />
          {saveMutation.isError ? <Text style={styles.error}>{saveMutation.error.message}</Text> : null}
          <View style={styles.actions}>
            <Button
              title={saveMutation.isPending ? t('common.saving') : t('common.save')}
              disabled={saveMutation.isPending || !dirty}
              onPress={() => saveMutation.mutate(toTrainingPreferenceRequest(value))}
            />
            <Button
              title={t('common.cancel')}
              variant="secondary"
              disabled={saveMutation.isPending}
              onPress={() => { setValue(savedValue); setEditing(false); }}
            />
          </View>
        </>
      ) : (
        <>
          <TrainingSummary value={savedValue} />
          <Button title={t('common.edit')} variant="secondary" onPress={() => { setSuccessMessage(null); setEditing(true); }} />
        </>
      )}

      <ScheduleSection items={scheduleItems} onDelete={(id) => deleteMutation.mutate(id)} />
      {successMessage ? <Card><Text variant="label">{t('common.saved')}</Text><Text variant="muted">{successMessage}</Text></Card> : null}
    </Screen>
  );
}

function TrainingSummary({ value }: { value: TrainingSetupFormValue }) {
  const { t } = useTranslation();
  return (
    <Card>
      <Text variant="label">{t('training.current')}</Text>
      <Text>{t('training.focus')}: {value.trainingOutcome ? getTrainingOutcomeLabel(t, value.trainingOutcome) : t('common.notSet')}</Text>
      <Text variant="muted">{t('training.level')}: {value.trainingLevel ? getTrainingLevelLabel(t, value.trainingLevel) : t('common.notSet')}</Text>
      <Text variant="muted">{t('training.equipment')}: {value.equipment.length ? value.equipment.map((item) => getEquipmentLabel(t, item)).join(', ') : t('common.notSet')}</Text>
      <Text variant="muted">{t('training.targetMuscles')}: {value.targetMuscleGroups.length ? value.targetMuscleGroups.map((item) => getMuscleGroupLabel(t, item)).join(', ') : t('common.notSet')}</Text>
      <Text variant="muted">{t('training.limitations')}: {value.limitationsOrPainAreas || t('common.noneAdded')}</Text>
    </Card>
  );
}

function ScheduleSection({ items, onDelete }: { items: TrainingScheduleItem[]; onDelete: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.grow}><Text variant="heading">{t('schedule.weekly')}</Text><Text variant="muted">{t('schedule.weeklyHelp')}</Text></View>
        <Button title={t('common.add')} variant="secondary" onPress={() => router.push('/training-schedule/create')} />
      </View>
      {items.length === 0 ? <Card><Text variant="muted">{t('schedule.noPlanned')}</Text></Card> : items.map((item) => (
        <Card key={item.id}>
          <Text variant="label">{t(`enums.weekdays.${DAY_KEYS[item.dayOfWeek]}` as never)} {t('common.at')} {item.localTime}</Text>
          <Text>{getSportTypeLabel(t, item.sportType)} · {item.durationMinutes} {t('common.minutesShort')} · {getIntensityLabel(t, item.intensity)}</Text>
          {item.description ? <Text variant="muted">{item.description}</Text> : null}
          <View style={styles.row}>
            <Button title={t('common.edit')} variant="secondary" onPress={() => router.push({ pathname: '/training-schedule/edit', params: { ...item, dayOfWeek: String(item.dayOfWeek), durationMinutes: String(item.durationMinutes), description: item.description ?? '' } })} />
            <Button title={t('common.delete')} variant="danger" onPress={() => onDelete(item.id)} />
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  error: { color: colors.danger, fontWeight: '600' },
  section: { gap: 12, marginTop: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', gap: 10 }
});
