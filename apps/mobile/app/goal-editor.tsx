import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { goalSchema } from '@optime/shared-schemas';

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

export default function GoalEditorScreen() {
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
      setSuccessMessage('Your updated goals will be used for future plans.');
    }
  });

  if (goal.isLoading) {
    return <Screen><StateBlock title="Loading goals" message="Bringing your saved direction into view." /></Screen>;
  }

  if (goal.isError) {
    return <Screen><StateBlock title="Goals unavailable" message={goal.error.message} actionTitle="Try again" onAction={() => goal.refetch()} /></Screen>;
  }

  const save = () => {
    const result = goalSchema.safeParse(toGoalRequest(value));
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Please review your goal.');
      return;
    }
    setValidationError(null);
    mutation.mutate(result.data);
  };

  return (
    <Screen>
      <Text variant="heading">Goals</Text>
      <Text variant="muted">Update the direction OptiMe should consider for future recommendations.</Text>

      {goal.data === null && !editing ? (
        <StateBlock
          title="Set your goals"
          message="Add the outcome you want OptiMe to consider when creating future recommendations."
          actionTitle="Add goals"
          onAction={() => { setSuccessMessage(null); setEditing(true); }}
        />
      ) : editing ? (
        <>
          <GoalsForm value={value} onChange={setValue} validationMode="standalone" />
          {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
          {mutation.isError ? <Text style={styles.error}>{getFriendlyGoalErrorMessage(mutation.error)}</Text> : null}
          <View style={styles.actions}>
            <Button title={mutation.isPending ? 'Saving...' : 'Save goals'} disabled={mutation.isPending || !dirty} onPress={save} />
            <Button
              title="Cancel"
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
            <Text variant="label">Current goal</Text>
            <Text>{getGoalLabel(goal.data.goalType)}</Text>
            {goal.data.goalType === 'REDUCE_WEIGHT' ? (
              <Text variant="muted">
                Target: {goal.data.targetWeightKg ?? 'Not set'} kg · {goal.data.targetTimelineDays ?? 'No timeline'} days
              </Text>
            ) : null}
          </Card>
          <Button title="Edit goals" variant="secondary" onPress={() => { setSuccessMessage(null); setEditing(true); }} />
        </>
      ) : null}

      {successMessage ? <Card><Text variant="label">Saved</Text><Text variant="muted">{successMessage}</Text></Card> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  error: { color: colors.danger, fontWeight: '600' }
});
