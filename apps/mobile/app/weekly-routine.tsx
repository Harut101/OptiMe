import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PlanImpactChangeType, TargetMuscleGroup, TrainingScheduleRequest } from '@optime/shared-types';

import { generateTodayPlan } from '@/api/daily-plans';
import { evaluatePlanImpact } from '@/api/plan-impact';
import { deactivateTrainingSchedule, getTrainingSchedule, saveTrainingSchedule } from '@/api/training-schedule';
import { AppToast } from '@/components/AppToast';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { ScreenSkeleton } from '@/components/ScreenSkeleton';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { PlanImpactPromptCard } from '@/features/plan-impact/PlanImpactPromptCard';
import { WeeklyRoutinePreviewCard } from '@/features/training-dashboard/TrainingDashboardWidgets';
import { createSuggestedDraft, toDraft } from '@/features/training-schedule/weekly-schedule';
import { isDraftDirty } from '@/features/editor/draft-state';
import { getDayOfWeekLabel, getMuscleGroupLabel } from '@/i18n/enum-labels';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useTrainingScheduleDraftStore } from '@/store/training-schedule-draft-store';
import { useTheme } from '@/theme/theme-provider';
import type { ThemeColors } from '@/theme/colors';
import type { EvaluatePlanImpactResponse } from '@/types/api';

/** A future-facing routine editor, intentionally separate from today's workout. */
export default function WeeklyRoutineScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const queryClient = useQueryClient();
  const schedule = useQuery({ queryKey: ['training-schedule'], queryFn: getTrainingSchedule });
  const draft = useTrainingScheduleDraftStore((state) => state.draft);
  const setDraft = useTrainingScheduleDraftStore((state) => state.setDraft);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [planImpact, setPlanImpact] = useState<EvaluatePlanImpactResponse | null>(null);
  const [planImpactError, setPlanImpactError] = useState<string | null>(null);

  useEffect(() => {
    if (schedule.data && !draft) setDraft(toDraft(schedule.data));
  }, [draft, schedule.data, setDraft]);

  const dirty = Boolean(schedule.data && draft && isDraftDirty(draft, toDraft(schedule.data)));
  useUnsavedChangesGuard(dirty);

  const save = useMutation({
    mutationFn: saveTrainingSchedule,
    onSuccess: async (saved) => {
      setDraft(toDraft(saved));
      queryClient.setQueryData(['training-schedule'], saved);
      setToastMessage(t('schedule.savedMessage'));
      await evaluateImpact();
    },
    onError: () => setPlanImpactError(`${t('schedule.saveFailed')}. ${t('errors.unableSave')}`)
  });
  const deactivate = useMutation({
    mutationFn: deactivateTrainingSchedule,
    onSuccess: async (saved) => {
      setDraft(toDraft(saved));
      queryClient.setQueryData(['training-schedule'], saved);
      setToastMessage(t('schedule.deactivatedMessage'));
      await evaluateImpact();
    },
    onError: () => setPlanImpactError(`${t('schedule.deleteFailed')}. ${t('errors.unableSave')}`)
  });
  const regenerate = useMutation({
    mutationFn: () => generateTodayPlan(true),
    onSuccess: async (plan) => {
      queryClient.setQueryData(['today-plan'], plan);
      setPlanImpact(null);
      setPlanImpactError(null);
      setToastMessage(t('today.refreshed'));
    },
    onError: () => setPlanImpactError(t('today.updateFailed'))
  });

  if (schedule.isLoading) return <ScreenSkeleton variant="list" cardCount={3} topSafeArea={false} />;
  if (schedule.isError || !schedule.data) {
    return (
      <Screen topSafeArea={false}>
        <StateBlock title={t('schedule.unavailable')} message={t('errors.unableLoad')} actionTitle={t('common.retry')} actionLoading={schedule.isRefetching} onAction={() => schedule.refetch()} />
      </Screen>
    );
  }

  const effectiveDraft = draft ?? toDraft(schedule.data);
  const days = effectiveDraft.days.map((day) => {
    const resolved = schedule.data.days.find((item) => item.dayOfWeek === day.dayOfWeek)?.resolved;
    const muscles = (resolved?.targetMuscles ?? []).map((item) => getMuscleGroupLabel(t, item as TargetMuscleGroup)).join(' · ');
    return {
      key: day.dayOfWeek,
      dayLabel: getDayOfWeekLabel(t, day.dayOfWeek).slice(0, 3),
      title: day.isTrainingDay ? muscles || t('training.generalWorkoutToday') : t('schedule.restDay'),
      meta: day.isTrainingDay ? `${resolved?.durationMinutes ?? 30} ${t('common.minutesShort')}` : undefined,
      isTrainingDay: day.isTrainingDay,
      accessibilityLabel: [getDayOfWeekLabel(t, day.dayOfWeek), day.isTrainingDay ? t('schedule.trainingDay') : t('schedule.restDay'), muscles].filter(Boolean).join(', ')
    };
  });

  return (
    <Screen topSafeArea={false}>
      <Card variant="elevated">
        <SectionHeader title={t('schedule.weeklySchedule')} subtitle={t('schedule.weeklyScheduleHelp')} />
        <Text variant="metric" style={styles.frequency}>{schedule.data.isActive ? schedule.data.derivedWeeklyFrequency : 0}</Text>
        <Text variant="caption">{t('schedule.derivedFrequency', { count: schedule.data.derivedWeeklyFrequency })}</Text>
        {!schedule.data.isActive ? <Text variant="muted">{t('schedule.inactiveHelp')}</Text> : null}
      </Card>

      <WeeklyRoutinePreviewCard
        title={t('schedule.weeklySchedule')}
        subtitle={t('schedule.weeklyScheduleHelp')}
        days={days}
        onDayPress={(dayOfWeek) => router.push({ pathname: '/training-schedule/day', params: { dayOfWeek } })}
      />
      <View style={styles.actions}>
        <Button
          title={save.isPending ? t('common.saving') : t('schedule.saveSchedule')}
          loading={save.isPending}
          disabled={save.isPending || deactivate.isPending || !dirty}
          onPress={() => save.mutate({ ...effectiveDraft, isActive: true } as TrainingScheduleRequest)}
        />
        {!schedule.data.isActive ? (
          <Button title={t('schedule.createSchedule')} variant="secondary" disabled={save.isPending} onPress={() => setDraft(createSuggestedDraft(schedule.data.derivedWeeklyFrequency || 3))} />
        ) : (
          <Button title={t('schedule.deactivateSchedule')} variant="secondary" loading={deactivate.isPending} onPress={() => deactivate.mutate()} />
        )}
      </View>
      <PlanImpactPromptCard
        impact={planImpact}
        isUpdating={regenerate.isPending}
        errorMessage={planImpactError}
        onUpdateToday={() => regenerate.mutate()}
        onFutureOnly={() => {
          setPlanImpact(null);
          setPlanImpactError(null);
          setToastMessage(t('planImpact.futureOnlySaved'));
        }}
      />
      {toastMessage ? <AppToast title={t('feedback.savedSuccessfully')} message={toastMessage} tone="success" onDismiss={() => setToastMessage(null)} /> : null}
    </Screen>
  );

  async function evaluateImpact() {
    try {
      const result = await evaluatePlanImpact({ changeTypes: ['TRAINING_ROUTINE_CHANGED' satisfies PlanImpactChangeType] });
      setPlanImpactError(null);
      setPlanImpact(result.prompt ? result : null);
    } catch {
      setPlanImpact(null);
    }
  }
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  actions: { gap: 10 },
  frequency: { color: colors.training }
});
