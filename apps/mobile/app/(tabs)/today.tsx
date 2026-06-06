import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { getUsageSummary } from '@/api/account';
import { ApiError } from '@/api/client';
import { generateTodayPlan, getTodayPlan } from '@/api/daily-plans';
import {
  answerProgressivePrompt,
  getNextProgressivePrompt,
  skipProgressivePrompt
} from '@/api/progressive-profile';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { SelectChips } from '@/components/SelectChips';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { getPlanSafetyMessage } from '@/features/safety/safety-copy';
import { colors } from '@/theme/colors';
import type {
  ProgressivePrompt,
  UsageFeature,
  UsageLimitExceededError,
  UsageSummaryItem
} from '@/types/api';

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
  const progressivePrompt = useQuery({
    queryKey: ['progressive-profile', 'next-prompt'],
    queryFn: getNextProgressivePrompt
  });
  const answerPrompt = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string | string[] | number | boolean }) =>
      answerProgressivePrompt(key, { value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['progressive-profile', 'next-prompt'] });
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    },
    onError: (error) =>
      Alert.alert('Could not save this answer', `${error.message}\n\nYou can keep using Today.`)
  });
  const skipPrompt = useMutation({
    mutationFn: skipProgressivePrompt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['progressive-profile', 'next-prompt'] });
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    },
    onError: (error) =>
      Alert.alert('Could not skip this prompt', `${error.message}\n\nYou can keep using Today.`)
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
      const onboardingError = getOnboardingIncompleteError(error);

      if (usageLimit) {
        setLimitMessage(formatUsageLimitMessage(usageLimit));
        return;
      }

      if (onboardingError) {
        Alert.alert(
          'A little setup is needed',
          'Please finish the required basics so we can keep your first plan safe.',
          [
            {
              text: 'Continue setup',
              onPress: () => router.push(routeForMissingStage1Fields(onboardingError.missingStage1Fields))
            }
          ]
        );
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
  const safetyMessage = getPlanSafetyMessage(today.data);
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

      {progressivePrompt.data ? (
        <ProgressivePromptCard
          prompt={progressivePrompt.data}
          isSaving={answerPrompt.isPending || skipPrompt.isPending}
          onAnswer={(value) => answerPrompt.mutate({ key: progressivePrompt.data!.key, value })}
          onSkip={() => skipPrompt.mutate(progressivePrompt.data!.key)}
        />
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
            <Text variant="muted">Updated {formatUpdatedAt(today.data.updatedAt)}</Text>
          </Card>

          {safetyMessage ? (
            <Card>
              <Text variant="label">Safety note</Text>
              <Text variant="body">{safetyMessage}</Text>
            </Card>
          ) : null}

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

function ProgressivePromptCard({
  prompt,
  isSaving,
  onAnswer,
  onSkip
}: {
  prompt: ProgressivePrompt;
  isSaving: boolean;
  onAnswer: (value: string | string[] | number | boolean) => void;
  onSkip: () => void;
}) {
  const [textValue, setTextValue] = useState('');
  const [singleValue, setSingleValue] = useState(prompt.options?.[0]?.value ?? '');
  const [selectedValues, setSelectedValues] = useState<string[]>([]);

  useEffect(() => {
    setTextValue('');
    setSingleValue(prompt.options?.[0]?.value ?? '');
    setSelectedValues([]);
  }, [prompt.key, prompt.options]);

  const handleAnswer = () => {
    if (prompt.inputType === 'number') {
      const parsedValue = Number(textValue);

      if (!Number.isFinite(parsedValue)) {
        Alert.alert('One quick detail', 'Please enter a number, or skip this for now.');
        return;
      }

      onAnswer(parsedValue);
      return;
    }

    if (prompt.inputType === 'multiSelect') {
      if (selectedValues.length === 0) {
        Alert.alert('One quick detail', 'Choose at least one option, or skip this for now.');
        return;
      }

      onAnswer(selectedValues);
      return;
    }

    if (prompt.inputType === 'singleSelect') {
      if (!singleValue) {
        Alert.alert('One quick detail', 'Choose an option, or skip this for now.');
        return;
      }

      onAnswer(singleValue);
      return;
    }

    if (!textValue.trim()) {
      Alert.alert('One quick detail', 'Add an answer, or skip this for now.');
      return;
    }

    onAnswer(textValue);
  };

  return (
    <Card>
      <View style={styles.promptHeader}>
        <Text variant="label">Improve future plans</Text>
        <Text variant="heading">{prompt.title}</Text>
        <Text variant="muted">{prompt.description}</Text>
      </View>

      {prompt.inputType === 'stringList' ? (
        <Field
          label="Your answer"
          placeholder="Separate items with commas"
          value={textValue}
          onChangeText={setTextValue}
        />
      ) : null}

      {prompt.inputType === 'number' ? (
        <Field
          label="Your answer"
          keyboardType="numeric"
          value={textValue}
          onChangeText={setTextValue}
        />
      ) : null}

      {prompt.inputType === 'singleSelect' && prompt.options ? (
        <SelectChips
          label="Choose one"
          value={singleValue}
          onChange={setSingleValue}
          options={prompt.options}
        />
      ) : null}

      {prompt.inputType === 'multiSelect' && prompt.options ? (
        <View style={styles.multiSelectWrap}>
          <Text variant="label">Choose any that fit</Text>
          <View style={styles.multiSelectRow}>
            {prompt.options.map((option) => {
              const active = selectedValues.includes(option.value);
              return (
                <Pressable
                  key={option.value}
                  onPress={() =>
                    setSelectedValues((current) =>
                      active
                        ? current.filter((value) => value !== option.value)
                        : [...current, option.value]
                    )
                  }
                  style={[styles.multiChip, active ? styles.multiChipActive : null]}
                >
                  <Text style={[styles.multiChipText, active ? styles.multiChipTextActive : null]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.promptActions}>
        <Button
          title={isSaving ? 'Saving...' : 'Answer'}
          disabled={isSaving}
          onPress={handleAnswer}
          style={styles.promptButton}
        />
        <Button
          title="Skip for now"
          variant="ghost"
          disabled={isSaving}
          onPress={onSkip}
          style={styles.promptButton}
        />
      </View>
    </Card>
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

function getOnboardingIncompleteError(error: Error) {
  if (!(error instanceof ApiError) || typeof error.body !== 'object' || error.body === null) {
    return null;
  }

  const body = error.body as {
    code?: string;
    missingStage1Fields?: string[];
  };

  return body.code === 'ONBOARDING_STAGE_1_INCOMPLETE' && Array.isArray(body.missingStage1Fields)
    ? { missingStage1Fields: body.missingStage1Fields }
    : null;
}

function routeForMissingStage1Fields(missingFields: string[]) {
  if (
    missingFields.some((field) =>
      ['privacyConsent', 'firstName', 'gender', 'dateOfBirth', 'heightCm', 'weightKg', 'activityLevel'].includes(field)
    )
  ) {
    return '/(onboarding)/profile' as const;
  }

  if (
    missingFields.some((field) =>
      ['goalType', 'targetWeightKg', 'targetTimelineDays', 'impactMode'].includes(field)
    )
  ) {
    return '/(onboarding)/goal' as const;
  }

  if (missingFields.includes('allergyInformation')) {
    return '/(onboarding)/nutrition-preferences' as const;
  }

  return '/(onboarding)/training-schedule' as const;
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
  },
  promptHeader: {
    gap: 6
  },
  promptActions: {
    flexDirection: 'row',
    gap: 10
  },
  promptButton: {
    flex: 1
  },
  multiSelectWrap: {
    gap: 8
  },
  multiSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  multiChip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  multiChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#e7f3ef'
  },
  multiChipText: {
    fontSize: 14,
    color: colors.ink
  },
  multiChipTextActive: {
    color: colors.primaryDark,
    fontWeight: '700'
  }
});
