import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { goalSchema } from '@optime/shared-schemas';
import { useTranslation } from 'react-i18next';

import { getGoal, saveGoal } from '@/api/goals';
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
  GoalsForm,
  GoalsFormValue,
  toGoalRequest
} from '@/features/goals/GoalsForm';
import { getFriendlyGoalErrorMessage } from '@/features/safety/safety-copy';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { colors } from '@/theme/colors';
import { formatWeight } from '@/i18n/formatters';
import { useSettingsStore } from '@/store/settings-store';

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
    onSuccess: (savedGoal) => {
      const next = fromGoalResponse(savedGoal);
      queryClient.setQueryData(['goal'], savedGoal);
      setValue(next);
      setPersistedValue(next);
      setEditing(false);
      setValidationError(null);
      setSuccessMessage(t('goals.savedMessage'));
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
            <Text>{getGoalLabel(goal.data.goalType, t)}</Text>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  error: { color: colors.danger, fontWeight: '600' }
});
