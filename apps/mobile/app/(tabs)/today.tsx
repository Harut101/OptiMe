import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getUsageSummary } from '@/api/account';
import { ApiError } from '@/api/client';
import { generateTodayPlan, getTodayPlan } from '@/api/daily-plans';
import { getGoal } from '@/api/goals';
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
import { BodyMapSelector } from '@/features/body-map/BodyMapSelector';
import { getPlanSafetyMessage } from '@/features/safety/safety-copy';
import { colors } from '@/theme/colors';
import { formatTime } from '@/i18n/formatters';
import { getSubscriptionPlanLabel } from '@/i18n/enum-labels';
import { useSettingsStore } from '@/store/settings-store';
import { getProgressiveOptionLabel, getProgressivePromptCopy } from '@/i18n/progressive-prompt-copy';
import type {
  ProgressivePrompt,
  UsageFeature,
  UsageLimitExceededError,
  UsageSummaryItem
} from '@/types/api';

export default function TodayScreen() {
  const { t } = useTranslation();
  const preferredLocale = useSettingsStore((state) => state.preferredLocale);
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
  const goal = useQuery({ queryKey: ['goal'], queryFn: getGoal });
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
      Alert.alert(t('today.answerSaveFailed'), `${t('errors.unableSave')}\n\n${t('today.keepUsingToday')}`)
  });
  const skipPrompt = useMutation({
    mutationFn: skipProgressivePrompt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['progressive-profile', 'next-prompt'] });
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    },
    onError: (error) =>
      Alert.alert(t('today.promptSkipFailed'), `${t('errors.unableSave')}\n\n${t('today.keepUsingToday')}`)
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
      setRefreshMessage(forceRegenerate ? t('today.refreshed') : t('today.generated'));
    },
    onError: (error) => {
      const usageLimit = getUsageLimitError(error);
      const onboardingError = getOnboardingIncompleteError(error);

      if (usageLimit) {
        setLimitMessage(formatUsageLimitMessage(usageLimit, t, preferredLocale));
        return;
      }

      if (onboardingError) {
        Alert.alert(
          t('today.setupNeeded'),
          t('today.setupNeededMessage'),
          [
            {
              text: t('today.continueSetup'),
              onPress: () => router.push(routeForMissingStage1Fields(onboardingError.missingStage1Fields))
            }
          ]
        );
        return;
      }

      Alert.alert(t('today.updateFailed'), t('errors.network'));
    }
  });
  const handleRefresh = async () => {
    await Promise.all([
      today.refetch(),
      usage.refetch(),
      progressivePrompt.refetch()
    ]);
  };
  const refreshing =
    today.isRefetching ||
    usage.isRefetching ||
    progressivePrompt.isRefetching;

  if (today.isLoading) {
    return <StateBlock title={t('today.loading')} message={t('today.loadingMessage')} />;
  }

  if (today.isError) {
    return (
      <Screen refreshing={refreshing} onRefresh={handleRefresh}>
        <StateBlock
          title={t('today.unavailable')}
          message={t('errors.unableLoad')}
          actionTitle={t('common.retry')}
          onAction={() => today.refetch()}
        />
      </Screen>
    );
  }

  const plan = today.data?.plan;
  const appMode = goal.data?.appMode ?? goal.data?.impactMode ?? 'NUTRITION_AND_TRAINING';
  const trainingEnabled = appMode === 'NUTRITION_AND_TRAINING';
  const safetyMessage = getPlanSafetyMessage(today.data);
  const generationUsage = usage.data?.items.find(
    (item) => item.feature === 'DAILY_PLAN_GENERATION'
  );
  const refreshUsage = usage.data?.items.find((item) => item.feature === 'DAILY_PLAN_REFRESH');

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <View style={styles.header}>
        <Text variant="label">{t('today.title')}</Text>
        <Text variant="title">{t('today.tagline')}</Text>
        <Text variant="muted">{t('today.intro')}</Text>
      </View>

      <UsageStatus
        isUnavailable={usage.isError}
        generationUsage={generationUsage}
        refreshUsage={refreshUsage}
      />

      {limitMessage ? (
        <Card>
          <Text variant="label">{t('today.limitReached')}</Text>
          <Text variant="body">{limitMessage}</Text>
          <Text variant="muted">{t('today.upgradeSoon')}</Text>
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
            title={t('today.noPlan')}
            message={t('today.noPlanMessage')}
            actionTitle={generate.isPending ? t('today.generating') : t('today.generate')}
            onAction={() => generate.mutate(false)}
          />
        </>
      ) : (
        <>
          <Card>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t(`enums.readiness.${today.data.readinessLevel}` as never)}</Text>
            </View>
            {refreshMessage ? <Text style={styles.successText}>{refreshMessage}</Text> : null}
            <Text variant="heading">{plan.summary.title}</Text>
            <Text variant="muted">{plan.summary.message}</Text>
            <Text variant="muted">{t('today.updatedAt', { time: formatTime(today.data.updatedAt, preferredLocale) })}</Text>
          </Card>

          {safetyMessage ? (
            <Card>
              <Text variant="label">{t('today.safetyNote')}</Text>
              <Text variant="body">{safetyMessage}</Text>
            </Card>
          ) : null}

          <Card>
            <Text variant="label">{t('today.nutrition')}</Text>
            {!trainingEnabled ? <Text style={styles.modeBadge}>{t('appModes.nutritionOnly')}</Text> : null}
            <Text variant="body">{plan.nutrition.calorieGuidance.notes}</Text>
            <Text variant="muted">{plan.nutrition.macroGuidance.notes}</Text>
            <Text variant="muted">
              {t('today.protein')}: {plan.nutrition.macroGuidance.protein} - {t('today.carbs')}:{' '}
              {plan.nutrition.macroGuidance.carbs} - {t('today.fat')}: {plan.nutrition.macroGuidance.fat}
            </Text>
          </Card>

          {!trainingEnabled ? (
            <Card>
              <Text variant="label">{t('today.trainingOffTitle')}</Text>
              <Text variant="body">{t('today.trainingOffMessage')}</Text>
              <Button title={t('today.enableTraining')} variant="secondary" onPress={() => router.push('/goal-editor')} />
            </Card>
          ) : (
            <Card>
              <Text variant="label">{t('today.training')}</Text>
              <Text variant="body">{plan.training.recommendation}</Text>
              <Text variant="muted">{plan.training.intensity.toLowerCase()} - {plan.training.notes}</Text>
            </Card>
          )}

          <Card>
            <Text variant="label">{t('today.recovery')}</Text>
            <Text variant="body">{plan.recovery.recommendation}</Text>
            <Text variant="muted">{plan.nutrition.hydration.guidance}</Text>
          </Card>

          <Button title={t('today.details')} onPress={() => router.push('/plan-details')} />
          <Button
            title={generate.isPending ? t('today.refreshing') : t('today.refresh')}
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
  const { t } = useTranslation();
  const [textValue, setTextValue] = useState('');
  const [singleValue, setSingleValue] = useState(prompt.options?.[0]?.value ?? '');
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const promptCopy = getProgressivePromptCopy(t, prompt);

  useEffect(() => {
    setTextValue('');
    setSingleValue(prompt.options?.[0]?.value ?? '');
    setSelectedValues([]);
  }, [prompt.key, prompt.options]);

  const handleAnswer = () => {
    if (prompt.inputType === 'number') {
      const parsedValue = Number(textValue);

      if (!Number.isFinite(parsedValue)) {
        Alert.alert(t('today.quickDetail'), t('today.numberNeeded'));
        return;
      }

      onAnswer(parsedValue);
      return;
    }

    if (prompt.inputType === 'multiSelect') {
      if (selectedValues.length === 0) {
        Alert.alert(t('today.quickDetail'), t('today.optionsNeeded'));
        return;
      }

      onAnswer(selectedValues);
      return;
    }

    if (prompt.inputType === 'singleSelect') {
      if (!singleValue) {
        Alert.alert(t('today.quickDetail'), t('today.optionNeeded'));
        return;
      }

      onAnswer(singleValue);
      return;
    }

    if (!textValue.trim()) {
      Alert.alert(t('today.quickDetail'), t('today.answerNeeded'));
      return;
    }

    onAnswer(textValue);
  };

  return (
    <Card>
      <View style={styles.promptHeader}>
        <Text variant="label">{t('today.improvePlans')}</Text>
        <Text variant="heading">{promptCopy.title}</Text>
        <Text variant="muted">{promptCopy.description}</Text>
      </View>

      {prompt.inputType === 'stringList' ? (
        <Field
          label={t('today.yourAnswer')}
          placeholder={t('today.listPlaceholder')}
          value={textValue}
          onChangeText={setTextValue}
        />
      ) : null}

      {prompt.inputType === 'number' ? (
        <Field
          label={t('today.yourAnswer')}
          keyboardType="numeric"
          value={textValue}
          onChangeText={setTextValue}
        />
      ) : null}

      {prompt.inputType === 'singleSelect' && prompt.options ? (
        <SelectChips
          label={t('today.chooseOne')}
          value={singleValue}
          onChange={setSingleValue}
          options={prompt.options.map((option) => ({ ...option, label: getProgressiveOptionLabel(t, prompt.key, option.value, option.label) }))}
        />
      ) : null}

      {prompt.inputType === 'multiSelect' && prompt.options ? (
        prompt.key === 'TARGET_MUSCLE_GROUPS' ? (
          <BodyMapSelector
            value={selectedValues as import('@optime/shared-types').TargetMuscleGroup[]}
            onChange={setSelectedValues}
          />
        ) : (
        <View style={styles.multiSelectWrap}>
          <Text variant="label">{t('today.chooseAny')}</Text>
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
                    {getProgressiveOptionLabel(t, prompt.key, option.value, option.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        )
      ) : null}

      <View style={styles.promptActions}>
        <Button
          title={isSaving ? t('common.saving') : t('today.answer')}
          disabled={isSaving}
          onPress={handleAnswer}
          style={styles.promptButton}
        />
        <Button
          title={t('today.skip')}
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
  const { t } = useTranslation();
  if (isUnavailable) {
    return (
      <Card>
        <Text variant="label">{t('today.planUsage')}</Text>
        <Text variant="muted">{t('today.usageUnavailable')}</Text>
      </Card>
    );
  }

  if (!generationUsage && !refreshUsage) {
    return null;
  }

  return (
    <Card>
      <Text variant="label">{t('today.planUsage')}</Text>
      {generationUsage ? (
        <Text variant="muted">
          {t('today.generationsLeft', { count: generationUsage.remaining })}
        </Text>
      ) : null}
      {refreshUsage ? (
        <Text variant="muted">{t('today.refreshesLeft', { count: refreshUsage.remaining })}</Text>
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

function formatUsageLimitMessage(error: UsageLimitExceededError, t: ReturnType<typeof useTranslation>['t'], locale: string) {
  const action = getUsageFeatureLabel(error.feature, t);
  const resetAt = formatResetAt(error.resetAt, locale);
  const reset = resetAt ? t('today.tryAfter', { time: resetAt }) : t('today.tryAfterReset');
  return t('today.limitMessage', {
    plan: getSubscriptionPlanLabel(t, error.currentPlan),
    limit: error.limit,
    action,
    reset
  });
}

function getUsageFeatureLabel(feature: UsageFeature, t: ReturnType<typeof useTranslation>['t']) {
  if (feature === 'DAILY_PLAN_REFRESH') {
    return t('today.usageRefresh');
  }

  if (feature === 'AI_DAILY_PLAN_GENERATION') {
    return t('today.usageAiGeneration');
  }

  return t('today.usageGeneration');
}

function formatResetAt(value: string, locale: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatTime(date, locale);
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
  modeBadge: {
    alignSelf: 'flex-start',
    color: colors.primaryDark,
    backgroundColor: '#FFE8EE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontWeight: '800'
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
