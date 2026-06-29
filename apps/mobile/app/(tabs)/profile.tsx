import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { profileSchema } from '@optime/shared-schemas';
import { useTranslation } from 'react-i18next';
import type { MeasurementSystem, SupportedLocale } from '@optime/shared-types';

import { getEntitlements, getUsageSummary } from '@/api/account';
import { getGoal } from '@/api/goals';
import { getHealthStatus } from '@/api/health';
import { getProfile, saveProfile } from '@/api/profile';
import { getSettings, updateSettings } from '@/api/settings';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ContextNoteCard } from '@/components/ContextNoteCard';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { SelectChips } from '@/components/SelectChips';
import { StateBlock } from '@/components/StateBlock';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import {
  getPlatformHealthProvider
} from '@/features/health/health-platform';
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

type ProfileSection = 'Personal' | 'Health' | 'Connections' | 'Settings';
const SECTIONS: ProfileSection[] = ['Personal', 'Health', 'Connections', 'Settings'];
const SECTION_KEYS = {
  Personal: 'profile.sections.personal',
  Health: 'profile.sections.health',
  Connections: 'profile.sections.connections',
  Settings: 'profile.sections.settings'
} as const;

export default function ProfileScreen() {
  const [section, setSection] = useState<ProfileSection>('Personal');
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader title={t('profile.title')} />
      <View style={styles.segmented}>
        {SECTIONS.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: section === item }}
            onPress={() => setSection(item)}
            style={[styles.segment, section === item ? styles.segmentActive : null]}
          >
            <Text style={section === item ? styles.segmentTextActive : styles.segmentText}>{t(SECTION_KEYS[item])}</Text>
          </Pressable>
        ))}
      </View>
      <View style={section === 'Personal' ? undefined : styles.hidden}><PersonalSection /></View>
      <View style={section === 'Health' ? undefined : styles.hidden}><HealthSection /></View>
      <View style={section === 'Connections' ? undefined : styles.hidden}><ConnectionsSection /></View>
      <View style={section === 'Settings' ? undefined : styles.hidden}><SettingsSection /></View>
    </Screen>
  );
}

function PersonalSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const goal = useQuery({ queryKey: ['goal'], queryFn: getGoal });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<PersonalProfileFormValue>(EMPTY_PERSONAL_PROFILE);
  const [savedValue, setSavedValue] = useState<PersonalProfileFormValue>(EMPTY_PERSONAL_PROFILE);
  const [message, setMessage] = useState<string | null>(null);
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
      setMessage(t('profile.savedMessage'));
      queryClient.setQueryData(['profile'], data);
    }
  });

  if (profile.isLoading) return <StateBlock title={t('common.loading')} message={t('profile.preparing')} />;
  if (profile.isError) return <StateBlock title={t('profile.unavailable')} message={t('errors.unableLoad')} actionTitle={t('common.retry')} onAction={() => profile.refetch()} />;

  const save = () => {
    const result = profileSchema.safeParse(toProfileRequest(value));
    if (!result.success) {
      setMessage(t('errors.validation'));
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
          <Button title={t('common.cancel')} variant="secondary" disabled={mutation.isPending} onPress={() => { setValue(savedValue); setEditing(false); setMessage(null); }} />
        </>
      ) : (
        <>
          <Card>
            <SectionHeader title={t('profile.personal')} />
            <Text>{[savedValue.firstName, savedValue.lastName].filter(Boolean).join(' ') || t('profile.nameMissing')}</Text>
            <Text variant="muted">
              {t('profile.bornSummary', {
                date: savedValue.dateOfBirth ? formatDate(savedValue.dateOfBirth, preferredLocale) : t('common.notSet'),
                height: formatHeight(Number(savedValue.heightCm), preferredLocale, measurementSystem),
                weight: formatWeight(Number(savedValue.weightKg), preferredLocale, measurementSystem)
              })}
            </Text>
            <Text variant="muted">{t('profile.activitySummary', { value: getActivityLevelLabel(t, savedValue.activityLevel) })}</Text>
          </Card>
          <Card>
            <SectionHeader title={t('profile.goalsAndMode')} />
            <Text>{goal.data ? getPrimaryGoalDisplayLabel(goal.data.primaryGoal, goal.data.goalType, t) : goal.isLoading ? t('common.loading') : t('profile.noGoal')}</Text>
            <Text variant="muted">
              {goal.data
                ? t('profile.modeSummary', { mode: getGoalImpactLabel(t, goal.data.appMode ?? goal.data.impactMode ?? 'NUTRITION_AND_TRAINING') })
                : t('profile.goalHelp')}
            </Text>
            <Text variant="muted">{t('profile.trainingOptional')}</Text>
            <Button
              title={goal.data ? t('profile.editGoals') : t('profile.addGoals')}
              variant="secondary"
              onPress={() => router.push('/goal-editor')}
            />
          </Card>
          <Card>
            <SectionHeader title={t('workout.completedWorkouts')} />
            <Text variant="muted">{t('workout.historyHelp')}</Text>
            <Button
              title={t('workout.workoutHistory')}
              variant="secondary"
              accessibilityLabel={t('workout.openWorkoutHistory')}
              onPress={() => router.push('/workout-history')}
            />
          </Card>
          <Button title={t('common.edit')} variant="secondary" onPress={() => { setMessage(null); setEditing(true); }} />
        </>
      )}
      {message ? <ContextNoteCard title={t('common.saved')} message={message} tone="success" /> : null}
    </View>
  );
}

function HealthSection() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  return (
    <View style={styles.section}>
      <Card>
        <SectionHeader title={t('profile.wellnessSafety')} />
        <StatusPill label={user?.safeMode ? t('profile.safeMode') : t('profile.standardMode')} tone={user?.safeMode ? 'warning' : 'success'} />
        <Text variant="muted">{t('profile.ageSafety')}</Text>
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
        <Text>{status.isLoading ? t('common.loading') : status.isError ? t('health.unavailable') : formatHealthStatus(connection?.status, t)}</Text>
        <Text variant="muted">{t('health.lastSync', { value: connection?.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString(preferredLocale) : t('health.notSynced') })}</Text>
        <Text variant="muted">{t('health.intro')}</Text>
        <Button title={connection?.status === 'CONNECTED' ? t('health.manage') : t('health.connect')} variant="secondary" onPress={() => router.push('/health-data')} />
      </Card>
      <Text variant="muted">{t('health.providerUnavailable')}</Text>
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
  const usage = useQuery({ queryKey: ['usage-summary'], queryFn: getUsageSummary });
  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const [preferredLocale, setPreferredLocale] = useState<SupportedLocale>(currentLocale);
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>(currentMeasurementSystem);
  const [savedMessage, setSavedMessage] = useState(false);

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
    }
  });

  const measurementOptions = (['METRIC', 'IMPERIAL'] as const).map((value) => ({
    value,
    label: getMeasurementSystemLabel(t, value)
  }));

  return (
    <View style={styles.section}>
      <Card><SectionHeader title={t('settings.account')} /><Text>{user?.email ?? t('settings.signedIn')}</Text></Card>
      <Card>
        <SectionHeader title={t('settings.subscription')} />
        <Text>{entitlements.isError ? t('settings.planUnavailable') : `${getSubscriptionPlanLabel(t, entitlements.data?.currentPlan ?? 'FREE')} · ${getPlanQualityModeLabel(t, entitlements.data?.planQualityMode ?? 'BASIC')}`}</Text>
        <Text variant="muted">{usage.isError ? t('settings.usageUnavailable') : t('settings.usageToday')}</Text>
        <Text variant="muted">{t('settings.upgradeSoon')}</Text>
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
            {mutation.isError ? <Text style={styles.error}>{t('settings.saveError')}</Text> : null}
            {savedMessage ? <Text variant="muted">{t('settings.saved')}</Text> : null}
          </>
        ) : null}
        <Text variant="muted">{t('settings.futureControls')}</Text>
        {__DEV__ ? (
          <Button title={t('designSystem.title')} variant="secondary" onPress={() => router.push('/design-system-preview' as never)} />
        ) : null}
      </Card>
      <ContextNoteCard title={t('settings.privacyAccount')} message={t('settings.privacyCopy')} />
      <Button title={t('settings.logout')} variant="secondary" onPress={async () => { await clearSession(); queryClient.clear(); router.replace('/(auth)/welcome'); }} />
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
  segmented: { flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: colors.surfaceMuted },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: 4 },
  segmentActive: { backgroundColor: colors.card },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  section: { gap: 14 },
  hidden: { display: 'none' },
  error: { color: colors.danger, fontWeight: '600' }
});
