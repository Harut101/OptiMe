import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { goalSchema, profileSchema } from '@optime/shared-schemas';
import { useTranslation } from 'react-i18next';
import type { MeasurementSystem, PlanImpactChangeType, SupportedLocale } from '@optime/shared-types';
import {
  CalendarDays,
  Crown,
  Dumbbell,
  History,
  Languages,
  LifeBuoy,
  LogOut,
  Ruler,
  Scale,
  Settings,
  Target,
  UserRound,
  Utensils,
  Watch
} from 'lucide-react-native';

import { getEntitlements } from '@/api/account';
import { generateTodayPlan, getTodayPlan, recreateTodayPlanForCurrentLanguage } from '@/api/daily-plans';
import { getGoal, saveGoal } from '@/api/goals';
import { getHealthStatus } from '@/api/health';
import { evaluatePlanImpact } from '@/api/plan-impact';
import { getProfile, saveProfile } from '@/api/profile';
import { getSettings, updateSettings } from '@/api/settings';
import { getTrainingPreferences, saveTrainingPreferences } from '@/api/training-preferences';
import { createWeightLog, getWeightSummary } from '@/api/weight';
import { Button } from '@/components/Button';
import { BottomSheet } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { AppFeedbackSheet } from '@/components/AppFeedbackSheet';
import { AppToast } from '@/components/AppToast';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { SelectChips } from '@/components/SelectChips';
import { SettingsListItem } from '@/components/SettingsListItem';
import { CardSkeleton } from '@/components/ScreenSkeleton';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import {
  getPlatformHealthProvider
} from '@/features/health/health-platform';
import { PlanImpactPromptCard } from '@/features/plan-impact/PlanImpactPromptCard';
import {
  formatUsageLimitMessage,
  getUsageLimitError
} from '@/features/entitlements/usage-limit-message';
import { WeightUpdateModal } from '@/features/weight/WeightUpdateModal';
import {
  EMPTY_PERSONAL_PROFILE,
  fromProfileResponse,
  PersonalProfileForm,
  PersonalProfileFormValue,
  toProfileRequest
} from '@/features/profile/PersonalProfileForm';
import { isDraftDirty } from '@/features/editor/draft-state';
import {
  EMPTY_GOALS_FORM,
  fromGoalResponse,
  getPrimaryGoalDisplayLabel,
  GoalsForm,
  GoalsFormValue,
  toGoalRequest
} from '@/features/goals/GoalsForm';
import { getFriendlyGoalErrorMessage } from '@/features/safety/safety-copy';
import {
  EMPTY_TRAINING_SETUP,
  fromTrainingPreference,
  toTrainingPreferenceRequest,
  TrainingSetupForm,
  type TrainingSetupFormValue
} from '@/features/training-preferences/TrainingSetupForm';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useAuthStore } from '@/store/auth-store';
import { colors } from '@/theme/colors';
import { formatDate, formatHeight, formatWeight } from '@/i18n/formatters';
import {
  getActivityLevelLabel,
  getGoalImpactLabel,
  getHealthProviderLabel,
  getMeasurementSystemLabel,
  getPlanQualityModeLabel,
  getSubscriptionPlanLabel
} from '@/i18n/enum-labels';
import { LANGUAGE_OPTIONS } from '@/i18n/language-options';
import { useSettingsStore } from '@/store/settings-store';
import type { EvaluatePlanImpactResponse } from '@/types/api';

export default function ProfileScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader title={t('profile.title')} subtitle={t('profile.hubIntro')} />
      <PersonalSection />
      <GoalNutritionSection />
      <TrainingHubSection />
      <ConnectionsSection />
      <SettingsSection />
      <LogoutSection />
    </Screen>
  );
}

function PersonalSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<PersonalProfileFormValue>(EMPTY_PERSONAL_PROFILE);
  const [savedValue, setSavedValue] = useState<PersonalProfileFormValue>(EMPTY_PERSONAL_PROFILE);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorSheetVisible, setErrorSheetVisible] = useState(false);
  const [planImpact, setPlanImpact] = useState<EvaluatePlanImpactResponse | null>(null);
  const [planImpactError, setPlanImpactError] = useState<string | null>(null);
  const preferredLocale = useSettingsStore((state) => state.preferredLocale);
  const measurementSystem = useSettingsStore((state) => state.measurementSystem);

  useEffect(() => {
    if (profile.data) {
      const next = fromProfileResponse(profile.data);
      setValue(next);
      setSavedValue(next);
    }
  }, [profile.data]);

  const dirty = isDraftDirty(value, savedValue);
  useUnsavedChangesGuard(editing && dirty);

  const mutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: (data) => {
      const next = fromProfileResponse(data);
      setUser(data.user);
      setValue(next);
      setSavedValue(next);
      setEditing(false);
      setToastMessage(t('profile.savedMessage'));
      queryClient.setQueryData(['profile'], data);
      const impactTypes = buildProfileImpactTypes(value, savedValue);
      if (impactTypes.length > 0) void evaluateProfilePlanImpact(impactTypes);
    },
    onError: () => setErrorSheetVisible(true)
  });
  const regenerateTodayPlan = useMutation({
    mutationFn: () => generateTodayPlan(true),
    onSuccess: async (data) => {
      queryClient.setQueryData(['today-plan'], data);
      setPlanImpact(null);
      setPlanImpactError(null);
      setToastMessage(t('today.refreshed'));
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

  if (profile.isLoading) return <View style={styles.section}><CardSkeleton variant="detail" /></View>;
  if (profile.isError) return <StateBlock title={t('profile.unavailable')} message={t('errors.unableLoad')} actionTitle={t('common.retry')} onAction={() => profile.refetch()} />;

  const save = () => {
    const result = profileSchema.safeParse(toProfileRequest(value));
    if (!result.success) {
      setToastMessage(t('errors.validation'));
      return;
    }
    mutation.mutate(result.data);
  };

  return (
    <View style={styles.section}>
      <Card variant="elevated" style={styles.personalAccountCard}>
        <View style={styles.accountHeader}>
          <View style={styles.avatar}>
            <UserRound size={24} color={colors.health} />
          </View>
          <View style={styles.accountCopy}>
            <Text variant="caption" style={styles.eyebrow}>{t('profile.account')}</Text>
            <Text variant="heading" style={styles.accountName}>
              {[savedValue.firstName, savedValue.lastName].filter(Boolean).join(' ') || t('profile.nameMissing')}
            </Text>
            <Text variant="muted">{profile.data?.user.email ?? t('settings.signedIn')}</Text>
          </View>
        </View>
        <View style={styles.accountDivider} />
        <SettingsListItem
          icon={<Ruler size={18} color={colors.training} />}
          tone="settings"
          title={t('profile.bornSummary', {
            date: savedValue.dateOfBirth ? formatDate(savedValue.dateOfBirth, preferredLocale) : t('common.notSet'),
            height: formatHeight(Number(savedValue.heightCm), preferredLocale, measurementSystem),
            weight: formatWeight(Number(savedValue.weightKg), preferredLocale, measurementSystem)
          })}
          subtitle={t('profile.activitySummary', { value: getActivityLevelLabel(t, savedValue.activityLevel) })}
        />
        <SettingsListItem
          tone="profile"
          title={t('profile.editProfile')}
          onPress={() => { setToastMessage(null); setEditing(true); }}
        />
      </Card>
      <BottomSheet
        visible={editing}
        title={t('profile.editProfile')}
        subtitle={t('profile.hubIntro')}
        onClose={() => {
          if (mutation.isPending) return;
          setValue(savedValue);
          setEditing(false);
          setToastMessage(null);
        }}
      >
        <PersonalProfileForm value={value} onChange={setValue} />
        {mutation.isError ? <Text style={styles.error}>{mutation.error.message}</Text> : null}
        <View style={styles.actions}>
          <Button title={mutation.isPending ? t('common.saving') : t('common.save')} disabled={mutation.isPending || !dirty} onPress={save} />
          <Button title={t('common.cancel')} variant="secondary" disabled={mutation.isPending} onPress={() => { setValue(savedValue); setEditing(false); setToastMessage(null); }} />
        </View>
      </BottomSheet>
      <PlanImpactPromptCard
        impact={planImpact}
        isUpdating={regenerateTodayPlan.isPending}
        errorMessage={planImpactError}
        onUpdateToday={() => regenerateTodayPlan.mutate()}
        onFutureOnly={() => {
          setPlanImpact(null);
          setPlanImpactError(null);
          setToastMessage(t('planImpact.futureOnlySaved'));
        }}
      />
      {toastMessage ? <AppToast title={t('feedback.savedSuccessfully')} message={toastMessage} tone="success" onDismiss={() => setToastMessage(null)} /> : null}
      <AppFeedbackSheet
        visible={errorSheetVisible}
        title={t('profile.saveFailed')}
        message={t('errors.unableSave')}
        tone="warning"
        onClose={() => setErrorSheetVisible(false)}
        actions={[{ label: t('common.close'), onPress: () => setErrorSheetVisible(false), variant: 'secondary' }]}
      />
    </View>
  );

  async function evaluateProfilePlanImpact(changeTypes: PlanImpactChangeType[]) {
    try {
      const impact = await evaluatePlanImpact({ changeTypes });
      setPlanImpactError(null);
      setPlanImpact(impact.prompt ? impact : null);
    } catch {
      setPlanImpact(null);
    }
  }
}

function buildProfileImpactTypes(
  next: PersonalProfileFormValue,
  previous: PersonalProfileFormValue
): PlanImpactChangeType[] {
  const changeTypes = new Set<PlanImpactChangeType>();

  if (next.weightKg !== previous.weightKg) changeTypes.add('PROFILE_WEIGHT_CHANGED');
  if (next.heightCm !== previous.heightCm) changeTypes.add('PROFILE_HEIGHT_CHANGED');
  if (next.activityLevel !== previous.activityLevel) changeTypes.add('ACTIVITY_LEVEL_CHANGED');

  return [...changeTypes];
}

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

function GoalNutritionSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const preferredLocale = useSettingsStore((state) => state.preferredLocale);
  const measurementSystem = useSettingsStore((state) => state.measurementSystem);
  const goal = useQuery({ queryKey: ['goal'], queryFn: getGoal });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<GoalsFormValue>(EMPTY_GOALS_FORM);
  const [savedValue, setSavedValue] = useState<GoalsFormValue>(EMPTY_GOALS_FORM);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [planImpact, setPlanImpact] = useState<EvaluatePlanImpactResponse | null>(null);
  const [planImpactError, setPlanImpactError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    message: string;
    payload: Parameters<typeof saveGoal>[0];
  } | null>(null);
  const pendingChangeTypes = useRef<PlanImpactChangeType[]>(['PRIMARY_GOAL_CHANGED']);

  useEffect(() => {
    if (goal.data) {
      const next = fromGoalResponse(goal.data);
      setValue(next);
      setSavedValue(next);
    }
  }, [goal.data]);

  const dirty = goal.data === null ? editing : isDraftDirty(value, savedValue);
  useUnsavedChangesGuard(editing && dirty);

  const mutation = useMutation({
    mutationFn: saveGoal,
    onSuccess: async (savedGoal) => {
      const next = fromGoalResponse(savedGoal);
      queryClient.setQueryData(['goal'], savedGoal);
      setValue(next);
      setSavedValue(next);
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

  const openEditor = () => {
    setSuccessMessage(null);
    setValidationError(null);
    setEditing(true);
  };

  const closeEditor = () => {
    if (mutation.isPending) return;
    setValue(savedValue);
    setValidationError(null);
    setEditing(false);
  };

  const save = () => {
    const result = goalSchema.safeParse(toGoalRequest(value));
    if (!result.success) {
      setValidationError(t('goals.checkGoal'));
      return;
    }
    setValidationError(null);
    const modeChanged = value.impactMode !== savedValue.impactMode;
    const goalChanged = value.primaryGoal !== savedValue.primaryGoal;
    pendingChangeTypes.current = [
      ...(goalChanged ? ['PRIMARY_GOAL_CHANGED' as const] : []),
      ...(modeChanged ? ['APP_MODE_CHANGED' as const] : [])
    ];
    if (pendingChangeTypes.current.length === 0) {
      pendingChangeTypes.current = ['PRIMARY_GOAL_CHANGED'];
    }

    if (modeChanged || goalChanged) {
      setPendingConfirmation({
        message: getGoalChangeConfirmationCopy(value.impactMode, savedValue.impactMode, goalChanged, t),
        payload: result.data
      });
      setEditing(false);
      return;
    }

    mutation.mutate(result.data);
  };

  return (
    <View style={styles.section}>
      <Card>
        <SectionHeader title={t('profile.healthGoalSection')} subtitle={t('profile.healthGoalHelp')} />
        <SettingsListItem
          icon={<Target size={18} color={colors.accent} />}
          tone="goal"
          title={t('profile.goalsAndMode')}
          subtitle={goal.data
            ? t('profile.goalModeValue', {
              goal: getPrimaryGoalDisplayLabel(goal.data.primaryGoal, goal.data.goalType, t),
              mode: getGoalImpactLabel(t, goal.data.appMode ?? goal.data.impactMode ?? 'NUTRITION_AND_TRAINING')
            })
            : goal.isLoading ? t('common.loading') : t('profile.goalHelp')}
          onPress={openEditor}
        />
        <SettingsListItem
          icon={<Utensils size={18} color={colors.nutrition} />}
          tone="nutrition"
          title={t('food.title')}
          subtitle={t('profile.nutritionPreferencesSummary')}
          onPress={() => router.push('/(tabs)/food')}
        />
      </Card>
      <BottomSheet
        visible={editing}
        title={t('profile.goalsAndMode')}
        subtitle={t('goals.intro')}
        onClose={closeEditor}
      >
        <GoalsForm value={value} onChange={setValue} validationMode="standalone" />
        {value.primaryGoal === 'WEIGHT_LOSS' && goal.data?.targetWeightKg ? (
          <Text variant="muted">
            {t('goals.targetSummary', {
              weight: formatWeight(goal.data.targetWeightKg, preferredLocale, measurementSystem),
              days: String(goal.data.targetTimelineDays ?? t('common.notSet'))
            })}
          </Text>
        ) : null}
        {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
        {mutation.isError ? <Text style={styles.error}>{getFriendlyGoalErrorMessage(mutation.error, t)}</Text> : null}
        <View style={styles.actions}>
          <Button title={mutation.isPending ? t('common.saving') : t('common.save')} disabled={mutation.isPending || !dirty} onPress={save} />
          <Button title={t('common.cancel')} variant="secondary" disabled={mutation.isPending} onPress={closeEditor} />
        </View>
      </BottomSheet>
      <AppFeedbackSheet
        visible={Boolean(pendingConfirmation)}
        title={t('goals.confirmTitle')}
        message={pendingConfirmation?.message ?? ''}
        tone="warning"
        onClose={() => {
          setPendingConfirmation(null);
          setEditing(true);
        }}
        actions={[
          {
            label: t('common.save'),
            disabled: mutation.isPending,
            onPress: () => {
              if (!pendingConfirmation) return;
              mutation.mutate(pendingConfirmation.payload);
              setPendingConfirmation(null);
            }
          },
          {
            label: t('common.cancel'),
            variant: 'secondary',
            disabled: mutation.isPending,
            onPress: () => {
              setPendingConfirmation(null);
              setEditing(true);
            }
          }
        ]}
      />
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
      {successMessage ? <AppToast title={t('feedback.savedSuccessfully')} message={successMessage} tone="success" onDismiss={() => setSuccessMessage(null)} /> : null}
      <WeightSection />
    </View>
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

function TrainingHubSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const preferences = useQuery({ queryKey: ['training-preferences'], queryFn: getTrainingPreferences });
  const [editing, setEditing] = useState(false);
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
  useUnsavedChangesGuard(editing && dirty);

  const save = useMutation({
    mutationFn: saveTrainingPreferences,
    onSuccess: async (saved) => {
      const next = fromTrainingPreference(saved);
      const changeTypes = buildTrainingPreferenceImpactTypes(value, savedValue);
      setValue(next);
      setSavedValue(next);
      queryClient.setQueryData(['training-preferences'], saved);
      setToastMessage(t('training.savedMessage'));
      try {
        const impact = await evaluatePlanImpact({ changeTypes });
        setPlanImpact(impact.prompt ? impact : null);
        setPlanImpactError(null);
      } catch {
        setPlanImpact(null);
      }
    }
  });
  const regenerateTodayPlan = useMutation({
    mutationFn: () => generateTodayPlan(true),
    onSuccess: (plan) => {
      queryClient.setQueryData(['today-plan'], plan);
      setPlanImpact(null);
      setPlanImpactError(null);
      setToastMessage(t('today.refreshed'));
    },
    onError: () => setPlanImpactError(t('today.updateFailed'))
  });

  const openEditor = () => {
    setToastMessage(null);
    setEditing(true);
  };
  const closeEditor = () => {
    if (save.isPending) return;
    setValue(savedValue);
    setEditing(false);
  };

  return (
    <View style={styles.section}>
      <Card>
        <SectionHeader title={t('tabs.training')} subtitle={t('profile.trainingHubHelp')} />
        <SettingsListItem
          icon={<Dumbbell size={18} color={colors.training} />}
          tone="training"
          title={t('training.current')}
          subtitle={t('training.setupSummaryHelp')}
          onPress={openEditor}
        />
        <SettingsListItem
          icon={<CalendarDays size={18} color={colors.training} />}
          tone="training"
          title={t('schedule.weeklySchedule')}
          subtitle={t('schedule.weeklyScheduleHelp')}
          onPress={() => router.push('/weekly-routine' as never)}
        />
        <SettingsListItem
          icon={<History size={18} color={colors.training} />}
          tone="training"
          title={t('workout.workoutHistory')}
          subtitle={t('workout.historyHelp')}
          onPress={() => router.push('/workout-history')}
        />
        <SettingsListItem
          icon={<CalendarDays size={18} color={colors.recovery} />}
          tone="training"
          title={t('weeklySummary.title')}
          subtitle={t('weeklySummary.subtitle')}
          onPress={() => router.push('/weekly-summary' as never)}
        />
      </Card>
      <BottomSheet
        visible={editing}
        title={t('training.current')}
        subtitle={t('training.setupSummaryHelp')}
        onClose={closeEditor}
      >
        {preferences.isLoading ? <Text variant="muted">{t('common.loading')}</Text> : null}
        {preferences.isError ? <Text style={styles.error}>{t('errors.unableLoad')}</Text> : null}
        {!preferences.isLoading && !preferences.isError ? (
          <>
            <TrainingSetupForm value={value} onChange={setValue} />
            {save.isError ? <Text style={styles.error}>{t('errors.unableSave')}</Text> : null}
            <View style={styles.actions}>
              <Button
                title={save.isPending ? t('common.saving') : t('common.save')}
                disabled={save.isPending || !dirty}
                onPress={() => save.mutate(toTrainingPreferenceRequest(value))}
              />
              <Button title={t('common.cancel')} variant="secondary" disabled={save.isPending} onPress={closeEditor} />
            </View>
            <PlanImpactPromptCard
              impact={planImpact}
              isUpdating={regenerateTodayPlan.isPending}
              errorMessage={planImpactError}
              onUpdateToday={() => regenerateTodayPlan.mutate()}
              onFutureOnly={() => {
                setPlanImpact(null);
                setPlanImpactError(null);
                setToastMessage(t('planImpact.futureOnlySaved'));
              }}
            />
          </>
        ) : null}
      </BottomSheet>
      {toastMessage ? <AppToast title={t('feedback.savedSuccessfully')} message={toastMessage} tone="success" onDismiss={() => setToastMessage(null)} /> : null}
    </View>
  );
}

function buildTrainingPreferenceImpactTypes(
  next: TrainingSetupFormValue,
  previous: TrainingSetupFormValue
): PlanImpactChangeType[] {
  const changed = new Set<PlanImpactChangeType>();
  if (JSON.stringify([...next.targetMuscleGroups].sort()) !== JSON.stringify([...previous.targetMuscleGroups].sort())) changed.add('TRAINING_MUSCLES_CHANGED');
  if (JSON.stringify([...next.equipment].sort()) !== JSON.stringify([...previous.equipment].sort())) changed.add('TRAINING_EQUIPMENT_CHANGED');
  if (next.trainingLevel !== previous.trainingLevel || next.trainingOutcome !== previous.trainingOutcome) changed.add('TRAINING_ROUTINE_CHANGED');
  return changed.size ? [...changed] : ['TRAINING_ROUTINE_CHANGED'];
}

function WeightSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const preferredLocale = useSettingsStore((state) => state.preferredLocale);
  const measurementSystem = useSettingsStore((state) => state.measurementSystem);
  const summary = useQuery({ queryKey: ['weight-summary'], queryFn: getWeightSummary });
  const [modalVisible, setModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [planImpact, setPlanImpact] = useState<EvaluatePlanImpactResponse | null>(null);
  const [planImpactError, setPlanImpactError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: createWeightLog,
    onSuccess: async () => {
      setError(null);
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: ['weight-summary'] });
      await queryClient.invalidateQueries({ queryKey: ['weight-logs'] });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['nutrition-target-preview'] });
      setToastMessage(t('weight.updatedMessage'));
      await evaluateWeightPlanImpact();
    },
    onError: () => setError(t('weight.couldNotSave'))
  });
  const regenerateTodayPlan = useMutation({
    mutationFn: () => generateTodayPlan(true),
    onSuccess: async (data) => {
      queryClient.setQueryData(['today-plan'], data);
      setPlanImpact(null);
      setPlanImpactError(null);
      setToastMessage(t('today.refreshed'));
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
  const currentWeight = summary.data?.currentWeightKg !== null && summary.data?.currentWeightKg !== undefined
    ? formatWeight(summary.data.currentWeightKg, preferredLocale, measurementSystem)
    : t('weight.noCurrentWeight');
  const targetWeight = summary.data?.targetWeightKg !== null && summary.data?.targetWeightKg !== undefined
    ? formatWeight(summary.data.targetWeightKg, preferredLocale, measurementSystem)
    : t('weight.noTargetWeight');
  const lastUpdated = summary.data?.lastUpdatedAt
    ? t('weight.lastUpdatedValue', { value: formatDate(summary.data.lastUpdatedAt, preferredLocale) })
    : t('weight.noWeightEntries');

  return (
    <>
      <Card>
        <SectionHeader title={t('weight.progressTitle')} subtitle={t('profile.weightHubHelp')} />
        <SettingsListItem
          icon={<Scale size={18} color={colors.success} />}
          tone="weight"
          title={summary.isLoading ? t('common.loading') : currentWeight}
          subtitle={`${targetWeight} · ${lastUpdated}`}
          statusLabel={summary.data?.safetyStatus === 'LIMITED' ? t('weight.safetyLimited') : undefined}
          statusTone="warning"
          onPress={() => setModalVisible(true)}
        />
        {summary.isError ? <Text style={styles.error}>{t('weight.unavailable')}</Text> : null}
        <Button title={t('weight.updateWeight')} variant="secondary" onPress={() => setModalVisible(true)} />
      </Card>
      <PlanImpactPromptCard
        impact={planImpact}
        errorMessage={planImpactError}
        isUpdating={regenerateTodayPlan.isPending}
        onUpdateToday={() => regenerateTodayPlan.mutate()}
        onFutureOnly={() => {
          setPlanImpact(null);
          setPlanImpactError(null);
        }}
      />
      {toastMessage ? <AppToast title={t('feedback.savedSuccessfully')} message={toastMessage} tone="success" onDismiss={() => setToastMessage(null)} /> : null}
      <WeightUpdateModal
        visible={modalVisible}
        currentWeightKg={summary.data?.currentWeightKg ?? null}
        measurementSystem={measurementSystem}
        isSaving={mutation.isPending}
        error={error}
        onClose={() => {
          setError(null);
          setModalVisible(false);
        }}
        onSave={(value) => mutation.mutate(value)}
      />
    </>
  );

  async function evaluateWeightPlanImpact() {
    try {
      const impact = await evaluatePlanImpact({ changeTypes: ['PROFILE_WEIGHT_CHANGED'] });
      setPlanImpactError(null);
      setPlanImpact(impact.prompt ? impact : null);
    } catch {
      setPlanImpact(null);
    }
  }
}

function ConnectionsSection() {
  const { t } = useTranslation();
  const preferredLocale = useSettingsStore((state) => state.preferredLocale);
  const status = useQuery({ queryKey: ['health-status'], queryFn: getHealthStatus });
  const provider = getPlatformHealthProvider();
  const label = provider ? getHealthProviderLabel(t, provider) : t('health.title');
  const connection = status.data?.connections.find((item) => item.provider === provider);
  const statusLabel = status.isLoading
    ? t('common.loading')
    : status.isError
      ? t('health.unavailable')
      : formatHealthStatus(connection?.status, t);
  const lastSyncLabel = t('health.lastSync', {
    value: connection?.lastSyncAt
      ? new Date(connection.lastSyncAt).toLocaleString(preferredLocale)
      : t('health.notSynced')
  });

  return (
    <View style={styles.section}>
      <Card>
        <SectionHeader title={t('profile.sections.connections')} />
        <SettingsListItem
          icon={<Watch size={18} color={colors.health} />}
          title={label}
          subtitle={`${statusLabel} · ${lastSyncLabel}`}
          onPress={() => router.push('/health-data')}
        />
      </Card>
    </View>
  );
}

function SettingsSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const applySettings = useSettingsStore((state) => state.applySettings);
  const currentLocale = useSettingsStore((state) => state.preferredLocale);
  const currentMeasurementSystem = useSettingsStore((state) => state.measurementSystem);
  const entitlements = useQuery({ queryKey: ['entitlements'], queryFn: getEntitlements });
  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const todayPlan = useQuery({ queryKey: ['today-plan'], queryFn: getTodayPlan });
  const [preferredLocale, setPreferredLocale] = useState<SupportedLocale>(currentLocale);
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>(currentMeasurementSystem);
  const [settingsSheetVisible, setSettingsSheetVisible] = useState(false);
  const [savedMessage, setSavedMessage] = useState<'settings' | 'language' | 'languageRecreated' | null>(null);
  const [errorSheetVisible, setErrorSheetVisible] = useState(false);
  const [languageRecreateVisible, setLanguageRecreateVisible] = useState(false);
  const [languageRecreateErrorVisible, setLanguageRecreateErrorVisible] = useState(false);

  useEffect(() => {
    if (!settings.data) return;
    setPreferredLocale(settings.data.preferredLocale);
    setMeasurementSystem(settings.data.measurementSystem);
  }, [settings.data]);

  const dirty = preferredLocale !== currentLocale || measurementSystem !== currentMeasurementSystem;
  useUnsavedChangesGuard(dirty);
  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (saved, request) => {
      const languageChanged = Boolean(
        request.preferredLocale && request.preferredLocale !== currentLocale
      );
      applySettings(saved.preferredLocale, saved.measurementSystem, true);
      queryClient.setQueryData(['settings'], saved);
      setSettingsSheetVisible(false);
      const shouldOfferLanguageRecreate =
        languageChanged &&
          Boolean(todayPlan.data) &&
          todayPlan.data?.plan.contentLocale !== saved.preferredLocale;
      setLanguageRecreateVisible(shouldOfferLanguageRecreate);
      setSavedMessage(languageChanged && shouldOfferLanguageRecreate ? null : languageChanged ? 'language' : 'settings');
    },
    onError: () => setErrorSheetVisible(true)
  });
  const recreateLanguagePlan = useMutation({
    mutationFn: recreateTodayPlanForCurrentLanguage,
    onSuccess: (plan) => {
      queryClient.setQueryData(['today-plan'], plan);
      setLanguageRecreateVisible(false);
      setSavedMessage('languageRecreated');
    },
    onError: () => setLanguageRecreateErrorVisible(true)
  });

  const closeSettingsSheet = () => {
    if (mutation.isPending) return;
    setPreferredLocale(currentLocale);
    setMeasurementSystem(currentMeasurementSystem);
    setSettingsSheetVisible(false);
  };

  const measurementOptions = (['METRIC', 'IMPERIAL'] as const).map((value) => ({
    value,
    label: getMeasurementSystemLabel(t, value)
  }));

  return (
    <View style={styles.section}>
      <Card>
        <SectionHeader title={t('settings.account')} subtitle={t('settings.accountHelp')} />
        <SettingsListItem
          icon={<UserRound size={18} color={colors.health} />}
          tone="profile"
          title={user?.email ?? t('settings.signedIn')}
          subtitle={t('settings.signedIn')}
        />
        <SettingsListItem
          icon={<Crown size={18} color={colors.recovery} />}
          tone="plan"
          title={entitlements.isError ? t('settings.planUnavailable') : getSubscriptionPlanLabel(t, entitlements.data?.currentPlan ?? 'FREE')}
          subtitle={entitlements.isError ? t('settings.upgradeSoon') : getPlanQualityModeLabel(t, entitlements.data?.planQualityMode ?? 'BASIC')}
          statusLabel={t('settings.upgradeSoon')}
          statusTone="info"
        />
      </Card>
      <Card>
        <SectionHeader title={t('settings.application')} />
        {settings.isLoading ? <Text variant="muted">{t('common.loading')}</Text> : null}
        {settings.isError ? (
          <>
            <Text style={styles.error}>{t('settings.loadError')}</Text>
            <Button title={t('common.retry')} variant="secondary" onPress={() => settings.refetch()} />
          </>
        ) : null}
        {!settings.isLoading && !settings.isError ? (
          <SettingsListItem
            icon={<Languages size={18} color={colors.info} />}
            tone="settings"
            title={t('settings.application')}
            subtitle={`${LANGUAGE_OPTIONS.find((item) => item.value === currentLocale)?.label ?? currentLocale} · ${getMeasurementSystemLabel(t, currentMeasurementSystem)}`}
            onPress={() => {
              setPreferredLocale(currentLocale);
              setMeasurementSystem(currentMeasurementSystem);
              setSavedMessage(null);
              setSettingsSheetVisible(true);
            }}
          />
        ) : null}
        {__DEV__ ? (
          <SettingsListItem
            icon={<Settings size={18} color={colors.info} />}
            tone="settings"
            title={t('designSystem.title')}
            subtitle={t('designSystem.intro')}
            onPress={() => router.push('/design-system-preview' as never)}
          />
        ) : null}
      </Card>
      <AppFeedbackSheet
        visible={languageRecreateVisible}
        title={t('settings.languagePlanRecreateTitle')}
        message={t('settings.languagePlanRecreateMessage')}
        tone="info"
        onClose={() => {
          if (!recreateLanguagePlan.isPending) setLanguageRecreateVisible(false);
        }}
        actions={[
          {
            label: recreateLanguagePlan.isPending
              ? t('common.loading')
              : t('settings.languagePlanRecreateAction'),
            onPress: () => recreateLanguagePlan.mutate(),
            disabled: recreateLanguagePlan.isPending
          },
          {
            label: t('settings.languagePlanKeepCurrentAction'),
            variant: 'secondary',
            disabled: recreateLanguagePlan.isPending,
            onPress: () => setLanguageRecreateVisible(false)
          }
        ]}
      />
      <BottomSheet
        visible={settingsSheetVisible}
        title={t('settings.application')}
        subtitle={t('settings.accountHelp')}
        onClose={closeSettingsSheet}
      >
        <SelectChips
          label={t('settings.language')}
          value={preferredLocale}
          options={LANGUAGE_OPTIONS}
          onChange={(value) => { setPreferredLocale(value); setSavedMessage(null); }}
        />
        <Text variant="muted">{t('settings.languagePlanHelp')}</Text>
        <SelectChips
          label={t('settings.measurementSystem')}
          value={measurementSystem}
          options={measurementOptions}
          onChange={(value) => { setMeasurementSystem(value); setSavedMessage(null); }}
        />
        <Text variant="muted">{t('settings.measurementHelp')}</Text>
        <View style={styles.actions}>
          <Button
            title={mutation.isPending ? t('common.saving') : t('settings.save')}
            disabled={mutation.isPending || !dirty}
            onPress={() => mutation.mutate({ preferredLocale, measurementSystem })}
          />
          <Button title={t('common.cancel')} variant="secondary" disabled={mutation.isPending} onPress={closeSettingsSheet} />
        </View>
      </BottomSheet>
      <Card>
        <SectionHeader title={t('settings.support')} />
        <SettingsListItem
          icon={<LifeBuoy size={18} color={colors.textSecondary} />}
          tone="support"
          title={t('settings.privacyAccount')}
          subtitle={t('settings.privacyCopy')}
        />
      </Card>
      {savedMessage ? (
        <AppToast
          title={t('feedback.savedSuccessfully')}
          message={t(
            savedMessage === 'languageRecreated'
              ? 'settings.languagePlanRecreated'
              : savedMessage === 'language'
                ? 'settings.languagePlanNotice'
                : 'settings.saved'
          )}
          tone="success"
          onDismiss={() => setSavedMessage(null)}
        />
      ) : null}
      <AppFeedbackSheet
        visible={errorSheetVisible}
        title={t('settings.saveError')}
        message={t('settings.saveErrorHelp')}
        tone="danger"
        onClose={() => setErrorSheetVisible(false)}
        actions={[{ label: t('common.close'), variant: 'secondary', onPress: () => setErrorSheetVisible(false) }]}
      />
      <AppFeedbackSheet
        visible={languageRecreateErrorVisible}
        title={t('settings.languagePlanRecreateFailed')}
        message={t('errors.unableLoad')}
        tone="warning"
        onClose={() => setLanguageRecreateErrorVisible(false)}
        actions={[{ label: t('common.close'), variant: 'secondary', onPress: () => setLanguageRecreateErrorVisible(false) }]}
      />
    </View>
  );
}

function LogoutSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((state) => state.clearSession);

  return (
    <Card>
      <SettingsListItem
        icon={<LogOut size={18} color={colors.danger} />}
        tone="danger"
        title={t('settings.logout')}
        subtitle={t('settings.logoutHelp')}
        onPress={async () => {
          await clearSession();
          queryClient.clear();
          router.replace('/(auth)/welcome');
        }}
      />
    </Card>
  );
}

function formatHealthStatus(
  status: string | undefined,
  t: (
    key:
      | 'health.connected'
      | 'health.permissionDenied'
      | 'health.syncError'
      | 'health.notConnected'
  ) => string
) {
  if (status === 'CONNECTED') return t('health.connected');
  if (status === 'PERMISSION_DENIED') return t('health.permissionDenied');
  if (status === 'ERROR') return t('health.syncError');
  return t('health.notConnected');
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  actions: { gap: 10 },
  accountHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.healthMuted,
    borderRadius: 22,
    height: 52,
    justifyContent: 'center',
    width: 52
  },
  accountCopy: {
    flex: 1,
    gap: 3
  },
  eyebrow: {
    color: colors.textSecondary,
    fontWeight: '600'
  },
  accountName: {
    color: colors.textPrimary
  },
  accountDivider: {
    backgroundColor: colors.divider,
    height: 1
  },
  personalAccountCard: {
    gap: 10
  },
  error: { color: colors.danger, fontWeight: '600' }
});
