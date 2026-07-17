import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PlanImpactChangeType } from '@optime/shared-types';

import { generateTodayPlan } from '@/api/daily-plans';
import { evaluatePlanImpact } from '@/api/plan-impact';
import { getTrainingPreferences, saveTrainingPreferences } from '@/api/training-preferences';
import { AppToast } from '@/components/AppToast';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenSkeleton } from '@/components/ScreenSkeleton';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { PlanImpactPromptCard } from '@/features/plan-impact/PlanImpactPromptCard';
import {
  EMPTY_TRAINING_SETUP,
  fromTrainingPreference,
  toTrainingPreferenceRequest,
  TrainingSetupForm,
  type TrainingSetupFormValue
} from '@/features/training-preferences/TrainingSetupForm';
import { isDraftDirty } from '@/features/editor/draft-state';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useTheme } from '@/theme/theme-provider';
import type { ThemeColors } from '@/theme/colors';
import type { EvaluatePlanImpactResponse } from '@/types/api';

/** Persistent training preferences, reached from Profile rather than the daily workout tab. */
export default function TrainingSetupScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const queryClient = useQueryClient();
  const preferences = useQuery({ queryKey: ['training-preferences'], queryFn: getTrainingPreferences });
  const [value, setValue] = useState<TrainingSetupFormValue>(EMPTY_TRAINING_SETUP);
  const [savedValue, setSavedValue] = useState<TrainingSetupFormValue>(EMPTY_TRAINING_SETUP);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [planImpact, setPlanImpact] = useState<EvaluatePlanImpactResponse | null>(null);
  const [planImpactError, setPlanImpactError] = useState<string | null>(null);

  useEffect(() => {
    if (!preferences.data) return;
    const next = fromTrainingPreference(preferences.data);
    setValue(next);
    setSavedValue(next);
  }, [preferences.data]);

  const dirty = isDraftDirty(value, savedValue);
  useUnsavedChangesGuard(dirty);

  const save = useMutation({
    mutationFn: saveTrainingPreferences,
    onSuccess: async (saved) => {
      const changeTypes = buildImpactChangeTypes(value, savedValue);
      const next = fromTrainingPreference(saved);
      setValue(next);
      setSavedValue(next);
      queryClient.setQueryData(['training-preferences'], saved);
      setToastMessage(t('training.savedMessage'));
      await evaluateImpact(changeTypes);
    }
  });
  const regenerate = useMutation({
    mutationFn: () => generateTodayPlan(true),
    onSuccess: (plan) => {
      queryClient.setQueryData(['today-plan'], plan);
      setPlanImpact(null);
      setPlanImpactError(null);
      setToastMessage(t('today.refreshed'));
    },
    onError: () => setPlanImpactError(t('today.updateFailed'))
  });

  if (preferences.isLoading) return <ScreenSkeleton variant="detail" cardCount={3} topSafeArea={false} />;
  if (preferences.isError) {
    return <Screen topSafeArea={false}><StateBlock title={t('training.unavailable')} message={t('errors.unableLoad')} actionTitle={t('common.retry')} onAction={() => preferences.refetch()} /></Screen>;
  }

  return (
    <Screen topSafeArea={false}>
      <TrainingSetupForm value={value} onChange={setValue} />
      {save.isError ? <Text style={styles.error}>{t('errors.unableSave')}</Text> : null}
      <Button title={save.isPending ? t('common.saving') : t('common.save')} disabled={save.isPending || !dirty} onPress={() => save.mutate(toTrainingPreferenceRequest(value))} />
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

  async function evaluateImpact(changeTypes: PlanImpactChangeType[]) {
    try {
      const result = await evaluatePlanImpact({ changeTypes });
      setPlanImpactError(null);
      setPlanImpact(result.prompt ? result : null);
    } catch {
      setPlanImpact(null);
    }
  }
}

function buildImpactChangeTypes(next: TrainingSetupFormValue, previous: TrainingSetupFormValue): PlanImpactChangeType[] {
  const changed = new Set<PlanImpactChangeType>();
  if (JSON.stringify([...next.targetMuscleGroups].sort()) !== JSON.stringify([...previous.targetMuscleGroups].sort())) changed.add('TRAINING_MUSCLES_CHANGED');
  if (JSON.stringify([...next.equipment].sort()) !== JSON.stringify([...previous.equipment].sort())) changed.add('TRAINING_EQUIPMENT_CHANGED');
  if (next.trainingLevel !== previous.trainingLevel || next.trainingOutcome !== previous.trainingOutcome) changed.add('TRAINING_ROUTINE_CHANGED');
  return changed.size ? [...changed] : ['TRAINING_ROUTINE_CHANGED'];
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({ error: { color: colors.danger, fontWeight: '700' } });
