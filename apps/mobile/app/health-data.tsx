import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { generateTodayPlan } from '@/api/daily-plans';
import {
  createMockWearableSnapshot,
  getHealthConnections,
  getTodayWearableSnapshot,
  updateHealthConnectionStatus
} from '@/api/health';
import { evaluatePlanImpact } from '@/api/plan-impact';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ContextNoteCard } from '@/components/ContextNoteCard';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { StateBlock } from '@/components/StateBlock';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { nativeHealthService, NativeHealthServiceError } from '@/features/health/native-health.service';
import {
  formatUsageLimitMessage,
  getUsageLimitError
} from '@/features/entitlements/usage-limit-message';
import { PlanImpactPromptCard } from '@/features/plan-impact/PlanImpactPromptCard';
import { getHealthProviderLabel } from '@/i18n/enum-labels';
import { formatNumber, formatTime } from '@/i18n/formatters';
import { useSettingsStore } from '@/store/settings-store';
import { colors } from '@/theme/colors';
import type {
  EvaluatePlanImpactResponse,
  HealthConnectionFoundation,
  HealthProvider,
  WearableSnapshotResponse
} from '@/types/api';

const FOUNDATION_SOURCES: HealthProvider[] = ['APPLE_HEALTH', 'HEALTH_CONNECT', 'WHOOP', 'GARMIN'];

export default function HealthDataScreen() {
  const { t } = useTranslation();
  const preferredLocale = useSettingsStore((state) => state.preferredLocale);
  const queryClient = useQueryClient();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [planImpact, setPlanImpact] = useState<EvaluatePlanImpactResponse | null>(null);
  const [planImpactError, setPlanImpactError] = useState<string | null>(null);
  const connections = useQuery({
    queryKey: ['health-connections'],
    queryFn: getHealthConnections
  });
  const snapshot = useQuery({
    queryKey: ['wearable-snapshot', 'today'],
    queryFn: getTodayWearableSnapshot
  });
  const mockSnapshot = useMutation({
    mutationFn: () =>
      createMockWearableSnapshot({
        source: 'MOCK',
        steps: 8200,
        activeCaloriesKcal: 420,
        workoutMinutes: 35,
        sleepMinutes: 420,
        sleepQualityScore: 78,
        recoveryScore: 72,
        strainScore: 8.5
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['health-connections'] });
      await queryClient.invalidateQueries({ queryKey: ['wearable-snapshot', 'today'] });
      await queryClient.invalidateQueries({ queryKey: ['today-plan'] });
      await evaluateHealthPlanImpact('WEARABLE_SNAPSHOT_CHANGED');
    }
  });
  const appleHealthSync = useMutation({
    mutationFn: nativeHealthService.syncAppleHealthToday,
    onSuccess: async (result) => {
      await refreshHealthQueries(queryClient);
      setActionMessage(getAppleHealthResultMessage(t, result));
      if (result.messageCode === 'SYNCED') {
        await evaluateHealthPlanImpact('APPLE_HEALTH_SYNCED');
      }
    },
    onError: (error) => {
      setActionMessage(getAppleHealthErrorMessage(t, error));
    }
  });
  const appleHealthDisconnect = useMutation({
    mutationFn: () =>
      updateHealthConnectionStatus('APPLE_HEALTH', {
        status: 'DISABLED',
        errorCode: 'APPLE_HEALTH_DISABLED_BY_USER'
      }),
    onSuccess: async () => {
      await refreshHealthQueries(queryClient);
      setActionMessage(t('health.appleHealthDisconnected'));
    },
    onError: () => {
      setActionMessage(t('health.syncError'));
    }
  });
  const regenerateTodayPlan = useMutation({
    mutationFn: () => generateTodayPlan(true),
    onSuccess: async (data) => {
      queryClient.setQueryData(['today-plan'], data);
      setPlanImpact(null);
      setPlanImpactError(null);
      setActionMessage(t('today.refreshed'));
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
  const connectedSources = connections.data?.connections.filter((item) => item.status === 'CONNECTED') ?? [];
  const hasConnectedSource = connectedSources.length > 0;
  const hasConnectedMockSource = connectedSources.some((item) => item.source === 'MOCK');
  const handleSync = () => {
    if (!hasConnectedSource) {
      setActionMessage(`${t('health.noConnectedSource')} ${t('health.connectSourceToSync')}`);
      return;
    }

    if (__DEV__ && hasConnectedMockSource) {
      mockSnapshot.mutate();
      return;
    }

    setActionMessage(t('health.nativeBuildHelp'));
  };
  const handleFoundationAction = () => {
    setActionMessage(`${t('health.noConnectedSource')} ${t('health.connectSourceToSync')}`);
  };

  if (connections.isLoading) {
    return <StateBlock title={t('common.loading')} message={t('health.loadingConnections')} />;
  }

  return (
    <Screen>
      <ScreenHeader
        title={t('health.connectionsTitle')}
        subtitle={`${t('health.connectionsIntro')} ${t('health.optional')}`}
      />

      {FOUNDATION_SOURCES.map((source) => (
        <ConnectionCard
          key={source}
          source={source}
          connection={connections.data?.connections.find((item) => item.source === source)}
          onConnect={source === 'APPLE_HEALTH' ? () => appleHealthSync.mutate() : undefined}
          onSync={source === 'APPLE_HEALTH' ? () => appleHealthSync.mutate() : undefined}
          onDisconnect={source === 'APPLE_HEALTH' ? () => appleHealthDisconnect.mutate() : undefined}
          locale={preferredLocale}
          isActionPending={
            source === 'APPLE_HEALTH' &&
            (appleHealthSync.isPending || appleHealthDisconnect.isPending)
          }
        />
      ))}

      <WearableSnapshotCard
        snapshot={snapshot.data}
        isUnavailable={snapshot.isError}
        locale={preferredLocale}
      />

      <PlanImpactPromptCard
        impact={planImpact}
        isUpdating={regenerateTodayPlan.isPending}
        errorMessage={planImpactError}
        onUpdateToday={() => regenerateTodayPlan.mutate()}
        onFutureOnly={() => {
          setPlanImpact(null);
          setPlanImpactError(null);
          setActionMessage(t('planImpact.futureOnlySaved'));
        }}
      />

      <Card>
        <Text variant="label">{t('health.manage')}</Text>
        <Text variant="muted">{t('health.syncHelp')}</Text>
        <View style={styles.actionRow}>
          <Button
            title={mockSnapshot.isPending ? t('health.syncing') : t('health.sync')}
            disabled={mockSnapshot.isPending}
            accessibilityLabel={t('health.sync')}
            onPress={handleSync}
            style={styles.actionButton}
          />
          <Button
            title={t('health.disconnect')}
            variant="secondary"
            accessibilityLabel={t('health.disconnect')}
            onPress={handleFoundationAction}
            style={styles.actionButton}
          />
        </View>
        <Button
          title={t('health.deleteData')}
          variant="ghost"
          accessibilityLabel={t('health.deleteData')}
          onPress={handleFoundationAction}
        />
        {actionMessage ? <ContextNoteCard title={t('health.status')} message={actionMessage} /> : null}
      </Card>

      {__DEV__ ? (
        <Card>
          <Text variant="label">{t('health.mockData')}</Text>
          <Text variant="muted">{t('health.mockDataHelp')}</Text>
          <Button
            title={mockSnapshot.isPending ? t('health.syncing') : t('health.createMockSnapshot')}
            disabled={mockSnapshot.isPending}
            accessibilityLabel={t('health.createMockSnapshot')}
            onPress={() => mockSnapshot.mutate()}
          />
          {mockSnapshot.isError ? (
            <Text style={styles.errorText}>{t('health.mockSnapshotFailed')}</Text>
          ) : null}
          {mockSnapshot.isSuccess ? (
            <Text style={styles.successText}>{t('health.mockSnapshotCreated')}</Text>
          ) : null}
        </Card>
      ) : null}

      {connections.isError ? (
        <ContextNoteCard title={t('health.unavailable')} message={t('errors.unableLoad')} tone="warning" />
      ) : null}
    </Screen>
  );

  async function evaluateHealthPlanImpact(changeType: 'APPLE_HEALTH_SYNCED' | 'WEARABLE_SNAPSHOT_CHANGED') {
    try {
      const impact = await evaluatePlanImpact({ changeTypes: [changeType] });
      setPlanImpactError(null);
      setPlanImpact(impact.prompt ? impact : null);
    } catch {
      setPlanImpact(null);
    }
  }
}

function ConnectionCard({
  source,
  connection,
  onConnect,
  onSync,
  onDisconnect,
  locale,
  isActionPending = false
}: {
  source: HealthProvider;
  connection?: HealthConnectionFoundation;
  onConnect?: () => void;
  onSync?: () => void;
  onDisconnect?: () => void;
  locale: string;
  isActionPending?: boolean;
}) {
  const { t } = useTranslation();
  const status = connection?.status ?? 'NOT_CONNECTED';
  const isConnected = status === 'CONNECTED';
  const needsAttention = status === 'NEEDS_REAUTH' || status === 'ERROR';

  return (
    <Card>
      <View
        accessible
        accessibilityLabel={t('health.connectionAccessibility', {
          provider: getProviderName(source, t),
          status: getConnectionStatusLabel(status, t)
        })}
      >
      <View style={styles.cardHeader}>
        <SectionHeader title={getProviderName(source, t)} />
        <StatusPill
          label={getConnectionStatusLabel(status, t)}
          tone={isConnected ? 'success' : needsAttention ? 'danger' : 'neutral'}
        />
      </View>
      </View>
      <Text variant="body">{getConnectionBodyCopy(source, isConnected, t)}</Text>
      <Text variant="muted">
        {getConnectionHelperCopy(source, isConnected, t)}
      </Text>
      {connection?.lastSyncAt ? (
        <Text variant="muted">{t('health.lastSynced', { value: formatHealthTimestamp(connection.lastSyncAt, locale, t) })}</Text>
      ) : null}
      {source === 'APPLE_HEALTH' ? (
        <>
          {!isConnected ? <Text variant="muted">{t('health.appleHealthIosOnly')}</Text> : null}
          <View style={styles.actionRow}>
            {!isConnected ? (
              <Button
                title={isActionPending ? t('health.connecting') : t('health.connectAppleHealth')}
                disabled={isActionPending}
                accessibilityLabel={t('health.connectAppleHealth')}
                onPress={onConnect}
                style={styles.actionButton}
              />
            ) : (
              <Button
                title={isActionPending ? t('health.syncing') : t('health.syncAppleHealth')}
                disabled={isActionPending}
                accessibilityLabel={t('health.syncAppleHealth')}
                onPress={onSync}
                style={styles.actionButton}
              />
            )}
            <Button
              title={t('health.disconnect')}
              variant="secondary"
              disabled={isActionPending}
              accessibilityLabel={t('health.disconnectAppleHealth')}
              onPress={onDisconnect}
              style={styles.actionButton}
            />
          </View>
        </>
      ) : null}
    </Card>
  );
}

function WearableSnapshotCard({
  snapshot,
  isUnavailable,
  locale
}: {
  snapshot?: WearableSnapshotResponse;
  isUnavailable: boolean;
  locale: string;
}) {
  const { t } = useTranslation();

  if (isUnavailable) {
    return (
      <Card>
        <SectionHeader title={t('health.wearableSnapshot')} />
        <Text variant="muted">{t('health.noRecentWearableData')}</Text>
      </Card>
    );
  }

  if (!snapshot?.snapshot) {
    return (
      <Card>
        <SectionHeader title={t('health.wearableSnapshot')} />
        <Text variant="body">{t('health.noRecentWearableData')}</Text>
        <Text variant="muted">{t('health.noRecentWearableDataHelp')}</Text>
      </Card>
    );
  }

  return (
    <Card>
      <View
        accessible
        accessibilityLabel={t('health.snapshotAccessibility', {
          source: getProviderName(snapshot.snapshot.source, t),
          date: snapshot.snapshot.localDate
        })}
      >
      <SectionHeader title={t('health.wearableSnapshot')} />
      </View>
      <Text variant="body">
        {snapshot.snapshot.isStale ? t('health.wearableDataStale') : t('health.wearableDataConnected')}
      </Text>
      <Text variant="muted">{getHealthProviderLabel(t, snapshot.snapshot.source)} · {snapshot.snapshot.localDate}</Text>
      <View style={styles.metricGrid}>
        {getSnapshotMetrics(snapshot.snapshot, locale, t).map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            tone={metric.tone}
          />
        ))}
      </View>
      {hasMissingAppleHealthMetric(snapshot.snapshot) ? (
        <Text variant="muted">{t('health.appleHealthPartialData')}</Text>
      ) : null}
    </Card>
  );
}

function getConnectionStatusLabel(status: HealthConnectionFoundation['status'], t: TFunction) {
  if (status === 'CONNECTED') return t('health.connected');
  if (status === 'NEEDS_REAUTH') return t('health.needsAttention');
  if (status === 'ERROR') return t('health.syncError');
  if (status === 'DISABLED') return t('health.disabled');
  return t('health.notConnected');
}

function getProviderDescription(source: HealthProvider, t: TFunction) {
  if (source === 'APPLE_HEALTH') return t('health.appleHealthDescription');
  if (source === 'HEALTH_CONNECT') return t('health.healthConnectDescription');
  if (source === 'GARMIN') return t('health.garminDescription');
  return t('health.whoopDescription');
}

function getConnectionBodyCopy(source: HealthProvider, isConnected: boolean, t: TFunction) {
  if (source === 'APPLE_HEALTH' && isConnected) {
    return t('health.appleHealthConnected');
  }

  return getProviderDescription(source, t);
}

function getConnectionHelperCopy(source: HealthProvider, isConnected: boolean, t: TFunction) {
  if (source === 'APPLE_HEALTH' && isConnected) {
    return t('health.wearableDataConnected');
  }

  return source === 'APPLE_HEALTH' ? t('health.beforeConnect') : t('health.comingSoon');
}

function getProviderName(source: HealthProvider, t: TFunction) {
  if (source === 'HEALTH_CONNECT') return t('health.healthConnect');
  return getHealthProviderLabel(t, source);
}

function getSnapshotMetrics(
  snapshot: NonNullable<WearableSnapshotResponse['snapshot']>,
  locale: string,
  t: TFunction
) {
  const baseMetrics = [
    snapshot.steps !== null
      ? { label: t('health.steps'), value: formatNumber(snapshot.steps, locale), tone: 'health' as const }
      : null,
    snapshot.activeCaloriesKcal !== null
      ? {
          label: t('health.activeCalories'),
          value: t('todayDashboard.kcalValue', { value: formatNumber(snapshot.activeCaloriesKcal, locale) }),
          tone: 'nutrition' as const
        }
      : null,
    snapshot.sleepMinutes !== null
      ? { label: t('health.sleepDuration'), value: formatSleep(snapshot.sleepMinutes, t), tone: 'recovery' as const }
      : null,
    snapshot.workoutMinutes !== null
      ? {
          label: t('health.workoutMinutes'),
          value: t('todayDashboard.minuteValue', { value: String(snapshot.workoutMinutes) }),
          tone: 'training' as const
        }
      : null
  ].filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));

  if (snapshot.source === 'APPLE_HEALTH') {
    return baseMetrics;
  }

  return [
    ...baseMetrics,
    snapshot.recoveryScore !== null
      ? { label: t('health.recoveryScore'), value: formatNumber(snapshot.recoveryScore, locale), tone: 'recovery' as const }
      : null,
    snapshot.strainScore !== null
      ? { label: t('health.strain'), value: formatNumber(snapshot.strainScore, locale), tone: 'training' as const }
      : null
  ].filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));
}

function hasMissingAppleHealthMetric(snapshot: NonNullable<WearableSnapshotResponse['snapshot']>) {
  return snapshot.source === 'APPLE_HEALTH' && [
    snapshot.steps,
    snapshot.activeCaloriesKcal,
    snapshot.sleepMinutes,
    snapshot.workoutMinutes
  ].some((value) => value === null);
}

function formatSleep(value: number, t: TFunction) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours > 0
    ? t('todayDashboard.sleepValue', { hours: String(hours), minutes: String(minutes) })
    : t('todayDashboard.minuteValue', { value: String(minutes) });
}

function formatHealthTimestamp(value: string, locale: string, t: TFunction) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('health.notSynced');

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const time = formatTime(date, locale);

  if (isSameLocalDay(date, today)) {
    return t('health.todayAt', { time });
  }

  if (isSameLocalDay(date, yesterday)) {
    return t('health.yesterdayAt', { time });
  }

  return `${date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}, ${time}`;
}

function isSameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

async function refreshHealthQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: ['health-connections'] });
  await queryClient.invalidateQueries({ queryKey: ['wearable-snapshot', 'today'] });
  await queryClient.invalidateQueries({ queryKey: ['today-plan'] });
}

function getAppleHealthErrorMessage(t: TFunction, error: unknown) {
  const code =
    error instanceof NativeHealthServiceError
      ? error.code
      : typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : null;

  if (code === 'PLATFORM_UNSUPPORTED') return t('health.appleHealthUnavailable');
  if (code === 'MISSING_NATIVE_MODULE') return getAppleHealthUnavailableMessage(t, code);
  if (code === 'PERMISSION_UNAVAILABLE') return getAppleHealthUnavailableMessage(t, code);
  if (code === 'APPLE_HEALTH_PERMISSION_DENIED') return t('health.appleHealthPermissionDenied');

  return t('health.syncError');
}

function getAppleHealthResultMessage(
  t: TFunction,
  result: Awaited<ReturnType<typeof nativeHealthService.syncAppleHealthToday>>
) {
  if (result.messageCode === 'UNAVAILABLE') {
    return getAppleHealthUnavailableMessage(t, result.errorCode);
  }

  if (result.messageCode === 'PERMISSION_DENIED') {
    return t('health.appleHealthPermissionDenied');
  }

  if (result.messageCode === 'NO_DATA') {
    return t('health.appleHealthNoData');
  }

  return t('health.appleHealthSynced');
}

function getAppleHealthUnavailableMessage(t: TFunction, code?: string | null) {
  if (code === 'MISSING_NATIVE_MODULE') return t('health.appleHealthNativeUnavailable');
  if (code === 'PERMISSION_UNAVAILABLE' || code === 'APPLE_HEALTH_UNAVAILABLE') {
    return t('health.appleHealthUnavailable');
  }

  return t('health.providerUnavailable');
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center'
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  actionButton: {
    flex: 1,
    minWidth: 130
  },
  successText: { color: colors.success, fontWeight: '700' },
  errorText: { color: colors.danger, fontWeight: '700' }
});
