import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TrainingScreen() {
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
      setSuccessMessage('Your updated preferences will be used for future plans.');
      queryClient.setQueryData(['training-preferences'], data);
    }
  });
  const deleteMutation = useMutation({
    mutationFn: deleteTrainingScheduleItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['training-schedule'] }),
    onError: (error) => Alert.alert('Could not delete workout', error.message)
  });

  if (preferences.isLoading || schedule.isLoading) {
    return <Screen><StateBlock title="Loading training setup" message="Checking your preferences and weekly schedule." /></Screen>;
  }

  if (preferences.isError || schedule.isError) {
    const message = preferences.error?.message ?? schedule.error?.message ?? 'Training setup is unavailable.';
    return (
      <Screen>
        <StateBlock title="Training setup unavailable" message={message} actionTitle="Try again" onAction={() => { preferences.refetch(); schedule.refetch(); }} />
      </Screen>
    );
  }

  const hasPreferences = hasTrainingSetup(savedValue);
  const scheduleItems = schedule.data ?? [];

  return (
    <Screen>
      <Text variant="heading">Training</Text>
      <Text variant="muted">Set your training focus, available equipment, target muscles, and weekly rhythm.</Text>

      {!hasPreferences && scheduleItems.length === 0 && !editing ? (
        <StateBlock
          title="Complete your training setup"
          message="Add your environment, equipment, experience level, schedule, and target muscle groups."
          actionTitle="Set up training"
          onAction={() => { setSuccessMessage(null); setEditing(true); }}
        />
      ) : editing ? (
        <>
          <TrainingSetupForm value={value} onChange={setValue} />
          {saveMutation.isError ? <Text style={styles.error}>{saveMutation.error.message}</Text> : null}
          <View style={styles.actions}>
            <Button
              title={saveMutation.isPending ? 'Saving...' : 'Save preferences'}
              disabled={saveMutation.isPending || !dirty}
              onPress={() => saveMutation.mutate(toTrainingPreferenceRequest(value))}
            />
            <Button
              title="Cancel"
              variant="secondary"
              disabled={saveMutation.isPending}
              onPress={() => { setValue(savedValue); setEditing(false); }}
            />
          </View>
        </>
      ) : (
        <>
          <TrainingSummary value={savedValue} />
          <Button title="Edit training preferences" variant="secondary" onPress={() => { setSuccessMessage(null); setEditing(true); }} />
        </>
      )}

      <ScheduleSection items={scheduleItems} onDelete={(id) => deleteMutation.mutate(id)} />
      {successMessage ? <Card><Text variant="label">Saved</Text><Text variant="muted">{successMessage}</Text></Card> : null}
    </Screen>
  );
}

function TrainingSummary({ value }: { value: TrainingSetupFormValue }) {
  return (
    <Card>
      <Text variant="label">Current setup</Text>
      <Text>Focus: {value.trainingOutcome ? humanize(value.trainingOutcome) : 'Not set'}</Text>
      <Text variant="muted">Level: {value.trainingLevel ? humanize(value.trainingLevel) : 'Not set'}</Text>
      <Text variant="muted">Equipment: {value.equipment.length ? value.equipment.map(humanize).join(', ') : 'Not set'}</Text>
      <Text variant="muted">Target muscles: {value.targetMuscleGroups.length ? value.targetMuscleGroups.map(humanize).join(', ') : 'Not set'}</Text>
      <Text variant="muted">Limitations: {value.limitationsOrPainAreas || 'None added'}</Text>
    </Card>
  );
}

function ScheduleSection({ items, onDelete }: { items: TrainingScheduleItem[]; onDelete: (id: string) => void }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.grow}><Text variant="heading">Weekly schedule</Text><Text variant="muted">Workout type and duration live here.</Text></View>
        <Button title="Add" variant="secondary" onPress={() => router.push('/training-schedule/create')} />
      </View>
      {items.length === 0 ? <Card><Text variant="muted">No planned workouts yet. Safe defaults remain available.</Text></Card> : items.map((item) => (
        <Card key={item.id}>
          <Text variant="label">{DAYS[item.dayOfWeek]} at {item.localTime}</Text>
          <Text>{humanize(item.sportType)} · {item.durationMinutes} min · {humanize(item.intensity)}</Text>
          {item.description ? <Text variant="muted">{item.description}</Text> : null}
          <View style={styles.row}>
            <Button title="Edit" variant="secondary" onPress={() => router.push({ pathname: '/training-schedule/edit', params: { ...item, dayOfWeek: String(item.dayOfWeek), durationMinutes: String(item.durationMinutes), description: item.description ?? '' } })} />
            <Button title="Delete" variant="danger" onPress={() => onDelete(item.id)} />
          </View>
        </Card>
      ))}
    </View>
  );
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  error: { color: colors.danger, fontWeight: '600' },
  section: { gap: 12, marginTop: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', gap: 10 }
});
