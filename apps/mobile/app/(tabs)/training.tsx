import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type {
  DayOfWeek,
  PlanImpactChangeType,
  TargetMuscleGroup,
  TrainingScheduleRequest,
  TrainingScheduleResponse
} from '@optime/shared-types';

import { generateTodayPlan } from '@/api/daily-plans';
import { getGoal } from '@/api/goals';
import { evaluatePlanImpact } from '@/api/plan-impact';
import { getTrainingPreferences, saveTrainingPreferences } from '@/api/training-preferences';
import {
  deactivateTrainingSchedule,
  getTrainingSchedule,
  saveTrainingSchedule
} from '@/api/training-schedule';
import { Button } from '@/components/Button';
import { BottomSheet } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { AppToast } from '@/components/AppToast';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { ScreenSkeleton } from '@/components/ScreenSkeleton';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import {
  formatUsageLimitMessage,
  getUsageLimitError
} from '@/features/entitlements/usage-limit-message';
import { PlanImpactPromptCard } from '@/features/plan-impact/PlanImpactPromptCard';
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
  getEquipmentLabel,
  getMuscleGroupLabel,
  getTrainingLevelLabel,
  getTrainingOutcomeLabel
} from '@/i18n/enum-labels';
import {
  TrainingLoadInsightCard,
  TrainingStatusCard,
  WeeklyRoutinePreviewCard
} from '@/features/training-dashboard/TrainingDashboardWidgets';
import { useSettingsStore } from '@/store/settings-store';
import { useTrainingScheduleDraftStore } from '@/store/training-schedule-draft-store';
import type { EvaluatePlanImpactResponse } from '@/types/api';

const TODAY_PLAN_QUERY_KEY = ['today' + '-plan'] as const;

export default function TrainingScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const preferredLocale = useSettingsStore((state) => state.preferredLocale);
  const preferences = useQuery({ queryKey: ['training-preferences'], queryFn: getTrainingPreferences });
  const weeklySchedule = useQuery({ queryKey: ['training-schedule'], queryFn: getTrainingSchedule });
  const goal = useQuery({ queryKey: ['goal'], queryFn: getGoal });
  const draft = useTrainingScheduleDraftStore((state) => state.draft);
  const setDraft = useTrainingScheduleDraftStore((state) => state.setDraft);
  const [editingSettings, setEditingSettings] = useState(false);
  const [value, setValue] = useState<TrainingSetupFormValue>(EMPTY_TRAINING_SETUP);
  const [savedValue, setSavedValue] = useState<TrainingSetupFormValue>(EMPTY_TRAINING_SETUP);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [planImpact, setPlanImpact] = useState<EvaluatePlanImpactResponse | null>(null);
  const [planImpactError, setPlanImpactError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

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
    onSuccess: async (data) => {
      const impactChangeTypes = buildTrainingPreferenceImpactTypes(value, savedValue);
      const next = fromTrainingPreference(data);
      setValue(next);
      setSavedValue(next);
      setEditingSettings(false);
      setSuccessMessage(t('training.savedMessage'));
      setFeedbackMessage(t('training.savedMessage'));
      queryClient.setQueryData(['training-preferences'], data);
      await queryClient.invalidateQueries({ queryKey: ['training-schedule'] });
      await evaluateTrainingPlanImpact(impactChangeTypes);
    }
  });
  const saveSchedule = useMutation({
    mutationFn: saveTrainingSchedule,
    onSuccess: async (data) => {
      setDraft(toDraft(data));
      queryClient.setQueryData(['training-schedule'], data);
      setSuccessMessage(t('schedule.savedMessage'));
      setFeedbackMessage(t('schedule.savedMessage'));
      await evaluateTrainingPlanImpact(['TRAINING_ROUTINE_CHANGED']);
    },
    onError: () => setPlanImpactError(`${t('schedule.saveFailed')}. ${t('errors.unableSave')}`)
  });
  const deactivateSchedule = useMutation({
    mutationFn: deactivateTrainingSchedule,
    onSuccess: async (data) => {
      setDraft(toDraft(data));
      queryClient.setQueryData(['training-schedule'], data);
      setSuccessMessage(t('schedule.deactivatedMessage'));
      setFeedbackMessage(t('schedule.deactivatedMessage'));
      await evaluateTrainingPlanImpact(['TRAINING_ROUTINE_CHANGED']);
    },
    onError: () => setPlanImpactError(`${t('schedule.deleteFailed')}. ${t('errors.unableSave')}`)
  });
  const regenerateTodayPlan = useMutation({
    mutationFn: () => generateTodayPlan(true),
    onSuccess: async (data) => {
      queryClient.setQueryData(TODAY_PLAN_QUERY_KEY, data);
      setPlanImpact(null);
      setPlanImpactError(null);
      setSuccessMessage(t('today.refreshed'));
      setFeedbackMessage(t('today.refreshed'));
      await queryClient.invalidateQueries({ queryKey: ['usage-summary'] });
    },
    onError: (error) => {
      const usageLimit = getUsageLimitError(error);
      setPlanImpactError(
        usageLimit
          ? `${formatUsageLimitMessage(usageLimit, t, preferredLocale)} ${t('settings.upgradeSoon')}`
          : t('today.updateFailed')
      );
    }
  });

  if (preferences.isLoading || weeklySchedule.isLoading || goal.isLoading) {
    return <ScreenSkeleton variant="list" cardCount={4} />;
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
      <ScreenHeader title={t('training.title')} />
        <Card>
          <SectionHeader title={t('training.disabledTitle')} />
          <Text variant="body">{t('training.disabledMessage')}</Text>
          <Button title={t('training.enableTraining')} onPress={() => router.push('/goal-editor')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t('training.title')} subtitle={t('training.intro')} />
      <TodaysWorkoutCard response={weeklySchedule.data!} />
      <TrainingLoadInsightCard
        title={t('trainingLoad.title')}
        status={t('trainingLoad.keepControlled')}
        message={t('training.trainingLoadMessage')}
        bullets={[t('trainingLoad.takeLongerRests'), t('workout.safetyMessage')]}
        tone="training"
      />
      <PlanImpactPromptCard
        impact={planImpact}
        isUpdating={regenerateTodayPlan.isPending}
        errorMessage={planImpactError}
        onUpdateToday={() => regenerateTodayPlan.mutate()}
        onFutureOnly={() => {
          setPlanImpact(null);
          setPlanImpactError(null);
          setSuccessMessage(t('planImpact.futureOnlySaved'));
        }}
      />
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
      <Card>
        <SectionHeader title={t('workout.workoutHistory')} subtitle={t('workout.historyHelp')} />
        <Button
          title={t('workout.openWorkoutHistory')}
          variant="secondary"
          accessibilityLabel={t('workout.openWorkoutHistory')}
          onPress={() => router.push('/workout-history')}
        />
      </Card>

      {hasPreferences ? (
        <>
          <TrainingSummary value={savedValue} />
          <Button title={t('training.editSetup')} variant="secondary" onPress={() => { setSuccessMessage(null); setEditingSettings(true); }} />
        </>
      ) : (
        <StateBlock
          title={t('training.emptyTitle')}
          message={t('training.emptyMessage')}
          actionTitle={t('training.setup')}
          onAction={() => { setSuccessMessage(null); setEditingSettings(true); }}
        />
      )}

      <BottomSheet
        visible={editingSettings}
        title={hasPreferences ? t('training.editSetup') : t('training.setup')}
        subtitle={t('training.setupSummaryHelp')}
        onClose={() => {
          if (saveSettings.isPending) return;
          setValue(savedValue);
          setEditingSettings(false);
        }}
      >
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
      </BottomSheet>

      {feedbackMessage ? (
        <AppToast
          title={t('feedback.savedSuccessfully')}
          message={feedbackMessage}
          tone="success"
          onDismiss={() => setFeedbackMessage(null)}
        />
      ) : null}
    </Screen>
  );

  async function evaluateTrainingPlanImpact(changeTypes: PlanImpactChangeType[]) {
    try {
      const impact = await evaluatePlanImpact({ changeTypes });
      setPlanImpactError(null);
      setPlanImpact(impact.prompt ? impact : null);
    } catch {
      setPlanImpact(null);
    }
  }
}

function TodaysWorkoutCard({ response }: { response: TrainingScheduleResponse }) {
  const { t } = useTranslation();
  const today = getTodayDayOfWeek();
  const day = response.days.find((item) => item.dayOfWeek === today);
  const resolved = day?.resolved;
  const isTrainingDay = Boolean(response.isActive && day?.isTrainingDay);
  const muscles = formatMuscles(t, resolved?.targetMuscles ?? []);

  return (
    <TrainingStatusCard
      label={t('training.title')}
      title={isTrainingDay ? t('training.todaysWorkout') : t('training.restDayToday')}
      subtitle={isTrainingDay ? (muscles || t('training.generalWorkoutToday')) : t('training.restDayTodayMessage')}
      meta={isTrainingDay ? `${resolved?.durationMinutes ?? 30} ${t('common.minutesShort')}` : undefined}
      statusLabel={isTrainingDay ? t('schedule.trainingDay') : t('schedule.restDay')}
      statusTone={isTrainingDay ? 'training' : 'recovery'}
      accessibilityLabel={`${isTrainingDay ? t('training.todaysWorkout') : t('training.restDayToday')}. ${isTrainingDay ? muscles : t('training.restDayTodayMessage')}`}
    />
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
  const previewDays = effectiveDraft.days.map((day) => {
    const responseDay = response.days.find((item) => item.dayOfWeek === day.dayOfWeek);
    const resolved = responseDay?.resolved;
    const muscles = formatMuscles(t, resolved?.targetMuscles ?? []);
    return {
      key: day.dayOfWeek,
      dayLabel: getDayOfWeekLabel(t, day.dayOfWeek).slice(0, 3),
      title: day.isTrainingDay ? (muscles || t('training.generalWorkoutToday')) : t('schedule.restDay'),
      meta: day.isTrainingDay ? `${resolved?.durationMinutes ?? 30} ${t('common.minutesShort')}` : undefined,
      isTrainingDay: day.isTrainingDay,
      accessibilityLabel: [
        getDayOfWeekLabel(t, day.dayOfWeek),
        day.isTrainingDay ? t('schedule.trainingDay') : t('schedule.restDay'),
        muscles,
        resolved?.durationMinutes ? `${resolved.durationMinutes} ${t('common.minutesShort')}` : ''
      ].filter(Boolean).join(', ')
    };
  });
  return (
    <View style={styles.section}>
      <Card variant="elevated">
        <SectionHeader title={t('schedule.weeklySchedule')} subtitle={t('schedule.weeklyScheduleHelp')} />
        <Text variant="metric" style={styles.frequencyValue}>
          {response.isActive ? response.derivedWeeklyFrequency : trainingDays}
        </Text>
        <Text variant="caption">{t('schedule.derivedFrequency', { count: response.isActive ? response.derivedWeeklyFrequency : trainingDays })}</Text>
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
          <WeeklyRoutinePreviewCard
            title={t('schedule.weeklySchedule')}
            subtitle={t('schedule.weeklyScheduleHelp')}
            days={previewDays}
            onDayPress={(dayOfWeek) => router.push({ pathname: '/training-schedule/day', params: { dayOfWeek } })}
          />
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

function TrainingSummary({ value }: { value: TrainingSetupFormValue }) {
  const { t } = useTranslation();
  return (
    <Card>
      <SectionHeader title={t('training.current')} subtitle={t('training.setupSummaryHelp')} />
      <Text>{t('training.focus')}: {value.trainingOutcome ? getTrainingOutcomeLabel(t, value.trainingOutcome) : t('common.notSet')}</Text>
      <Text variant="muted">{t('training.level')}: {value.trainingLevel ? getTrainingLevelLabel(t, value.trainingLevel) : t('common.notSet')}</Text>
      <Text variant="muted">{t('training.defaultEquipment')}: {value.equipment.length ? value.equipment.map((item) => getEquipmentLabel(t, item)).join(' · ') : t('common.notSet')}</Text>
    </Card>
  );
}

function formatMuscles(t: ReturnType<typeof useTranslation>['t'], muscles: TargetMuscleGroup[]) {
  return muscles.map((item) => getMuscleGroupLabel(t, item)).join(' · ');
}

function getTodayDayOfWeek(): DayOfWeek {
  const index = new Date().getDay();
  return (['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const)[index];
}

function buildTrainingPreferenceImpactTypes(
  next: TrainingSetupFormValue,
  previous: TrainingSetupFormValue
): PlanImpactChangeType[] {
  const changeTypes = new Set<PlanImpactChangeType>();
  if (listChanged(next.targetMuscleGroups, previous.targetMuscleGroups)) {
    changeTypes.add('TRAINING_MUSCLES_CHANGED');
  }
  if (listChanged(next.equipment, previous.equipment)) {
    changeTypes.add('TRAINING_EQUIPMENT_CHANGED');
  }
  if (next.trainingLevel !== previous.trainingLevel || next.trainingOutcome !== previous.trainingOutcome) {
    changeTypes.add('TRAINING_ROUTINE_CHANGED');
  }

  return changeTypes.size ? [...changeTypes] : ['TRAINING_ROUTINE_CHANGED'];
}

function listChanged(next: string[], previous: string[]) {
  return JSON.stringify([...next].sort()) !== JSON.stringify([...previous].sort());
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  actions: { gap: 10 },
  error: { color: colors.danger, fontWeight: '600' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  frequencyValue: { color: colors.training }
});
