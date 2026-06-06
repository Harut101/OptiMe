import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { getUsageSummary } from '@/api/account';
import { ApiError } from '@/api/client';
import { generateTodayPlan, getTodayPlan } from '@/api/daily-plans';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';
import type { UsageFeature, UsageLimitExceededError, UsageSummaryItem } from '@/types/api';

export default function TodayScreen() {
  const queryClient = useQueryClient();
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const today = useQuery({
    queryKey: ['today-plan'],
    queryFn: getTodayPlan
  });
  const usage = useQuery({
    queryKey: ['usage-summary'],
    queryFn: getUsageSummary
  });
  const generate = useMutation({
    mutationFn: (forceRegenerate: boolean) => generateTodayPlan(forceRegenerate),
    onSuccess: async (data, forceRegenerate) => {
      queryClient.setQueryData(['today-plan'], data);
      await queryClient.invalidateQueries({ queryKey: ['today-plan'] });
      await queryClient.invalidateQueries({ queryKey: ['usage-summary'] });
      await queryClient.refetchQueries({ queryKey: ['today-plan'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['usage-summary'], type: 'active' });
      setLimitMessage(null);
      setRefreshMessage(forceRegenerate ? 'Plan refreshed' : 'Plan generated.');
    },
    onError: (error) => {
      const usageLimit = getUsageLimitError(error);

      if (usageLimit) {
        setLimitMessage(formatUsageLimitMessage(usageLimit));
        return;
      }

      Alert.alert('Plan update failed', error.message);
    }
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

  const plan = today.data?.plan;
  const generationUsage = usage.data?.items.find(
    (item) => item.feature === 'DAILY_PLAN_GENERATION'
  );
  const refreshUsage = usage.data?.items.find((item) => item.feature === 'DAILY_PLAN_REFRESH');

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="label">Today</Text>
        <Text variant="title">Steady, practical, ready.</Text>
        <Text variant="muted">A simple plan for food, training, hydration, and recovery today.</Text>
      </View>

      <UsageStatus
        isUnavailable={usage.isError}
        generationUsage={generationUsage}
        refreshUsage={refreshUsage}
      />

      {limitMessage ? (
        <Card>
          <Text variant="label">Limit reached</Text>
          <Text variant="body">{limitMessage}</Text>
          <Text variant="muted">Upgrade options coming soon.</Text>
        </Card>
      ) : null}

      {!today.data || !plan ? (
        <>
          <StateBlock
            title="No plan yet"
            message="Generate a simple plan for food, training, hydration, and recovery today."
            actionTitle={generate.isPending ? 'Generating...' : 'Generate today plan'}
            onAction={() => generate.mutate(false)}
          />
        </>
      ) : (
        <>
          <Card>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{today.data.readinessLevel}</Text>
            </View>
            {refreshMessage ? <Text style={styles.successText}>{refreshMessage}</Text> : null}
            <Text variant="heading">{plan.summary.title}</Text>
            <Text variant="muted">{plan.summary.message}</Text>
            {today.data.status === 'FALLBACK' || plan.safety.adjustedForSafety ? (
              <Text variant="muted">This plan was adjusted to keep today safe and manageable.</Text>
            ) : null}
            <Text variant="muted">Updated {formatUpdatedAt(today.data.updatedAt)}</Text>
          </Card>

          <Card>
            <Text variant="label">Nutrition</Text>
            <Text variant="body">{plan.nutrition.calorieGuidance.notes}</Text>
            <Text variant="muted">{plan.nutrition.macroGuidance.notes}</Text>
            <Text variant="muted">
              Protein: {plan.nutrition.macroGuidance.protein} - Carbs:{' '}
              {plan.nutrition.macroGuidance.carbs} - Fat: {plan.nutrition.macroGuidance.fat}
            </Text>
          </Card>

          <Card>
            <Text variant="label">Training</Text>
            <Text variant="body">{plan.training.recommendation}</Text>
            <Text variant="muted">{plan.training.intensity.toLowerCase()} - {plan.training.notes}</Text>
          </Card>

          <Card>
            <Text variant="label">Recovery</Text>
            <Text variant="body">{plan.recovery.recommendation}</Text>
            <Text variant="muted">{plan.nutrition.hydration.guidance}</Text>
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

function UsageStatus({
  isUnavailable,
  generationUsage,
  refreshUsage
}: {
  isUnavailable: boolean;
  generationUsage?: UsageSummaryItem;
  refreshUsage?: UsageSummaryItem;
}) {
  if (isUnavailable) {
    return (
      <Card>
        <Text variant="label">Plan usage</Text>
        <Text variant="muted">Plan details unavailable</Text>
      </Card>
    );
  }

  if (!generationUsage && !refreshUsage) {
    return null;
  }

  return (
    <Card>
      <Text variant="label">Plan usage</Text>
      {generationUsage ? (
        <Text variant="muted">
          Generations left today: {generationUsage.remaining}
        </Text>
      ) : null}
      {refreshUsage ? (
        <Text variant="muted">Refreshes left today: {refreshUsage.remaining}</Text>
      ) : null}
    </Card>
  );
}

function getUsageLimitError(error: Error) {
  if (!(error instanceof ApiError) || typeof error.body !== 'object' || error.body === null) {
    return null;
  }

  const body = error.body as Partial<UsageLimitExceededError>;

  return body.code === 'USAGE_LIMIT_REACHED' ? (body as UsageLimitExceededError) : null;
}

function formatUsageLimitMessage(error: UsageLimitExceededError) {
  const action = getUsageFeatureLabel(error.feature);
  const reset = formatResetAt(error.resetAt);

  return [
    "You've reached today's limit for this plan.",
    `Your ${formatPlan(error.currentPlan)} plan includes ${error.limit} ${action} per day.`,
    reset ? `Try again after ${reset}.` : 'Try again after reset.'
  ].join(' ');
}

function getUsageFeatureLabel(feature: UsageFeature) {
  if (feature === 'DAILY_PLAN_REFRESH') {
    return 'refresh';
  }

  if (feature === 'AI_DAILY_PLAN_GENERATION') {
    return 'AI plan generation';
  }

  return 'plan generation';
}

function formatPlan(plan: string) {
  return plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();
}

function formatResetAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
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
