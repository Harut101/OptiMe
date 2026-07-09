import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { profileSchema } from '@optime/shared-schemas';
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
  ShieldCheck,
  Target,
  UserRound,
  Utensils,
  Watch
} from 'lucide-react-native';

import { getEntitlements } from '@/api/account';
import { generateTodayPlan } from '@/api/daily-plans';
import { getGoal } from '@/api/goals';
import { getHealthStatus } from '@/api/health';
import { evaluatePlanImpact } from '@/api/plan-impact';
import { getProfile, saveProfile } from '@/api/profile';
import { getSettings, updateSettings } from '@/api/settings';
import { createWeightLog, getWeightSummary } from '@/api/weight';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ContextNoteCard } from '@/components/ContextNoteCard';
import { AppFeedbackSheet } from '@/components/AppFeedbackSheet';
import { AppToast } from '@/components/AppToast';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { SelectChips } from '@/components/SelectChips';
import { SettingsListItem } from '@/components/SettingsListItem';
import { StateBlock } from '@/components/StateBlock';
import { StatusPill } from '@/components/StatusPill';
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
import { getPrimaryGoalDisplayLabel } from '@/features/goals/GoalsForm';
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
      <HealthSection />
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

  if (profile.isLoading) return <StateBlock title={t('common.loading')} message={t('profile.preparing')} />;
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
      {editing ? (
        <>
          <PersonalProfileForm value={value} onChange={setValue} />
          {mutation.isError ? <Text style={styles.error}>{mutation.error.message}</Text> : null}
          <Button title={mutation.isPending ? t('common.saving') : t('common.save')} disabled={mutation.isPending || !dirty} onPress={save} />
          <Button title={t('common.cancel')} variant="secondary" disabled={mutation.isPending} onPress={() => { setValue(savedValue); setEditing(false); setToastMessage(null); }} />
        </>
      ) : (
        <>
          <Card variant="elevated">
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
            <SettingsListItem
              icon={<UserRound size={18} color={colors.health} />}
              tone="profile"
              title={t('profile.editProfile')}
              subtitle={savedValue.dateOfBirth ? formatDate(savedValue.dateOfBirth, preferredLocale) : t('common.notSet')}
              value={getActivityLevelLabel(t, savedValue.activityLevel)}
              onPress={() => { setToastMessage(null); setEditing(true); }}
            />
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
          </Card>
        </>
      )}
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

function GoalNutritionSection() {
  const { t } = useTranslation();
  const goal = useQuery({ queryKey: ['goal'], queryFn: getGoal });

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
          statusLabel={goal.data ? t('common.saved') : undefined}
          statusTone="success"
          onPress={() => router.push('/goal-editor')}
        />
        <SettingsListItem
          icon={<Utensils size={18} color={colors.nutrition} />}
          tone="nutrition"
          title={t('food.title')}
          subtitle={t('profile.nutritionPreferencesSummary')}
          onPress={() => router.push('/(tabs)/food')}
        />
      </Card>
      <WeightSection />
    </View>
  );
}

function TrainingHubSection() {
  const { t } = useTranslation();
  return (
    <Card>
      <SectionHeader title={t('tabs.training')} subtitle={t('profile.trainingHubHelp')} />
      <SettingsListItem
        icon={<Dumbbell size={18} color={colors.training} />}
        tone="training"
        title={t('training.current')}
        subtitle={t('training.setupSummaryHelp')}
        onPress={() => router.push('/(tabs)/training')}
      />
      <SettingsListItem
        icon={<CalendarDays size={18} color={colors.training} />}
        tone="training"
        title={t('schedule.weeklySchedule')}
        subtitle={t('schedule.weeklyScheduleHelp')}
        onPress={() => router.push('/(tabs)/training')}
      />
      <SettingsListItem
        icon={<History size={18} color={colors.training} />}
        tone="training"
        title={t('workout.workoutHistory')}
        subtitle={t('workout.historyHelp')}
        onPress={() => router.push('/workout-history')}
      />
    </Card>
  );
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

function HealthSection() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  return (
    <View style={styles.section}>
      <Card>
        <SectionHeader title={t('profile.wellnessSafety')} />
        <SettingsListItem
          icon={<ShieldCheck size={18} color={user?.safeMode ? colors.warning : colors.success} />}
          title={user?.safeMode ? t('profile.safeMode') : t('profile.standardMode')}
          subtitle={t('profile.ageSafety')}
        />
        <StatusPill label={user?.safeMode ? t('profile.safeMode') : t('profile.standardMode')} tone={user?.safeMode ? 'warning' : 'success'} />
      </Card>
      <ContextNoteCard title={t('profile.healthContextTitle')} message={t('profile.healthContextCopy')} />
      <ContextNoteCard title={t('profile.important')} message={t('safety.disclaimer')} tone="warning" />
    </View>
  );
}

function ConnectionsSection() {
  const { t } = useTranslation();
  const preferredLocale = useSettingsStore((state) => state.preferredLocale);
  const status = useQuery({ queryKey: ['health-status'], queryFn: getHealthStatus });
  const provider = getPlatformHealthProvider();
  const label = provider ? getHealthProviderLabel(t, provider) : t('health.title');
  const connection = status.data?.connections.find((item) => item.provider === provider);

  return (
    <View style={styles.section}>
      <Card>
        <SectionHeader title={label} />
        <SettingsListItem
          icon={<Watch size={18} color={colors.health} />}
          title={status.isLoading ? t('common.loading') : status.isError ? t('health.unavailable') : formatHealthStatus(connection?.status, t)}
          subtitle={t('health.lastSync', { value: connection?.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString(preferredLocale) : t('health.notSynced') })}
          value={label}
          onPress={() => router.push('/health-data')}
        />
        <Text variant="caption">{t('health.intro')}</Text>
        <Button title={connection?.status === 'CONNECTED' ? t('health.manage') : t('health.connect')} variant="secondary" onPress={() => router.push('/health-data')} />
      </Card>
    </View>
  );
}

function SettingsSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const applySettings = useSettingsStore((state) => state.applySettings);
  const currentLocale = useSettingsStore((state) => state.preferredLocale);
  const currentMeasurementSystem = useSettingsStore((state) => state.measurementSystem);
  const entitlements = useQuery({ queryKey: ['entitlements'], queryFn: getEntitlements });
  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const [preferredLocale, setPreferredLocale] = useState<SupportedLocale>(currentLocale);
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>(currentMeasurementSystem);
  const [savedMessage, setSavedMessage] = useState(false);
  const [errorSheetVisible, setErrorSheetVisible] = useState(false);

  useEffect(() => {
    if (!settings.data) return;
    setPreferredLocale(settings.data.preferredLocale);
    setMeasurementSystem(settings.data.measurementSystem);
  }, [settings.data]);

  const dirty = preferredLocale !== currentLocale || measurementSystem !== currentMeasurementSystem;
  useUnsavedChangesGuard(dirty);
  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (saved) => {
      applySettings(saved.preferredLocale, saved.measurementSystem, true);
      queryClient.setQueryData(['settings'], saved);
      setSavedMessage(true);
    },
    onError: () => setErrorSheetVisible(true)
  });

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
          <>
            <SelectChips
              label={t('settings.language')}
              value={preferredLocale}
              options={LANGUAGE_OPTIONS}
              onChange={(value) => { setPreferredLocale(value); setSavedMessage(false); }}
            />
            <Text variant="muted">{t('settings.languageHelp')}</Text>
            <SelectChips
              label={t('settings.measurementSystem')}
              value={measurementSystem}
              options={measurementOptions}
              onChange={(value) => { setMeasurementSystem(value); setSavedMessage(false); }}
            />
            <Text variant="muted">{t('settings.measurementHelp')}</Text>
            <Button
              title={mutation.isPending ? t('common.saving') : t('settings.save')}
              disabled={mutation.isPending || !dirty}
              onPress={() => mutation.mutate({ preferredLocale, measurementSystem })}
            />
          </>
        ) : null}
        <Text variant="muted">{t('settings.futureControls')}</Text>
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
      <Card>
        <SectionHeader title={t('settings.support')} />
        <SettingsListItem
          icon={<LifeBuoy size={18} color={colors.textSecondary} />}
          tone="support"
          title={t('settings.privacyAccount')}
          subtitle={t('settings.privacyCopy')}
        />
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
      {savedMessage ? <AppToast title={t('feedback.savedSuccessfully')} message={t('settings.saved')} tone="success" onDismiss={() => setSavedMessage(false)} /> : null}
      <AppFeedbackSheet
        visible={errorSheetVisible}
        title={t('settings.saveError')}
        message={t('settings.saveErrorHelp')}
        tone="danger"
        onClose={() => setErrorSheetVisible(false)}
        actions={[{ label: t('common.close'), variant: 'secondary', onPress: () => setErrorSheetVisible(false) }]}
      />
    </View>
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
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  accountName: {
    color: colors.textPrimary
  },
  error: { color: colors.danger, fontWeight: '600' }
});
