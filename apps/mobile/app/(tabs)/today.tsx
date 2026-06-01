import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { generateTodayPlan, getTodayPlan } from '@/api/daily-plans';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';

export default function TodayScreen() {
  const queryClient = useQueryClient();
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const today = useQuery({
    queryKey: ['today-plan'],
    queryFn: getTodayPlan
  });
  const generate = useMutation({
    mutationFn: (forceRegenerate: boolean) => generateTodayPlan(forceRegenerate),
    onSuccess: async (data, forceRegenerate) => {
      queryClient.setQueryData(['today-plan'], data);
      await queryClient.invalidateQueries({ queryKey: ['today-plan'] });
      await queryClient.refetchQueries({ queryKey: ['today-plan'], type: 'active' });
      setRefreshMessage(forceRegenerate ? 'Plan refreshed' : 'Plan generated.');
    },
    onError: (error) => Alert.alert('Plan update failed', error.message)
  });

  if (today.isLoading) {
    return <StateBlock title="Loading Today" message="Checking whether a plan already exists." />;
  }

  if (today.isError) {
    return (
      <Screen>
        <StateBlock
          title="Today is unavailable"
          message={today.error.message}
          actionTitle="Try again"
          onAction={() => today.refetch()}
        />
      </Screen>
    );
  }

  const plan = today.data?.plan.plan;

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="label">Today</Text>
        <Text variant="title">Steady, practical, ready.</Text>
        <Text variant="muted">A simple plan for food, training, hydration, and recovery today.</Text>
      </View>

      {!today.data || !plan ? (
        <StateBlock
          title="No plan yet"
          message="Generate a simple plan for food, training, hydration, and recovery today."
          actionTitle={generate.isPending ? 'Generating...' : 'Generate today plan'}
          onAction={() => generate.mutate(false)}
        />
      ) : (
        <>
          <Card>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{today.data.readinessLevel}</Text>
            </View>
            {refreshMessage ? <Text style={styles.successText}>{refreshMessage}</Text> : null}
            <Text variant="heading">{plan.summary}</Text>
            <Text variant="muted">{plan.coachExplanation}</Text>
            <Text variant="muted">Updated {formatUpdatedAt(today.data.updatedAt)}</Text>
          </Card>

          <Card>
            <Text variant="label">Nutrition</Text>
            <Text variant="body">{displayReason(plan.calorieGuidance.reason)}</Text>
            <Text variant="muted">
              Protein {valueOrDash(plan.macroGuidance.proteinGrams)}g - Carbs{' '}
              {valueOrDash(plan.macroGuidance.carbsGrams)}g - Fats{' '}
              {valueOrDash(plan.macroGuidance.fatsGrams)}g
            </Text>
          </Card>

          <Card>
            <Text variant="label">Training</Text>
            <Text variant="body">{plan.trainingRecommendation.summary}</Text>
            <Text variant="muted">
              {plan.trainingRecommendation.intensity.toLowerCase()} -{' '}
              {plan.trainingRecommendation.durationMinutes} min
            </Text>
          </Card>

          <Card>
            <Text variant="label">Recovery</Text>
            <Text variant="body">{plan.recoveryRecommendation.summary}</Text>
            <Text variant="muted">{plan.hydration.timingNotes}</Text>
          </Card>

          <Button title="View plan details" onPress={() => router.push('/plan-details')} />
          <Button
            title={generate.isPending ? 'Refreshing...' : 'Refresh plan'}
            variant="secondary"
            disabled={generate.isPending}
            onPress={() => generate.mutate(true)}
          />
        </>
      )}
    </Screen>
  );
}

function valueOrDash(value: number | null) {
  return value === null ? '-' : value;
}

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function displayReason(reason: string) {
  if (reason === 'This Sprint 1 mock target is a placeholder until personalized planning is added.') {
    return 'A balanced target for steady energy today.';
  }

  return reason;
}

const styles = StyleSheet.create({
  header: {
    gap: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    paddingLeft: 18
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e7f3ef',
    borderColor: colors.primary,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  badgeText: {
    color: colors.primaryDark,
    fontWeight: '800',
    fontSize: 12
  },
  successText: {
    color: colors.success,
    fontWeight: '700'
  }
});
