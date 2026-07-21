import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { ApiError } from '@/api/client';
import { generateTodayPlan, getTodayPlan } from '@/api/daily-plans';
import { getFoodLog } from '@/api/food-logs';
import { getGoal } from '@/api/goals';
import { getHealthConnections, getTodayWearableSnapshot } from '@/api/health';
import { evaluatePlanImpact } from '@/api/plan-impact';
import { getTrainingSchedule } from '@/api/training-schedule';
import { getTrainingOverride, saveTrainingOverride } from '@/api/training-overrides';
import { createWeightLog, getWeightSummary } from '@/api/weight';
import { getWorkoutSessionByPlan } from '@/api/workout-sessions';
import {
  answerProgressivePrompt,
  getNextProgressivePrompt,
  skipProgressivePrompt
} from '@/api/progressive-profile';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { AICoachBottomSheet } from '@/components/AICoachBottomSheet';
import { AppFeedbackSheet } from '@/components/AppFeedbackSheet';
import { BottomSheet } from '@/components/BottomSheet';
import { AIRecommendationEntry } from '@/components/AIRecommendationEntry';
import { AppToast } from '@/components/AppToast';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SelectChips } from '@/components/SelectChips';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { BodyMapSelector } from '@/features/body-map/BodyMapSelector';
import { DashboardProgressCard } from '@/features/today-dashboard/DashboardProgressCard';
import { WearableSummaryCard } from '@/features/today-dashboard/WearableSummaryCard';
import { WeightProgressCard } from '@/features/weight/WeightProgressCard';
import { WeightUpdateModal } from '@/features/weight/WeightUpdateModal';
import { EveningReflectionSheet } from '@/features/daily-plan-check-ins/EveningReflectionSheet';
import {
  resolveNutritionProgress,
  resolveTrainingProgress
} from '@/features/today-dashboard/today-progress';
import {
  formatUsageLimitMessage,
  getUsageLimitError
} from '@/features/entitlements/usage-limit-message';
import { PlanImpactPromptCard } from '@/features/plan-impact/PlanImpactPromptCard';
import { useTheme } from '@/theme/theme-provider';
import type { ThemeColors } from '@/theme/colors';
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
import type { ProgressivePrompt, EvaluatePlanImpactResponse } from '@/types/api';

export default function TodayScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { generateAfterRoutine, generateAfterOverride } = useLocalSearchParams<{
    generateAfterRoutine?: string;
    generateAfterOverride?: string;
  }>();
  const preferredLocale = useSettingsStore((state) => state.preferredLocale);
  const measurementSystem = useSettingsStore((state) => state.measurementSystem);
  const queryClient = useQueryClient();
  const setTrainingScheduleDraft = useTrainingScheduleDraftStore((state) => state.setDraft);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [limitSheetVisible, setLimitSheetVisible] = useState(false);
  const [healthReadinessMessage, setHealthReadinessMessage] = useState<string | null>(null);
  const [planImpact, setPlanImpact] = useState<EvaluatePlanImpactResponse | null>(null);
  const [planImpactError, setPlanImpactError] = useState<string | null>(null);
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [coachVisible, setCoachVisible] = useState(false);
  const [eveningReflectionVisible, setEveningReflectionVisible] = useState(false);
  const [progressivePromptVisible, setProgressivePromptVisible] = useState(false);
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
  const weightSummary = useQuery({
    queryKey: ['weight-summary'],
    queryFn: getWeightSummary
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
    onSuccess: async (data) => {
      queryClient.setQueryData(['progressive-profile', 'next-prompt'], data.progressiveProfile.nextPrompt ?? null);
      if (!data.progressiveProfile.nextPrompt) {
        setProgressivePromptVisible(false);
      }
      await queryClient.invalidateQueries({ queryKey: ['progressive-profile', 'next-prompt'] });
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    },
    onError: (error) =>
      Alert.alert(t('today.answerSaveFailed'), `${t('errors.unableSave')}\n\n${t('today.keepUsingToday')}`)
  });
  const skipPrompt = useMutation({
    mutationFn: skipProgressivePrompt,
    onSuccess: async (data) => {
      queryClient.setQueryData(['progressive-profile', 'next-prompt'], data.progressiveProfile.nextPrompt ?? null);
      if (!data.progressiveProfile.nextPrompt) {
        setProgressivePromptVisible(false);
      }
      await queryClient.invalidateQueries({ queryKey: ['progressive-profile', 'next-prompt'] });
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    },
    onError: (error) =>
      Alert.alert(t('today.promptSkipFailed'), `${t('errors.unableSave')}\n\n${t('today.keepUsingToday')}`)
  });
  const saveWeight = useMutation({
    mutationFn: createWeightLog,
    onSuccess: async () => {
      setWeightError(null);
      setWeightModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: ['weight-summary'] });
      await queryClient.invalidateQueries({ queryKey: ['weight-logs'] });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['nutrition-target-preview'] });
      await evaluateCurrentPlanImpact(['PROFILE_WEIGHT_CHANGED']);
    },
    onError: () => setWeightError(t('weight.couldNotSave'))
  });
  const generate = useMutation({
    mutationFn: (forceRegenerate: boolean) => generateTodayPlan(forceRegenerate),
    onSuccess: async (data, forceRegenerate) => {
      queryClient.setQueryData(['today-plan'], data);
      await queryClient.invalidateQueries({ queryKey: ['today-plan'] });
      await queryClient.invalidateQueries({ queryKey: ['usage-summary'] });
      await queryClient.refetchQueries({ queryKey: ['today-plan'], type: 'active' });
      setLimitMessage(null);
      setLimitSheetVisible(false);
      setPlanImpact(null);
      setPlanImpactError(null);
      setRefreshMessage(forceRegenerate ? t('today.refreshed') : t('today.generated'));
    },
    onError: (error) => {
      const usageLimit = getUsageLimitError(error);
      const onboardingError = getOnboardingIncompleteError(error);

      if (usageLimit) {
        const message = formatUsageLimitMessage(usageLimit, t, preferredLocale);
        setLimitMessage(message);
        setLimitSheetVisible(true);
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
      weightSummary.refetch(),
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
    weightSummary.isRefetching ||
    healthConnections.isRefetching ||
    progressivePrompt.isRefetching ||
    trainingSchedule.isRefetching ||
    trainingOverride.isRefetching ||
    workoutSession.isRefetching ||
    foodLog.isRefetching;
  const appMode = goal.data?.appMode ?? goal.data?.impactMode ?? 'NUTRITION_AND_TRAINING';
  const trainingEnabled = appMode === 'NUTRITION_AND_TRAINING';

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
    return <TodaySkeleton trainingEnabled={trainingEnabled} />;
  }

  if (today.isError) {
    return (
      <Screen
        refreshing={refreshing}
        onRefresh={handleRefresh}
        topBackdrop={<TodayModeBackdrop trainingEnabled={trainingEnabled} />}
      >
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
    <Screen
      refreshing={refreshing}
      onRefresh={handleRefresh}
      topBackdrop={<TodayModeBackdrop trainingEnabled={trainingEnabled} />}
    >
      <ScreenHeader
        eyebrow={t('today.title')}
        title={t('today.tagline')}
        subtitle={t('today.intro')}
      />

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
                style={styles.dashboardProgressCard}
              />
            </View>
            <View style={styles.dashboardCard}>
              <DashboardProgressCard
                title={t('todayDashboard.trainingProgress')}
                value={trainingProgress.value}
                centerLabel={trainingProgress.centerLabel}
                subtitle={trainingProgress.subtitle}
                tone="training"
                accessibilityLabel={trainingProgress.accessibilityLabel}
                style={styles.dashboardProgressCard}
              />
            </View>
          </View>
          <AIRecommendationEntry
            title={t('aiCoach.title')}
            summary={plan.summary.message}
            badge={t(`enums.readiness.${today.data.readinessLevel}` as never)}
            onPress={() => setCoachVisible(true)}
          />
          <WearableSummaryCard
            wearable={wearableSnapshot.data}
            connections={healthConnections.data?.connections}
            locale={preferredLocale}
            onOpenHealth={() => router.push('/health-data')}
          />
          <WeightProgressCard
            summary={weightSummary.data}
            locale={preferredLocale}
            measurementSystem={measurementSystem}
            compact
            isLoading={weightSummary.isLoading}
            isError={weightSummary.isError}
            onUpdate={() => setWeightModalVisible(true)}
          />
        </>
      ) : null}

      {healthReadinessMessage ? (
        <AppToast
          title={t('health.updated')}
          message={healthReadinessMessage}
          tone="info"
          onDismiss={() => setHealthReadinessMessage(null)}
        />
      ) : null}

      <PlanImpactPromptCard
        impact={planImpact}
        isUpdating={generate.isPending}
        errorMessage={planImpactError}
        onUpdateToday={() => {
          if (planImpact?.prompt?.requiresAiGeneration) {
            void continueThroughHealthReadiness(true);
            return;
          }

          setPlanImpact(null);
          router.push(
            planImpact?.affectedSections.some((section) =>
              section === 'NUTRITION_TARGET' || section === 'FOOD_PLAN'
            )
              ? '/(tabs)/food'
              : '/(tabs)/training'
          );
        }}
        onFutureOnly={() => {
          setPlanImpact(null);
          setPlanImpactError(null);
          setRefreshMessage(t('planImpact.futureOnlySaved'));
        }}
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
          {progressivePrompt.data ? (
            <ProgressivePromptTrigger
              title={t('today.improvePlans')}
              prompt={progressivePrompt.data}
              onPress={() => setProgressivePromptVisible(true)}
            />
          ) : null}
          <Button
            title={generate.isPending ? t('today.refreshing') : t('today.refresh')}
            variant="secondary"
            disabled={generate.isPending}
            onPress={() => handleGeneratePlan(true)}
          />
          {trainingEnabled ? (
            <Button
              title={t('trainingOverrides.restTodayOnly')}
              variant="ghost"
              disabled={generate.isPending}
              onPress={handleRestTodayOnly}
            />
          ) : null}
          <Button
            title={t('eveningReflection.open')}
            variant="ghost"
            disabled={generate.isPending}
            onPress={() => setEveningReflectionVisible(true)}
          />
        </>
      )}
      <WeightUpdateModal
        visible={weightModalVisible}
        currentWeightKg={weightSummary.data?.currentWeightKg ?? null}
        measurementSystem={measurementSystem}
        isSaving={saveWeight.isPending}
        error={weightError}
        onClose={() => {
          setWeightError(null);
          setWeightModalVisible(false);
        }}
        onSave={(value) => saveWeight.mutate(value)}
      />
      <AICoachBottomSheet
        visible={coachVisible}
        plan={plan}
        onClose={() => setCoachVisible(false)}
      />
      <EveningReflectionSheet
        visible={eveningReflectionVisible}
        dailyPlanId={today.data?.id ?? null}
        onClose={() => setEveningReflectionVisible(false)}
        onSaved={() => {
          setEveningReflectionVisible(false);
          setRefreshMessage(t('eveningReflection.saved'));
        }}
      />
      <BottomSheet
        visible={progressivePromptVisible}
        title={t('today.improvePlans')}
        presentation="form"
        onClose={() => setProgressivePromptVisible(false)}
      >
        {progressivePrompt.data ? (
          <ProgressivePromptCard
            prompt={progressivePrompt.data}
            isSaving={answerPrompt.isPending || skipPrompt.isPending}
            onAnswer={(value) => {
              answerPrompt.mutate({ key: progressivePrompt.data!.key, value });
            }}
            onSkip={() => {
              skipPrompt.mutate(progressivePrompt.data!.key);
            }}
            embedded
          />
        ) : null}
      </BottomSheet>
      <AppFeedbackSheet
        visible={limitSheetVisible && Boolean(limitMessage)}
        title={t('today.limitReached')}
        message={`${limitMessage ?? ''} ${t('today.upgradeSoon')}`.trim()}
        tone="warning"
        onClose={() => setLimitSheetVisible(false)}
        actions={[
          {
            label: t('common.close'),
            variant: 'secondary',
            onPress: () => setLimitSheetVisible(false)
          }
        ]}
      />
      {refreshMessage ? (
        <AppToast
          title={refreshMessage}
          tone="success"
          onDismiss={() => setRefreshMessage(null)}
        />
      ) : null}
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
        Alert.alert(
          t('today.trainingTodayPromptTitle'),
          t('today.trainingPlannedPromptMessage'),
          [
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
              text: t('trainingOverrides.restTodayOnly'),
              onPress: () => void generateRestDayPlan()
            },
            { text: t('common.cancel'), style: 'cancel' }
          ]
        );
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

  async function evaluateCurrentPlanImpact(
    changeTypes: Parameters<typeof evaluatePlanImpact>[0]['changeTypes'],
    newValues?: Record<string, unknown>
  ) {
    try {
      const impact = await evaluatePlanImpact({ changeTypes, newValues });
      setPlanImpactError(null);
      setPlanImpact(impact.prompt ? impact : null);
    } catch {
      setPlanImpact(null);
      setPlanImpactError(t('planImpact.unavailable'));
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

  async function generateRestDayPlan() {
    try {
      const saved = await saveTrainingOverride(todayLocalDate, {
        overrideType: 'REST_DAY',
        source: 'USER_SELECTED_REST_TODAY'
      });
      queryClient.setQueryData(['training-override', todayLocalDate], saved);
      await queryClient.invalidateQueries({ queryKey: ['training-override', todayLocalDate] });
      await continueThroughHealthReadiness(false);
    } catch {
      Alert.alert(t('trainingOverrides.saveFailed'), t('errors.unableSave'));
    }
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

function TodayModeBackdrop({ trainingEnabled }: { trainingEnabled: boolean }) {
  const { colors, mode } = useTheme();
  const palette = trainingEnabled
    ? mode === 'dark'
      ? ['#9B3A16', '#47190B', colors.background]
      : ['#FF9D73', '#FFD4C2', colors.background]
    : mode === 'dark'
      ? ['#175C35', '#0B2D1B', colors.background]
      : ['#A9E7BC', '#DDF5E5', colors.background];

  return (
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <SvgLinearGradient id="today-mode-backdrop" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={palette[0]} />
          <Stop offset="48%" stopColor={palette[1]} />
          <Stop offset="100%" stopColor={palette[2]} />
        </SvgLinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#today-mode-backdrop)" />
    </Svg>
  );
}

function TodaySkeleton({ trainingEnabled }: { trainingEnabled: boolean }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <Screen topBackdrop={<TodayModeBackdrop trainingEnabled={trainingEnabled} />}>
      <View style={styles.todaySkeletonHeader}>
        <View style={[styles.skeletonLine, styles.todaySkeletonEyebrow]} />
        <View style={[styles.skeletonLine, styles.todaySkeletonTitle]} />
        <View style={[styles.skeletonLine, styles.todaySkeletonTitleShort]} />
        <View style={[styles.skeletonLine, styles.todaySkeletonSubtitle]} />
      </View>

      <View style={styles.dashboardGrid}>
        {[0, 1].map((item) => (
          <Card key={item} style={styles.todaySkeletonProgressCard}>
            <View style={styles.todaySkeletonRing} />
            <View style={[styles.skeletonLine, styles.todaySkeletonProgressTitle]} />
            <View style={[styles.skeletonLine, styles.todaySkeletonProgressText]} />
            <View style={[styles.skeletonLine, styles.todaySkeletonProgressHint]} />
          </Card>
        ))}
      </View>

      <Card>
        <View style={[styles.skeletonLine, styles.todaySkeletonSectionTitle]} />
        <View style={styles.todaySkeletonMetricGrid}>
          {[0, 1, 2, 3].map((item) => (
            <View key={item} style={styles.todaySkeletonMetric}>
              <View style={[styles.skeletonLine, styles.todaySkeletonMetricLabel]} />
              <View style={[styles.skeletonLine, styles.todaySkeletonMetricValue]} />
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

function ProgressivePromptCard({
  prompt,
  isSaving,
  onAnswer,
  onSkip,
  embedded = false
}: {
  prompt: ProgressivePrompt;
  isSaving: boolean;
  onAnswer: (value: string | string[] | number | boolean) => void;
  onSkip: () => void;
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
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

  const content = (
    <>
      <View style={styles.promptHeader}>
        {!embedded ? <Text variant="label">{t('today.improvePlans')}</Text> : null}
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
    </>
  );

  return embedded ? <View style={styles.embeddedPrompt}>{content}</View> : <Card>{content}</Card>;
}

function ProgressivePromptTrigger({
  title,
  prompt,
  onPress
}: {
  title: string;
  prompt: ProgressivePrompt;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const promptCopy = getProgressivePromptCopy(t, prompt);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${promptCopy.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.promptTrigger, pressed ? styles.promptTriggerPressed : null]}
    >
      <View style={styles.promptTriggerText}>
        <Text variant="label">{title}</Text>
        <Text variant="body">{promptCopy.title}</Text>
      </View>
      <Text style={styles.promptTriggerAction}>{t('today.answer')}</Text>
    </Pressable>
  );
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  dashboardGrid: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  dashboardCard: {
    flex: 1,
    minWidth: 150
  },
  dashboardProgressCard: {
    minHeight: 284
  },
  promptTrigger: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2
  },
  promptTriggerPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }]
  },
  promptTriggerText: {
    flex: 1,
    gap: 3
  },
  promptTriggerAction: {
    color: colors.health,
    fontSize: 14,
    fontWeight: '600'
  },
  embeddedPrompt: {
    gap: 14
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
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted
  },
  multiChipText: {
    fontSize: 14,
    color: colors.textPrimary
  },
  multiChipTextActive: {
    color: colors.accent,
    fontWeight: '700'
  },
  todaySkeletonHeader: {
    gap: 12,
    paddingTop: 8
  },
  skeletonLine: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999
  },
  todaySkeletonEyebrow: {
    height: 16,
    width: 72
  },
  todaySkeletonTitle: {
    height: 38,
    width: '84%'
  },
  todaySkeletonTitleShort: {
    height: 38,
    width: '54%'
  },
  todaySkeletonSubtitle: {
    height: 16,
    width: '90%'
  },
  todaySkeletonProgressCard: {
    alignItems: 'center',
    flex: 1,
    minHeight: 260,
    minWidth: 150
  },
  todaySkeletonRing: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 62,
    height: 124,
    width: 124
  },
  todaySkeletonProgressTitle: {
    height: 18,
    width: '78%'
  },
  todaySkeletonProgressText: {
    height: 18,
    width: '62%'
  },
  todaySkeletonProgressHint: {
    height: 14,
    width: '48%'
  },
  todaySkeletonSectionTitle: {
    height: 18,
    width: '46%'
  },
  todaySkeletonMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  todaySkeletonMetric: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 10,
    minWidth: 130,
    padding: 16
  },
  todaySkeletonMetricLabel: {
    height: 12,
    width: '58%'
  },
  todaySkeletonMetricValue: {
    height: 28,
    width: '74%'
  }
});
