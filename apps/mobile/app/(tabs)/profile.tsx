import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { profileSchema } from '@optime/shared-schemas';

import { getEntitlements, getUsageSummary } from '@/api/account';
import { getGoal } from '@/api/goals';
import { getHealthStatus } from '@/api/health';
import { getProfile, saveProfile } from '@/api/profile';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import {
  getPlatformHealthProvider,
  getPlatformHealthProviderLabel
} from '@/features/health/health-platform';
import {
  EMPTY_PERSONAL_PROFILE,
  fromProfileResponse,
  PersonalProfileForm,
  PersonalProfileFormValue,
  toProfileRequest
} from '@/features/profile/PersonalProfileForm';
import { WELLNESS_DISCLAIMER } from '@/features/safety/safety-copy';
import { isDraftDirty } from '@/features/editor/draft-state';
import { getGoalLabel } from '@/features/goals/GoalsForm';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useAuthStore } from '@/store/auth-store';
import { colors } from '@/theme/colors';

type ProfileSection = 'Personal' | 'Health' | 'Connections' | 'Settings';
const SECTIONS: ProfileSection[] = ['Personal', 'Health', 'Connections', 'Settings'];

export default function ProfileScreen() {
  const [section, setSection] = useState<ProfileSection>('Personal');

  return (
    <Screen>
      <Text variant="heading">Profile</Text>
      <View style={styles.segmented}>
        {SECTIONS.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: section === item }}
            onPress={() => setSection(item)}
            style={[styles.segment, section === item ? styles.segmentActive : null]}
          >
            <Text style={section === item ? styles.segmentTextActive : styles.segmentText}>{item}</Text>
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
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const goal = useQuery({ queryKey: ['goal'], queryFn: getGoal });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<PersonalProfileFormValue>(EMPTY_PERSONAL_PROFILE);
  const [savedValue, setSavedValue] = useState<PersonalProfileFormValue>(EMPTY_PERSONAL_PROFILE);
  const [message, setMessage] = useState<string | null>(null);

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
      setMessage('Personal details saved. Future recommendations will use your updates.');
      queryClient.setQueryData(['profile'], data);
    }
  });

  if (profile.isLoading) return <StateBlock title="Loading personal details" message="Preparing your profile." />;
  if (profile.isError) return <StateBlock title="Profile unavailable" message={profile.error.message} actionTitle="Try again" onAction={() => profile.refetch()} />;

  const save = () => {
    const result = profileSchema.safeParse(toProfileRequest(value));
    if (!result.success) {
      setMessage(result.error.issues[0]?.message ?? 'Please review your personal details.');
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
          <Button title={mutation.isPending ? 'Saving...' : 'Save personal details'} disabled={mutation.isPending || !dirty} onPress={save} />
          <Button title="Cancel" variant="secondary" disabled={mutation.isPending} onPress={() => { setValue(savedValue); setEditing(false); setMessage(null); }} />
        </>
      ) : (
        <>
          <Card>
            <Text variant="label">Personal</Text>
            <Text>{[savedValue.firstName, savedValue.lastName].filter(Boolean).join(' ') || 'Name not added'}</Text>
            <Text variant="muted">Born {savedValue.dateOfBirth || 'Not set'} · {savedValue.heightCm} cm · {savedValue.weightKg} kg</Text>
            <Text variant="muted">Activity: {humanize(savedValue.activityLevel)}</Text>
          </Card>
          <Card>
            <Text variant="label">Current goal</Text>
            <Text>{goal.data ? getGoalLabel(goal.data.goalType) : goal.isLoading ? 'Loading...' : 'No goal saved'}</Text>
            <Text variant="muted">Goal updates remain owned by the goal resource, not the profile payload.</Text>
            <Button
              title={goal.data ? 'Edit goals' : 'Add goals'}
              variant="secondary"
              onPress={() => router.push('/goal-editor')}
            />
          </Card>
          <Button title="Edit personal details" variant="secondary" onPress={() => { setMessage(null); setEditing(true); }} />
        </>
      )}
      {message ? <Card><Text variant="muted">{message}</Text></Card> : null}
    </View>
  );
}

function HealthSection() {
  const user = useAuthStore((state) => state.user);
  return (
    <View style={styles.section}>
      <Card>
        <Text variant="label">Wellness safety</Text>
        <Text>{user?.safeMode ? 'Safe mode is active.' : 'Standard wellness mode is active.'}</Text>
        <Text variant="muted">Age-aware safety is derived by the backend from your date of birth.</Text>
      </Card>
      <Card><Text variant="label">Health context</Text><Text variant="muted">Pregnancy and postpartum context can be updated under Personal when relevant.</Text></Card>
      <Card><Text variant="label">Important</Text><Text variant="muted">{WELLNESS_DISCLAIMER}</Text></Card>
    </View>
  );
}

function ConnectionsSection() {
  const status = useQuery({ queryKey: ['health-status'], queryFn: getHealthStatus });
  const provider = getPlatformHealthProvider();
  const label = getPlatformHealthProviderLabel();
  const connection = status.data?.connections.find((item) => item.provider === provider);

  return (
    <View style={styles.section}>
      <Card>
        <Text variant="label">{label}</Text>
        <Text>{status.isLoading ? 'Checking connection...' : status.isError ? 'Connection unavailable' : formatHealthStatus(connection?.status)}</Text>
        <Text variant="muted">Last sync: {connection?.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString() : 'Not synced yet'}</Text>
        <Text variant="muted">Optional health summaries can include steps, sleep, workouts, and activity where supported.</Text>
        <Button title={connection?.status === 'CONNECTED' ? 'Manage connection' : 'Connect'} variant="secondary" onPress={() => router.push('/health-data')} />
      </Card>
      <Text variant="muted">Additional providers can be added here later. No unsupported provider is shown as connected.</Text>
    </View>
  );
}

function SettingsSection() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const entitlements = useQuery({ queryKey: ['entitlements'], queryFn: getEntitlements });
  const usage = useQuery({ queryKey: ['usage-summary'], queryFn: getUsageSummary });

  return (
    <View style={styles.section}>
      <Card><Text variant="label">Account</Text><Text>{user?.email ?? 'Signed in'}</Text></Card>
      <Card>
        <Text variant="label">Subscription</Text>
        <Text>{entitlements.isError ? 'Plan details unavailable' : `${humanize(entitlements.data?.currentPlan ?? 'FREE')} · ${humanize(entitlements.data?.planQualityMode ?? 'BASIC')}`}</Text>
        <Text variant="muted">{usage.isError ? 'Usage details unavailable' : 'Usage limits are shown on Today when available.'}</Text>
        <Text variant="muted">Upgrade options coming soon.</Text>
      </Card>
      <Card><Text variant="label">Application settings</Text><Text variant="muted">Language, measurement system, and notification controls are planned. No unsaved setting is presented as active.</Text></Card>
      <Card><Text variant="label">Privacy and account</Text><Text variant="muted">Health data management is available under Connections. Account export and deletion remain future settings work.</Text></Card>
      <Button title="Log out" variant="secondary" onPress={async () => { await clearSession(); queryClient.clear(); router.replace('/(auth)/welcome'); }} />
    </View>
  );
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function formatHealthStatus(status?: string) {
  if (status === 'CONNECTED') return 'Connected';
  if (status === 'PERMISSION_DENIED') return 'Permission denied';
  if (status === 'ERROR') return 'Sync error';
  return 'Not connected';
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', padding: 4, borderRadius: 10, backgroundColor: '#eaf0ec' },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: 4 },
  segmentActive: { backgroundColor: colors.card },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  section: { gap: 14 },
  hidden: { display: 'none' },
  error: { color: colors.danger, fontWeight: '600' }
});
