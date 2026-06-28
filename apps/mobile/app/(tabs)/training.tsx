import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type {
  DayOfWeek,
  ExerciseEquipment,
  ResolvedTrainingDayContext,
  TargetMuscleGroup,
  TrainingScheduleRequest,
  TrainingScheduleResponse
} from '@optime/shared-types';

import { getGoal } from '@/api/goals';
import { getTrainingPreferences, saveTrainingPreferences } from '@/api/training-preferences';
import {
  deactivateTrainingSchedule,
  getTrainingSchedule,
  saveTrainingSchedule
} from '@/api/training-schedule';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SelectChips } from '@/components/SelectChips';
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
import {
  createEmptyDraft,
  createSuggestedDraft,
  toDraft
} from '@/features/training-schedule/weekly-schedule';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { colors } from '@/theme/colors';
import { isDraftDirty } from '@/features/editor/draft-state';
import {
  getDayOfWeekLabel,
  getExerciseEquipmentLabel,
  getMuscleGroupLabel,
  getTrainingEnvironmentLabel,
  getTrainingLevelLabel,
  getTrainingOutcomeLabel
} from '@/i18n/enum-labels';
import { useTrainingScheduleDraftStore } from '@/store/training-schedule-draft-store';

type TrainingSection = 'weekly' | 'settings';

export default function TrainingScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const preferences = useQuery({ queryKey: ['training-preferences'], queryFn: getTrainingPreferences });
  const weeklySchedule = useQuery({ queryKey: ['training-schedule'], queryFn: getTrainingSchedule });
  const goal = useQuery({ queryKey: ['goal'], queryFn: getGoal });
  const draft = useTrainingScheduleDraftStore((state) => state.draft);
  const setDraft = useTrainingScheduleDraftStore((state) => state.setDraft);
  const [section, setSection] = useState<TrainingSection>('weekly');
  const [editingSettings, setEditingSettings] = useState(false);
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

  useEffect(() => {
    if (weeklySchedule.data && !draft) {
      setDraft(toDraft(weeklySchedule.data));
    }
  }, [draft, setDraft, weeklySchedule.data]);

  const settingsDirty = isDraftDirty(value, savedValue);
  const scheduleDirty = Boolean(weeklySchedule.data && draft && isDraftDirty(draft, toDraft(weeklySchedule.data)));
  useUnsavedChangesGuard((editingSettings && settingsDirty) || scheduleDirty);

  const saveSettings = useMutation({
    mutationFn: saveTrainingPreferences,
    onSuccess: (data) => {
      const next = fromTrainingPreference(data);
      setValue(next);
      setSavedValue(next);
      setEditingSettings(false);
      setSuccessMessage(t('training.savedMessage'));
      queryClient.setQueryData(['training-preferences'], data);
      void queryClient.invalidateQueries({ queryKey: ['training-schedule'] });
    }
  });
  const saveSchedule = useMutation({
    mutationFn: saveTrainingSchedule,
    onSuccess: (data) => {
      setDraft(toDraft(data));
      queryClient.setQueryData(['training-schedule'], data);
      setSuccessMessage(t('schedule.savedMessage'));
    },
    onError: () => Alert.alert(t('schedule.saveFailed'), t('errors.unableSave'))
  });
  const deactivateSchedule = useMutation({
    mutationFn: deactivateTrainingSchedule,
    onSuccess: (data) => {
      setDraft(toDraft(data));
      queryClient.setQueryData(['training-schedule'], data);
      setSuccessMessage(t('schedule.deactivatedMessage'));
    },
    onError: () => Alert.alert(t('schedule.deleteFailed'), t('errors.unableSave'))
  });

  if (preferences.isLoading || weeklySchedule.isLoading || goal.isLoading) {
    return <Screen><StateBlock title={t('common.loading')} message={t('training.loadingMessage')} /></Screen>;
  }

  if (preferences.isError || weeklySchedule.isError || goal.isError) {
    const message = preferences.error?.message ?? weeklySchedule.error?.message ?? goal.error?.message ?? t('training.unavailable');
    return (
      <Screen>
        <StateBlock
          title={t('training.unavailable')}
          message={message}
          actionTitle={t('common.retry')}
          onAction={() => { preferences.refetch(); weeklySchedule.refetch(); goal.refetch(); }}
        />
      </Screen>
    );
  }

  const hasPreferences = hasTrainingSetup(savedValue);
  const appMode = goal.data?.appMode ?? goal.data?.impactMode ?? 'NUTRITION_AND_TRAINING';

  if (appMode === 'NUTRITION_ONLY') {
    return (
      <Screen>
        <Text variant="heading">{t('training.title')}</Text>
        <Card>
          <Text variant="label">{t('training.disabledTitle')}</Text>
          <Text variant="body">{t('training.disabledMessage')}</Text>
          <Button title={t('training.enableTraining')} onPress={() => router.push('/goal-editor')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="heading">{t('training.title')}</Text>
      <Text variant="muted">{t('training.intro')}</Text>
      <Button
        title={t('workout.workoutHistory')}
        variant="secondary"
        accessibilityLabel={t('workout.openWorkoutHistory')}
        onPress={() => router.push('/workout-history')}
      />
      <SelectChips
        label={t('training.section')}
        value={section}
        onChange={setSection}
        options={[
          { label: t('schedule.weeklySchedule'), value: 'weekly' },
          { label: t('schedule.settings'), value: 'settings' }
        ]}
      />

      {section === 'weekly' ? (
        <WeeklyScheduleSection
          response={weeklySchedule.data!}
          draft={draft}
          hasPreferences={hasPreferences}
          onCreate={() => {
            setSuccessMessage(null);
            setDraft(createSuggestedDraft(weeklySchedule.data?.derivedWeeklyFrequency || 3));
          }}
          onSave={(next) => saveSchedule.mutate(next)}
          onDeactivate={() => deactivateSchedule.mutate()}
          saving={saveSchedule.isPending || deactivateSchedule.isPending}
          dirty={scheduleDirty}
        />
      ) : editingSettings ? (
        <>
          <TrainingSetupForm value={value} onChange={setValue} />
          {saveSettings.isError ? <Text style={styles.error}>{saveSettings.error.message}</Text> : null}
          <View style={styles.actions}>
            <Button
              title={saveSettings.isPending ? t('common.saving') : t('common.save')}
              disabled={saveSettings.isPending || !settingsDirty}
              onPress={() => saveSettings.mutate(toTrainingPreferenceRequest(value))}
            />
            <Button
              title={t('common.cancel')}
              variant="secondary"
              disabled={saveSettings.isPending}
              onPress={() => { setValue(savedValue); setEditingSettings(false); }}
            />
          </View>
        </>
      ) : (
        <>
          <TrainingSummary value={savedValue} />
          <Button title={t('common.edit')} variant="secondary" onPress={() => { setSuccessMessage(null); setEditingSettings(true); }} />
        </>
      )}

      {successMessage ? <Card><Text variant="label">{t('common.saved')}</Text><Text variant="muted">{successMessage}</Text></Card> : null}
    </Screen>
  );
}

function WeeklyScheduleSection({
  response,
  draft,
  hasPreferences,
  onCreate,
  onSave,
  onDeactivate,
  saving,
  dirty
}: {
  response: TrainingScheduleResponse;
  draft: TrainingScheduleRequest | null;
  hasPreferences: boolean;
  onCreate: () => void;
  onSave: (draft: TrainingScheduleRequest) => void;
  onDeactivate: () => void;
  saving: boolean;
  dirty: boolean;
}) {
  const { t } = useTranslation();
  const effectiveDraft = draft ?? createEmptyDraft();
  const trainingDays = effectiveDraft.days.filter((day) => day.isTrainingDay).length;
  return (
    <View style={styles.section}>
      <Card>
        <Text variant="label">{t('schedule.weeklySchedule')}</Text>
        <Text variant="muted">{t('schedule.weeklyScheduleHelp')}</Text>
        <Text variant="body">{t('schedule.derivedFrequency', { count: response.isActive ? response.derivedWeeklyFrequency : trainingDays })}</Text>
        {!response.isActive && !dirty ? <Text variant="muted">{t('schedule.inactiveHelp')}</Text> : null}
      </Card>

      {!draft ? (
        <StateBlock
          title={t('schedule.noWeeklySchedule')}
          message={hasPreferences ? t('schedule.noWeeklyScheduleMessage') : t('training.emptyMessage')}
          actionTitle={t('schedule.createSchedule')}
          onAction={onCreate}
        />
      ) : (
        <>
          {effectiveDraft.days.map((day) => {
            const responseDay = response.days.find((item) => item.dayOfWeek === day.dayOfWeek);
            const resolved = responseDay?.resolved;
            return (
              <DayCard
                key={day.dayOfWeek}
                dayOfWeek={day.dayOfWeek}
                isTrainingDay={day.isTrainingDay}
                resolved={resolved}
                onPress={() => router.push({ pathname: '/training-schedule/day', params: { dayOfWeek: day.dayOfWeek } })}
              />
            );
          })}
          <View style={styles.actions}>
            <Button
              title={saving ? t('common.saving') : t('schedule.saveSchedule')}
              disabled={saving || !dirty}
              onPress={() => onSave({ ...effectiveDraft, isActive: true })}
            />
            {response.isActive ? (
              <Button
                title={t('schedule.deactivateSchedule')}
                variant="danger"
                disabled={saving}
                onPress={onDeactivate}
              />
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

function DayCard({
  dayOfWeek,
  isTrainingDay,
  resolved,
  onPress
}: {
  dayOfWeek: DayOfWeek;
  isTrainingDay: boolean;
  resolved?: ResolvedTrainingDayContext;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const muscles = formatMuscles(t, resolved?.targetMuscles ?? []);
  const equipment = formatEquipment(t, resolved?.availableEquipment ?? []);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        getDayOfWeekLabel(t, dayOfWeek),
        isTrainingDay ? t('schedule.trainingDay') : t('schedule.restDay'),
        muscles,
        resolved?.environment ? getTrainingEnvironmentLabel(t, resolved.environment) : '',
        equipment,
        resolved?.durationMinutes ? `${resolved.durationMinutes} ${t('common.minutesShort')}` : ''
      ].filter(Boolean).join(', ')}
      onPress={onPress}
    >
      <Card>
        <View style={styles.dayHeader}>
          <Text variant="label">{getDayOfWeekLabel(t, dayOfWeek)}</Text>
          <Text style={[styles.status, isTrainingDay ? styles.trainingStatus : styles.restStatus]}>
            {isTrainingDay ? t('schedule.trainingDay') : t('schedule.restDay')}
          </Text>
        </View>
        {isTrainingDay ? (
          <>
            <Text variant="body">{muscles || t('common.notSet')}</Text>
            <Text variant="muted">{resolved?.environment ? getTrainingEnvironmentLabel(t, resolved.environment) : t('common.notSet')}</Text>
            <Text variant="muted">{equipment || t('schedule.noOptionalEquipment')}</Text>
            <Text variant="muted">{resolved?.durationMinutes ?? 30} {t('common.minutesShort')}</Text>
            {resolved?.inheritedFields.length ? <Text variant="muted">{t('schedule.usingDefaults')}</Text> : <Text variant="muted">{t('schedule.custom')}</Text>}
          </>
        ) : (
          <Text variant="muted">{t('schedule.restDayHelp')}</Text>
        )}
      </Card>
    </Pressable>
  );
}

function TrainingSummary({ value }: { value: TrainingSetupFormValue }) {
  const { t } = useTranslation();
  return (
    <Card>
      <Text variant="label">{t('training.current')}</Text>
      <Text>{t('training.focus')}: {value.trainingOutcome ? getTrainingOutcomeLabel(t, value.trainingOutcome) : t('common.notSet')}</Text>
      <Text variant="muted">{t('training.level')}: {value.trainingLevel ? getTrainingLevelLabel(t, value.trainingLevel) : t('common.notSet')}</Text>
      <Text variant="muted">{t('training.equipment')}: {value.equipment.length ? value.equipment.join(', ') : t('common.notSet')}</Text>
      <Text variant="muted">{t('training.targetMuscles')}: {formatMuscles(t, value.targetMuscleGroups) || t('common.notSet')}</Text>
      <Text variant="muted">{t('training.limitations')}: {value.limitationsOrPainAreas || t('common.noneAdded')}</Text>
    </Card>
  );
}

function formatMuscles(t: ReturnType<typeof useTranslation>['t'], muscles: TargetMuscleGroup[]) {
  return muscles.map((item) => getMuscleGroupLabel(t, item)).join(' · ');
}

function formatEquipment(t: ReturnType<typeof useTranslation>['t'], equipment: ExerciseEquipment[]) {
  return equipment.map((item) => getExerciseEquipmentLabel(t, item)).join(' · ');
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  actions: { gap: 10 },
  error: { color: colors.danger, fontWeight: '600' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  status: { fontSize: 12, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  trainingStatus: { color: colors.primaryDark, backgroundColor: '#e7f3ef' },
  restStatus: { color: colors.muted, backgroundColor: colors.surface }
});
