import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { ApiError } from '@/api/client';
import { generateTodayPlan, getTodayPlan } from '@/api/daily-plans';
import { getFoodLog } from '@/api/food-logs';
import { getGoal } from '@/api/goals';
import { getHealthConnections, getTodayWearableSnapshot } from '@/api/health';
import { getTrainingSchedule } from '@/api/training-schedule';
import { getTrainingOverride, saveTrainingOverride } from '@/api/training-overrides';
import { getWorkoutSessionByPlan } from '@/api/workout-sessions';
import {
  answerProgressivePrompt,
  getNextProgressivePrompt,
  skipProgressivePrompt
} from '@/api/progressive-profile';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ContextNoteCard } from '@/components/ContextNoteCard';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { SelectChips } from '@/components/SelectChips';
import { StateBlock } from '@/components/StateBlock';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { BodyMapSelector } from '@/features/body-map/BodyMapSelector';
import { DashboardProgressCard } from '@/features/today-dashboard/DashboardProgressCard';
import { WearableSummaryCard } from '@/features/today-dashboard/WearableSummaryCard';
import {
  resolveNutritionProgress,
  resolveTrainingProgress
} from '@/features/today-dashboard/today-progress';
import { getPlanSafetyMessage } from '@/features/safety/safety-copy';
import { getContextNoteMessage, getContextNoteTitle } from '@/features/daily-plan/context-note-copy';
import { colors } from '@/theme/colors';
import { formatTime } from '@/i18n/formatters';
import { getSubscriptionPlanLabel } from '@/i18n/enum-labels';
import { useSettingsStore } from '@/store/settings-store';
import { getProgressiveOptionLabel, getProgressivePromptCopy } from '@/i18n/progressive-prompt-copy';
import { getPlatformHealthProvider } from '@/features/health/health-platform';
import {
  dismissHealthReadinessPrompt,
  getHealthReadinessPromptDismissedAt,
  isHealthReadinessPromptDismissedRecently
} from '@/features/health/health-readiness-storage';
import { nativeHealthService, NativeHealthServiceError } from '@/features/health/native-health.service';
import { resolveHealthDataReadiness } from '@/features/health/health-readiness';
import { getLocalDateString } from '@/features/training-overrides/local-date';
import { ORDERED_DAYS, toDraft } from '@/features/training-schedule/weekly-schedule';
import { useTrainingScheduleDraftStore } from '@/store/training-schedule-draft-store';
import {
  formatWorkoutFocus,
  formatWorkoutSetCount,
  getWorkoutAccessibilityLabel
} from '@/features/workout/workout-summary';
import type {
  ProgressivePrompt,
  UsageLimitExceededError,
  DailyPlanJson
} from '@/types/api';

export default function TodayScreen() {
  const { t } = useTranslation();
  const { generateAfterRoutine, generateAfterOverride } = useLocalSearchParams<{
    generateAfterRoutine?: string;
    generateAfterOverride?: string;
  }>();
  const preferredLocale = useSettingsStore((state) => state.preferredLocale);
  const queryClient = useQueryClient();
  const setTrainingScheduleDraft = useTrainingScheduleDraftStore((state) => state.setDraft);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [healthReadinessMessage, setHealthReadinessMessage] = useState<string | null>(null);
  const [handledRoutineReturn, setHandledRoutineReturn] = useState(false);
  const [handledOverrideReturn, setHandledOverrideReturn] = useState(false);
  const todayLocalDate = getLocalDateString();
  const today = useQuery({
    queryKey: ['today-plan'],
    queryFn: getTodayPlan
  });
  const workoutSession = useQuery({
    queryKey: ['workout-session-by-plan', today.data?.id],
    queryFn: () => getWorkoutSessionByPlan(today.data!.id),
    enabled: Boolean(today.data?.id)
  });
  const foodLog = useQuery({
    queryKey: ['food-log', today.data?.id],
    queryFn: () => getFoodLog(today.data!.id),
    enabled: Boolean(today.data?.plan.nutrition.foodPlan)
  });
  const wearableSnapshot = useQuery({
    queryKey: ['wearable-snapshot', 'today'],
    queryFn: getTodayWearableSnapshot
  });
  const healthConnections = useQuery({
    queryKey: ['health-connections'],
    queryFn: getHealthConnections
  });
  const trainingSchedule = useQuery({
    queryKey: ['training-schedule'],
    queryFn: getTrainingSchedule
  });
  const trainingOverride = useQuery({
    queryKey: ['training-override', todayLocalDate],
    queryFn: () => getTrainingOverride(todayLocalDate)
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
      setLimitMessage(null);
      setRefreshMessage(forceRegenerate ? t('today.refreshed') : t('today.generated'));
    },
    onError: (error) => {
      const usageLimit = getUsageLimitError(error);
      const onboardingError = getOnboardingIncompleteError(error);

      if (usageLimit) {
        const message = formatUsageLimitMessage(usageLimit, t, preferredLocale);
        setLimitMessage(message);
        Alert.alert(t('today.limitReached'), `${message} ${t('today.upgradeSoon')}`);
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
  const appleHealthSync = useMutation({
    mutationFn: nativeHealthService.syncAppleHealthToday,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['health-connections'] });
      await queryClient.invalidateQueries({ queryKey: ['wearable-snapshot', 'today'] });
      await queryClient.refetchQueries({ queryKey: ['health-connections'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['wearable-snapshot', 'today'], type: 'active' });
    }
  });
  const handleRefresh = async () => {
    const refreshes: Array<Promise<unknown>> = [
      today.refetch(),
      wearableSnapshot.refetch(),
      healthConnections.refetch(),
      progressivePrompt.refetch(),
      trainingSchedule.refetch(),
      trainingOverride.refetch()
    ];

    if (today.data?.id) {
      refreshes.push(workoutSession.refetch());
      if (today.data.plan.nutrition.foodPlan) {
        refreshes.push(foodLog.refetch());
      }
    }

    await Promise.all(refreshes);
  };
  const refreshing =
    today.isRefetching ||
    wearableSnapshot.isRefetching ||
    healthConnections.isRefetching ||
    progressivePrompt.isRefetching ||
    trainingSchedule.isRefetching ||
    trainingOverride.isRefetching ||
    workoutSession.isRefetching ||
    foodLog.isRefetching;

  useEffect(() => {
    if (generateAfterRoutine !== '1' || handledRoutineReturn || today.isLoading || generate.isPending) {
      return;
    }

    setHandledRoutineReturn(true);
    if (today.data) {
      Alert.alert(
        t('today.trainingRoutineUpdated'),
        t('today.trainingRoutineUpdatedExistingPlan'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('today.refresh'), onPress: () => void continueThroughHealthReadiness(true) }
        ]
      );
      return;
    }

    setRefreshMessage(t('today.trainingRoutineUpdatedReady'));
    void continueThroughHealthReadiness(false);
  }, [generateAfterRoutine, generate, handledRoutineReturn, t, today.data, today.isLoading]);

  useEffect(() => {
    if (generateAfterOverride !== '1' || handledOverrideReturn || today.isLoading || generate.isPending) {
      return;
    }

    setHandledOverrideReturn(true);
    if (today.data) {
      Alert.alert(
        t('trainingOverrides.dailyOverrideSaved'),
        t('trainingOverrides.overrideSavedExistingPlan'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('today.refresh'), onPress: () => void continueThroughHealthReadiness(true) }
        ]
      );
      return;
    }

    setRefreshMessage(t('trainingOverrides.overrideSavedGenerating'));
    void continueThroughHealthReadiness(false);
  }, [generateAfterOverride, generate, handledOverrideReturn, t, today.data, today.isLoading]);

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
  const completedWorkout = workoutSession.data?.status === 'COMPLETED'
    ? workoutSession.data.summary
    : null;
  const nutritionProgress = resolveNutritionProgress({
    plan,
    foodLog: foodLog.data,
    locale: preferredLocale,
    t
  });
  const trainingProgress = resolveTrainingProgress({
    plan,
    goal: goal.data,
    workoutSession: workoutSession.data,
    t
  });

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <ScreenHeader eyebrow={t('today.title')} title={t('today.tagline')} subtitle={t('today.intro')} />

      {today.data && plan ? (
        <>
          <View style={styles.dashboardGrid}>
            <View style={styles.dashboardCard}>
              <DashboardProgressCard
                title={t('todayDashboard.nutritionProgress')}
                value={nutritionProgress.value}
                centerLabel={nutritionProgress.centerLabel}
                subtitle={nutritionProgress.subtitle}
                hint={nutritionProgress.hint}
                tone="nutrition"
                accessibilityLabel={nutritionProgress.accessibilityLabel}
              />
            </View>
            <View style={styles.dashboardCard}>
              <DashboardProgressCard
                title={t('todayDashboard.trainingProgress')}
                value={trainingProgress.value}
                centerLabel={trainingProgress.centerLabel}
                subtitle={trainingProgress.subtitle}
                hint={trainingProgress.hint}
                tone="training"
                accessibilityLabel={trainingProgress.accessibilityLabel}
              />
            </View>
          </View>
          <WearableSummaryCard
            wearable={wearableSnapshot.data}
            connections={healthConnections.data?.connections}
            locale={preferredLocale}
            onOpenHealth={() => router.push('/health-data')}
          />
        </>
      ) : null}

      {limitMessage ? (
        <ContextNoteCard
          title={t('today.limitReached')}
          message={`${limitMessage} ${t('today.upgradeSoon')}`}
          tone="warning"
        />
      ) : null}

      {healthReadinessMessage ? (
        <ContextNoteCard
          title={t('health.healthDataOptional')}
          message={healthReadinessMessage}
          tone="health"
        />
      ) : null}

      {progressivePrompt.data ? (
        <ProgressivePromptCard
          prompt={progressivePrompt.data}
          isSaving={answerPrompt.isPending || skipPrompt.isPending}
          onAnswer={(value) => answerPrompt.mutate({ key: progressivePrompt.data!.key, value })}
          onSkip={() => skipPrompt.mutate(progressivePrompt.data!.key)}
        />
      ) : null}

      <WearableContextNote
        contextNotes={plan?.contextNotes}
        hasPlan={Boolean(today.data?.plan)}
        hasSnapshot={Boolean(wearableSnapshot.data?.snapshot)}
        hasRecentData={Boolean(wearableSnapshot.data?.hasRecentData)}
        isUnavailable={wearableSnapshot.isError}
      />

      {!today.data || !plan ? (
        <>
          <StateBlock
            title={t('today.noPlan')}
            message={t('today.noPlanMessage')}
            actionTitle={generate.isPending ? t('today.generating') : t('today.generate')}
            onAction={() => handleGeneratePlan(false)}
          />
        </>
      ) : (
        <>
          <Card>
            <StatusPill label={t(`enums.readiness.${today.data.readinessLevel}` as never)} tone="success" />
            {refreshMessage ? <Text style={styles.successText}>{refreshMessage}</Text> : null}
            <Text variant="heading">{plan.summary.title}</Text>
            <Text variant="muted">{plan.summary.message}</Text>
            <Text variant="muted">{t('today.updatedAt', { time: formatTime(today.data.updatedAt, preferredLocale) })}</Text>
          </Card>

          {safetyMessage ? (
            <ContextNoteCard title={t('today.safetyNote')} message={safetyMessage} tone="warning" />
          ) : null}

          <Card>
            <SectionHeader title={t('today.nutrition')} />
            {!trainingEnabled ? <StatusPill label={t('appModes.nutritionOnly')} tone="warning" /> : null}
            <Text variant="body">{plan.nutrition.calorieGuidance.notes}</Text>
            <Text variant="muted">{plan.nutrition.macroGuidance.notes}</Text>
            <Text variant="muted">
              {t('today.protein')}: {plan.nutrition.macroGuidance.protein} - {t('today.carbs')}:{' '}
              {plan.nutrition.macroGuidance.carbs} - {t('today.fat')}: {plan.nutrition.macroGuidance.fat}
            </Text>
          </Card>

          {!trainingEnabled ? (
            <Card>
              <SectionHeader title={t('today.trainingOffTitle')} />
              <Text variant="body">{t('today.trainingOffMessage')}</Text>
              <Button title={t('today.enableTraining')} variant="secondary" onPress={() => router.push('/goal-editor')} />
            </Card>
          ) : (
            <Card>
              <SectionHeader title={t('today.training')} />
              <Text variant="body">{plan.training.recommendation}</Text>
              <Text variant="muted">{plan.training.intensity.toLowerCase()} - {plan.training.notes}</Text>
              <Button
                title={t('trainingOverrides.restTodayOnly')}
                variant="ghost"
                disabled={generate.isPending}
                onPress={handleRestTodayOnly}
              />
            </Card>
          )}

          {completedWorkout ? (
            <Card>
              <SectionHeader title={t('workout.workoutCompleted')} />
              <Text variant="body">{formatWorkoutFocus(completedWorkout, t)}</Text>
              <Text variant="muted">{formatWorkoutSetCount(completedWorkout, t)}</Text>
              {completedWorkout.isPartial ? <Text variant="muted">{t('workout.partialWorkoutSaved')}</Text> : null}
              <Button
                title={t('workout.viewSummary')}
                variant="secondary"
                accessibilityLabel={getWorkoutAccessibilityLabel(completedWorkout, t)}
                onPress={() => router.push({ pathname: '/workout-session' as never, params: { sessionId: completedWorkout.id } })}
              />
            </Card>
          ) : null}

          <Card>
            <SectionHeader title={t('today.recovery')} />
            <Text variant="body">{plan.recovery.recommendation}</Text>
            <Text variant="muted">{plan.nutrition.hydration.guidance}</Text>
          </Card>

          <Button title={t('today.details')} onPress={() => router.push('/plan-details')} />
          <Button
            title={generate.isPending ? t('today.refreshing') : t('today.refresh')}
            variant="secondary"
            disabled={generate.isPending}
            onPress={() => handleGeneratePlan(true)}
          />
        </>
      )}
    </Screen>
  );

  async function handleGeneratePlan(forceRegenerate: boolean) {
    if (forceRegenerate || appMode === 'NUTRITION_ONLY') {
      await continueThroughHealthReadiness(forceRegenerate);
      return;
    }

    try {
      const schedule = trainingSchedule.data ?? await queryClient.fetchQuery({
        queryKey: ['training-schedule'],
        queryFn: getTrainingSchedule
      });
      if (!schedule) {
        throw new Error('Training schedule unavailable');
      }
      const todayDayOfWeek = getTodayDayOfWeek();
      const todayRoutineDay = schedule.days.find((day) => day.dayOfWeek === todayDayOfWeek);
      const override = trainingOverride.data ?? await queryClient.fetchQuery({
        queryKey: ['training-override', todayLocalDate],
        queryFn: () => getTrainingOverride(todayLocalDate)
      });
      const isTrainingDay = override
        ? override.overrideType === 'TRAINING_DAY'
        : Boolean(schedule.isActive && todayRoutineDay?.isTrainingDay);

      if (isTrainingDay) {
        await continueThroughHealthReadiness(false);
        return;
      }

      Alert.alert(
        t('today.trainingTodayPromptTitle'),
        t('today.trainingTodayPromptMessage'),
        [
          {
            text: t('today.generateRestDayPlan'),
            onPress: () => void continueThroughHealthReadiness(false)
          },
          {
            text: t('today.setUpTodaysWorkout'),
            onPress: () => {
              router.push({
                pathname: '/training-overrides/day' as never,
                params: { dayOfWeek: todayDayOfWeek, localDate: todayLocalDate, returnToGenerate: '1' }
              });
            }
          },
          {
            text: t('trainingOverrides.editWeeklyRoutine'),
            onPress: () => {
              setTrainingScheduleDraft(toDraft(schedule));
              router.push({
                pathname: '/training-schedule/day' as never,
                params: { dayOfWeek: todayDayOfWeek, returnToGenerate: '1' }
              });
            }
          },
          { text: t('common.cancel'), style: 'cancel' }
        ]
      );
    } catch {
      Alert.alert(t('schedule.unavailable'), t('errors.unableLoad'));
    }
  }

  async function handleRestTodayOnly() {
    Alert.alert(
      t('trainingOverrides.restTodayTitle'),
      t('trainingOverrides.restTodayConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('trainingOverrides.restTodayOnly'),
          onPress: async () => {
            try {
              const saved = await saveTrainingOverride(todayLocalDate, {
                overrideType: 'REST_DAY',
                source: 'USER_SELECTED_REST_TODAY'
              });
              queryClient.setQueryData(['training-override', todayLocalDate], saved);
              await queryClient.invalidateQueries({ queryKey: ['training-override', todayLocalDate] });
              if (today.data) {
                Alert.alert(
                  t('trainingOverrides.dailyOverrideSaved'),
                  t('trainingOverrides.restOverrideExistingPlan'),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('today.refresh'), onPress: () => void continueThroughHealthReadiness(true) }
                  ]
                );
                return;
              }
              setRefreshMessage(t('trainingOverrides.overrideSavedGenerating'));
              void continueThroughHealthReadiness(false);
            } catch {
              Alert.alert(t('trainingOverrides.saveFailed'), t('errors.unableSave'));
            }
          }
        }
      ]
    );
  }

  async function continueThroughHealthReadiness(forceRegenerate: boolean) {
    try {
      const [connectionsResult, snapshotResult, dismissedAt] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['health-connections'],
          queryFn: getHealthConnections
        }),
        queryClient.fetchQuery({
          queryKey: ['wearable-snapshot', 'today'],
          queryFn: getTodayWearableSnapshot
        }),
        getHealthReadinessPromptDismissedAt()
      ]);
      const readiness = resolveHealthDataReadiness({
        connections: connectionsResult.connections,
        snapshot: snapshotResult,
        planLocalDate: todayLocalDate,
        platformProvider: getPlatformHealthProvider(),
        noProviderPromptDismissedRecently: isHealthReadinessPromptDismissedRecently(dismissedAt)
      });

      if (!readiness.shouldPrompt || readiness.state === 'FRESH') {
        generate.mutate(forceRegenerate);
        return;
      }

      if (readiness.state === 'STALE' && readiness.source === 'APPLE_HEALTH') {
        Alert.alert(
          t('health.readinessUpdateTitle'),
          t('health.readinessUpdateBody'),
          [
            {
              text: t('health.syncNow'),
              onPress: () => void syncAppleHealthThenGenerate(forceRegenerate)
            },
            {
              text: t('health.continueWithoutLatestData'),
              onPress: () => generate.mutate(forceRegenerate)
            },
            { text: t('common.cancel'), style: 'cancel' }
          ]
        );
        return;
      }

      if (readiness.state === 'NOT_CONNECTED') {
        Alert.alert(
          t('health.readinessConnectTitle'),
          t('health.readinessConnectBody'),
          [
            {
              text: t('health.connectAppleHealth'),
              onPress: () => void syncAppleHealthThenGenerate(forceRegenerate)
            },
            {
              text: t('health.notNow'),
              onPress: () => void dismissHealthReadinessAndGenerate(forceRegenerate)
            },
            { text: t('common.cancel'), style: 'cancel' }
          ]
        );
        return;
      }

      generate.mutate(forceRegenerate);
    } catch {
      setHealthReadinessMessage(t('health.readinessUnavailableContinue'));
      generate.mutate(forceRegenerate);
    }
  }

  async function dismissHealthReadinessAndGenerate(forceRegenerate: boolean) {
    await dismissHealthReadinessPrompt();
    setHealthReadinessMessage(t('health.healthDataOptionalCopy'));
    generate.mutate(forceRegenerate);
  }

  async function syncAppleHealthThenGenerate(forceRegenerate: boolean) {
    try {
      const result = await appleHealthSync.mutateAsync();

      if (result.messageCode === 'SYNCED') {
        setHealthReadinessMessage(t('health.appleHealthSynced'));
        generate.mutate(forceRegenerate);
        return;
      }

      if (result.messageCode === 'NO_DATA') {
        Alert.alert(
          t('health.readinessNoDataTitle'),
          t('health.readinessNoDataBody'),
          [
            {
              text: t('health.continueWithoutLatestData'),
              onPress: () => generate.mutate(forceRegenerate)
            },
            {
              text: t('common.retry'),
              onPress: () => void syncAppleHealthThenGenerate(forceRegenerate)
            }
          ]
        );
        return;
      }

      if (result.messageCode === 'PERMISSION_DENIED') {
        showHealthReadinessContinueAlert(
          forceRegenerate,
          t('health.permissionDenied'),
          t('health.permissionDeniedContinue')
        );
        return;
      }

      showHealthReadinessContinueAlert(
        forceRegenerate,
        t('health.appleHealthUnavailableTitle'),
        getAppleHealthUnavailableMessage(t, result.errorCode)
      );
    } catch (error) {
      const code = getNativeHealthErrorCode(error);
      const title =
        code === 'MISSING_NATIVE_MODULE' || code === 'APPLE_HEALTH_UNAVAILABLE'
          ? t('health.appleHealthUnavailableTitle')
          : t('health.syncError');
      const message = code
        ? getAppleHealthUnavailableMessage(t, code)
        : t('health.syncFailedContinue');
      showHealthReadinessContinueAlert(forceRegenerate, title, message);
    }
  }

  function showHealthReadinessContinueAlert(forceRegenerate: boolean, title: string, message: string) {
    Alert.alert(
      title,
      message,
      [
        {
          text: t('health.continueWithoutHealthData'),
          onPress: () => generate.mutate(forceRegenerate)
        },
        {
          text: t('common.retry'),
          onPress: () => void syncAppleHealthThenGenerate(forceRegenerate)
        }
      ]
    );
  }
}

function getTodayDayOfWeek() {
  const jsDay = new Date().getDay();
  return ORDERED_DAYS[(jsDay + 6) % 7];
}

function WearableContextNote({
  contextNotes,
  hasPlan,
  hasSnapshot,
  hasRecentData,
  isUnavailable
}: {
  contextNotes?: DailyPlanJson['contextNotes'];
  hasPlan: boolean;
  hasSnapshot: boolean;
  hasRecentData: boolean;
  isUnavailable: boolean;
}) {
  const { t } = useTranslation();

  if (!hasPlan || isUnavailable) {
    return null;
  }

  const wearableNote = contextNotes?.trainingLoad ?? contextNotes?.wearable;
  const title = wearableNote
    ? getContextNoteTitle(t, wearableNote.titleCode)
    : t('health.wearableSnapshot');
  const message = wearableNote
    ? getContextNoteMessage(t, wearableNote.messageCode)
    : hasSnapshot && hasRecentData
      ? t('health.wearableDataConnected')
      : hasSnapshot
        ? t('health.wearableDataStale')
        : t('health.noRecentWearableData');

  return (
    <ContextNoteCard title={title} message={message} />
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

  return '/(tabs)/today' as const;
}

function formatUsageLimitMessage(error: UsageLimitExceededError, t: TFunction, locale: string) {
  const action = getUsageFeatureLabel(error.feature, t);
  const resetAt = formatResetAt(error.resetAt, locale);
  const reset = resetAt ? String(t('today.tryAfter', { time: resetAt })) : String(t('today.tryAfterReset'));
  return String(t('today.limitMessage', {
    plan: String(getSubscriptionPlanLabel(t, error.currentPlan)),
    limit: String(error.limit),
    action,
    reset
  }));
}

function getUsageFeatureLabel(feature: UsageLimitExceededError['feature'], t: TFunction) {
  if (feature === 'DAILY_PLAN_REFRESH') {
    return String(t('today.usageRefresh'));
  }

  if (feature === 'AI_DAILY_PLAN_GENERATION') {
    return String(t('today.usageAiGeneration'));
  }

  return String(t('today.usageGeneration'));
}

function formatResetAt(value: string, locale: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatTime(date, locale);
}

function getNativeHealthErrorCode(error: unknown) {
  if (error instanceof NativeHealthServiceError) {
    return error.code;
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code?: unknown }).code);
  }

  return null;
}

function getAppleHealthUnavailableMessage(t: TFunction, code?: string | null) {
  if (code === 'MISSING_NATIVE_MODULE') {
    return t('health.appleHealthNativeUnavailable');
  }

  if (code === 'PERMISSION_UNAVAILABLE' || code === 'APPLE_HEALTH_UNAVAILABLE') {
    return t('health.appleHealthUnavailable');
  }

  return t('health.readinessUnavailableContinue');
}

const styles = StyleSheet.create({
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  dashboardCard: {
    flex: 1,
    minWidth: 150
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
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  multiChipActive: {
    borderColor: colors.nutrition,
    backgroundColor: colors.nutritionMuted
  },
  multiChipText: {
    fontSize: 14,
    color: colors.textPrimary
  },
  multiChipTextActive: {
    color: colors.primaryDark,
    fontWeight: '700'
  }
});
