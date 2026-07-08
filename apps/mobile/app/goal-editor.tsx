import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { goalSchema } from '@optime/shared-schemas';
import { useTranslation } from 'react-i18next';

import { generateTodayPlan } from '@/api/daily-plans';
import { getGoal, saveGoal } from '@/api/goals';
import { evaluatePlanImpact } from '@/api/plan-impact';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { isDraftDirty } from '@/features/editor/draft-state';
import {
  EMPTY_GOALS_FORM,
  fromGoalResponse,
  getGoalLabel,
  getPrimaryGoalDisplayLabel,
  GoalsForm,
  GoalsFormValue,
  toGoalRequest
} from '@/features/goals/GoalsForm';
import { getFriendlyGoalErrorMessage } from '@/features/safety/safety-copy';
import {
  formatUsageLimitMessage,
  getUsageLimitError
} from '@/features/entitlements/usage-limit-message';
import { PlanImpactPromptCard } from '@/features/plan-impact/PlanImpactPromptCard';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { colors } from '@/theme/colors';
import { formatWeight } from '@/i18n/formatters';
import { useSettingsStore } from '@/store/settings-store';
import type { EvaluatePlanImpactResponse, PlanImpactChangeType } from '@/types/api';

export default function GoalEditorScreen() {
  const { t } = useTranslation();
  const preferredLocale = useSettingsStore((state) => state.preferredLocale);
  const measurementSystem = useSettingsStore((state) => state.measurementSystem);
  const queryClient = useQueryClient();
  const goal = useQuery({ queryKey: ['goal'], queryFn: getGoal });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<GoalsFormValue>(EMPTY_GOALS_FORM);
  const [persistedValue, setPersistedValue] = useState<GoalsFormValue>(EMPTY_GOALS_FORM);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [planImpact, setPlanImpact] = useState<EvaluatePlanImpactResponse | null>(null);
  const [planImpactError, setPlanImpactError] = useState<string | null>(null);
  const pendingChangeTypes = useRef<PlanImpactChangeType[]>(['PRIMARY_GOAL_CHANGED']);

  useEffect(() => {
    if (goal.data) {
      const next = fromGoalResponse(goal.data);
      setValue(next);
      setPersistedValue(next);
    }
  }, [goal.data]);

  const dirty = goal.data === null ? editing : isDraftDirty(value, persistedValue);
  useUnsavedChangesGuard(editing && dirty);

  const mutation = useMutation({
    mutationFn: saveGoal,
    onSuccess: async (savedGoal) => {
      const next = fromGoalResponse(savedGoal);
      queryClient.setQueryData(['goal'], savedGoal);
      setValue(next);
      setPersistedValue(next);
      setEditing(false);
      setValidationError(null);
      setSuccessMessage(t('goals.savedMessage'));
      await queryClient.invalidateQueries({ queryKey: ['nutrition-target-preview'] });
      await evaluateGoalPlanImpact(pendingChangeTypes.current);
    }
  });
  const regenerateTodayPlan = useMutation({
    mutationFn: () => generateTodayPlan(true),
    onSuccess: async (data) => {
      queryClient.setQueryData(['today-plan'], data);
      setPlanImpact(null);
      setPlanImpactError(null);
      setSuccessMessage(t('today.refreshed'));
      await queryClient.invalidateQueries({ queryKey: ['today-plan'] });
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

  if (goal.isLoading) {
    return <Screen><StateBlock title={t('common.loading')} message={t('goals.loadingMessage')} /></Screen>;
  }

  if (goal.isError) {
    return <Screen><StateBlock title={t('goals.unavailable')} message={t('errors.unableLoad')} actionTitle={t('common.retry')} onAction={() => goal.refetch()} /></Screen>;
  }

  const save = () => {
    const result = goalSchema.safeParse(toGoalRequest(value));
    if (!result.success) {
      setValidationError(t('goals.checkGoal'));
      return;
    }
    setValidationError(null);
    const modeChanged = value.impactMode !== persistedValue.impactMode;
    const goalChanged = value.primaryGoal !== persistedValue.primaryGoal;
    pendingChangeTypes.current = [
      ...(goalChanged ? ['PRIMARY_GOAL_CHANGED' as const] : []),
      ...(modeChanged ? ['APP_MODE_CHANGED' as const] : [])
    ];
    if (pendingChangeTypes.current.length === 0) {
      pendingChangeTypes.current = ['PRIMARY_GOAL_CHANGED'];
    }

    if (modeChanged || goalChanged) {
      Alert.alert(
        t('goals.confirmTitle'),
        getGoalChangeConfirmationCopy(value.impactMode, persistedValue.impactMode, goalChanged, t),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.save'), onPress: () => mutation.mutate(result.data) }
        ]
      );
      return;
    }

    mutation.mutate(result.data);
  };

  return (
    <Screen>
      <Text variant="heading">{t('goals.title')}</Text>
      <Text variant="muted">{t('goals.intro')}</Text>

      {goal.data === null && !editing ? (
        <StateBlock
          title={t('goals.emptyTitle')}
          message={t('goals.emptyMessage')}
          actionTitle={t('goals.add')}
          onAction={() => { setSuccessMessage(null); setEditing(true); }}
        />
      ) : editing ? (
        <>
          <GoalsForm value={value} onChange={setValue} validationMode="standalone" />
          {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
          {mutation.isError ? <Text style={styles.error}>{getFriendlyGoalErrorMessage(mutation.error, t)}</Text> : null}
          <View style={styles.actions}>
            <Button title={mutation.isPending ? t('common.saving') : t('common.save')} disabled={mutation.isPending || !dirty} onPress={save} />
            <Button
              title={t('common.cancel')}
              variant="secondary"
              disabled={mutation.isPending}
              onPress={() => {
                setValue(persistedValue);
                setValidationError(null);
                setEditing(false);
              }}
            />
          </View>
        </>
      ) : goal.data ? (
        <>
          <Card>
            <Text variant="label">{t('goals.current')}</Text>
            <Text>{getPrimaryGoalDisplayLabel(goal.data.primaryGoal, goal.data.goalType, t)}</Text>
            <Text variant="muted">{t('goals.modeSummary', { mode: t(`enums.goalImpact.${goal.data.appMode ?? goal.data.impactMode ?? 'NUTRITION_AND_TRAINING'}` as never) })}</Text>
            {goal.data.goalType === 'REDUCE_WEIGHT' ? (
              <Text variant="muted">
                {t('goals.targetSummary', {
                  weight: goal.data.targetWeightKg == null
                    ? t('common.notSet')
                    : formatWeight(goal.data.targetWeightKg, preferredLocale, measurementSystem),
                  days: String(goal.data.targetTimelineDays ?? t('common.notSet'))
                })}
              </Text>
            ) : null}
          </Card>
          <Button title={t('common.edit')} variant="secondary" onPress={() => { setSuccessMessage(null); setEditing(true); }} />
        </>
      ) : null}

      {successMessage ? <Card><Text variant="label">{t('common.saved')}</Text><Text variant="muted">{successMessage}</Text></Card> : null}
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
    </Screen>
  );

  async function evaluateGoalPlanImpact(changeTypes: PlanImpactChangeType[]) {
    try {
      const impact = await evaluatePlanImpact({ changeTypes });
      setPlanImpactError(null);
      setPlanImpact(impact.prompt ? impact : null);
    } catch {
      setPlanImpact(null);
    }
  }
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  error: { color: colors.danger, fontWeight: '600' }
});

function getGoalChangeConfirmationCopy(
  nextMode: GoalsFormValue['impactMode'],
  previousMode: GoalsFormValue['impactMode'],
  goalChanged: boolean,
  t: (
    key:
      | 'goals.enableTrainingConfirm'
      | 'goals.disableTrainingConfirm'
      | 'goals.goalChangeConfirm'
      | 'goals.futurePlansOnly'
  ) => string
) {
  if (nextMode !== previousMode && nextMode === 'NUTRITION_AND_TRAINING') {
    return t('goals.enableTrainingConfirm');
  }

  if (nextMode !== previousMode && nextMode === 'NUTRITION_ONLY') {
    return t('goals.disableTrainingConfirm');
  }

  if (goalChanged) {
    return t('goals.goalChangeConfirm');
  }

  return t('goals.futurePlansOnly');
}
