import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Apple, Bed, Flame, Footprints, HeartPulse, Timer, Watch } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { generateTodayPlan } from '@/api/daily-plans';
import {
  createMockWearableSnapshot,
  deleteHealthData,
  getHealthConnections,
  getTodayWearableSnapshot,
  updateHealthConnectionStatus
} from '@/api/health';
import { evaluatePlanImpact } from '@/api/plan-impact';
import { Button } from '@/components/Button';
import { AppFeedbackSheet } from '@/components/AppFeedbackSheet';
import { Card } from '@/components/Card';
import { ContextNoteCard } from '@/components/ContextNoteCard';
import { HealthMetricWidget } from '@/components/HealthMetricWidget';
import { ProviderConnectionCard } from '@/components/ProviderConnectionCard';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
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
  const [deleteSource, setDeleteSource] = useState<HealthProvider | null>(null);
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
  const deleteSyncedData = useMutation({
    mutationFn: (source: HealthProvider) => deleteHealthData({ provider: source }),
    onSuccess: async (result) => {
      await refreshHealthQueries(queryClient);
      setDeleteSource(null);
      setActionMessage(t('health.deletedCount', { count: result.summaryCountDeleted }));
    },
    onError: () => {
      setDeleteSource(null);
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
  if (connections.isLoading) {
    return <HealthConnectionsSkeleton />;
  }

  return (
    <Screen topSafeArea={false}>
      <Text variant="muted">{`${t('health.connectionsIntro')} ${t('health.optional')}`}</Text>

      {FOUNDATION_SOURCES.map((source) => (
        <ConnectionCard
          key={source}
          source={source}
          connection={connections.data?.connections.find((item) => item.source === source)}
          onConnect={source === 'APPLE_HEALTH' ? () => appleHealthSync.mutate() : undefined}
          onSync={source === 'APPLE_HEALTH' ? () => appleHealthSync.mutate() : undefined}
          onDisconnect={source === 'APPLE_HEALTH' ? () => appleHealthDisconnect.mutate() : undefined}
          onDelete={source === 'APPLE_HEALTH' ? () => setDeleteSource(source) : undefined}
          locale={preferredLocale}
          isActionPending={
            source === 'APPLE_HEALTH' &&
            (appleHealthSync.isPending || appleHealthDisconnect.isPending || deleteSyncedData.isPending)
          }
        />
      ))}

      {actionMessage ? <ContextNoteCard title={t('health.status')} message={actionMessage} /> : null}

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
      <AppFeedbackSheet
        visible={deleteSource !== null}
        title={t('health.deleteConfirm')}
        message={t('health.actionCannotUndo')}
        tone="danger"
        onClose={() => setDeleteSource(null)}
        actions={[
          {
            label: deleteSyncedData.isPending ? t('health.deleting') : t('health.deleteData'),
            variant: 'danger',
            disabled: deleteSyncedData.isPending,
            onPress: () => {
              if (deleteSource) deleteSyncedData.mutate(deleteSource);
            }
          },
          {
            label: t('common.cancel'),
            variant: 'secondary',
            disabled: deleteSyncedData.isPending,
            onPress: () => setDeleteSource(null)
          }
        ]}
      />
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

function HealthConnectionsSkeleton() {
  return (
    <Screen topSafeArea={false}>
      <View style={styles.skeletonHeader}>
        <View style={[styles.skeletonLine, styles.skeletonTitle]} />
        <View style={[styles.skeletonLine, styles.skeletonIntroWide]} />
        <View style={[styles.skeletonLine, styles.skeletonIntro]} />
      </View>

      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <View style={styles.skeletonProviderHeader}>
            <View style={styles.skeletonIcon} />
            <View style={styles.skeletonCopy}>
              <View style={[styles.skeletonLine, styles.skeletonProviderName]} />
              <View style={[styles.skeletonLine, styles.skeletonBodyWide]} />
              <View style={[styles.skeletonLine, styles.skeletonBody]} />
            </View>
            <View style={styles.skeletonPill} />
          </View>
          <View style={[styles.skeletonLine, styles.skeletonHelper]} />
          {item === 0 ? <View style={styles.skeletonButton} /> : null}
        </Card>
      ))}
    </Screen>
  );
}

function ConnectionCard({
  source,
  connection,
  onConnect,
  onSync,
  onDisconnect,
  onDelete,
  locale,
  isActionPending = false
}: {
  source: HealthProvider;
  connection?: HealthConnectionFoundation;
  onConnect?: () => void;
  onSync?: () => void;
  onDisconnect?: () => void;
  onDelete?: () => void;
  locale: string;
  isActionPending?: boolean;
}) {
  const { t } = useTranslation();
  const status = connection?.status ?? 'NOT_CONNECTED';
  const isConnected = status === 'CONNECTED';
  const needsAttention = status === 'NEEDS_REAUTH' || status === 'ERROR';

  return (
    <ProviderConnectionCard
      icon={getProviderIcon(source)}
      name={getProviderName(source, t)}
      statusLabel={getConnectionStatusLabel(status, t)}
      statusTone={isConnected ? 'success' : needsAttention ? 'danger' : 'neutral'}
      description={getConnectionBodyCopy(source, isConnected, t)}
      helper={getConnectionHelperCopy(source, isConnected, t)}
      lastSync={connection?.lastSyncAt ? t('health.lastSynced', { value: formatHealthTimestamp(connection.lastSyncAt, locale, t) }) : null}
    >
      <View
        accessible
        accessibilityLabel={t('health.connectionAccessibility', {
          provider: getProviderName(source, t),
          status: getConnectionStatusLabel(status, t)
        })}
      >
      </View>
      {source === 'APPLE_HEALTH' ? (
        <>
          {!isConnected ? <Text variant="muted">{t('health.appleHealthIosOnly')}</Text> : null}
          <View style={styles.actionRow}>
            {!isConnected ? (
              <Button
                title={isActionPending ? t('health.connecting') : t('health.connect')}
                disabled={isActionPending}
                accessibilityLabel={t('health.connectAppleHealth')}
                onPress={onConnect}
                style={styles.actionButton}
              />
            ) : (
              <Button
                title={isActionPending ? t('health.syncing') : t('health.sync')}
                disabled={isActionPending}
                accessibilityLabel={t('health.syncAppleHealth')}
                onPress={onSync}
                style={styles.actionButton}
              />
            )}
            {isConnected ? (
              <>
                <Button
                  title={t('health.disconnect')}
                  variant="secondary"
                  disabled={isActionPending}
                  accessibilityLabel={t('health.disconnectAppleHealth')}
                  onPress={onDisconnect}
                  style={styles.actionButton}
                />
                <Button
                  title={t('health.deleteData')}
                  variant="ghost"
                  disabled={isActionPending}
                  accessibilityLabel={t('health.deleteData')}
                  onPress={onDelete}
                  style={styles.actionButton}
                />
              </>
            ) : null}
          </View>
        </>
      ) : null}
    </ProviderConnectionCard>
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
      <View style={styles.healthWidgetGrid}>
        {getSnapshotMetrics(snapshot.snapshot, locale, t).map((metric) => (
          <HealthMetricWidget
            key={metric.label}
            label={metric.label}
            value={metric.value}
            unit={metric.unit}
            context={metric.context}
            comparisonLabel={metric.comparisonLabel}
            comparisonValue={metric.comparisonValue}
            progressPercent={'progressPercent' in metric ? metric.progressPercent : null}
            miniBars={'miniBars' in metric ? metric.miniBars : null}
            tone={metric.tone}
            icon={metric.icon}
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

function getProviderIcon(source: HealthProvider) {
  const color = source === 'APPLE_HEALTH'
    ? colors.health
    : source === 'HEALTH_CONNECT'
      ? colors.training
      : source === 'WHOOP'
        ? colors.recovery
        : colors.accent;

  if (source === 'APPLE_HEALTH') return <Apple size={23} color={color} />;
  if (source === 'HEALTH_CONNECT') return <HeartPulse size={23} color={color} />;
  if (source === 'WHOOP') return <Activity size={23} color={color} />;
  return <Watch size={23} color={color} />;
}

function getSnapshotMetrics(
  snapshot: NonNullable<WearableSnapshotResponse['snapshot']>,
  locale: string,
  t: TFunction
) {
  const baseMetrics = [
    snapshot.steps !== null
      ? {
          label: t('health.steps'),
          value: formatNumber(snapshot.steps, locale),
          unit: t('health.steps').toLowerCase(),
          context: t('todayDashboard.today'),
          comparisonLabel: t('health.lastSynced', { value: formatHealthTimestamp(snapshot.capturedAt, locale, t) }),
          comparisonValue: getHealthProviderLabel(t, snapshot.source),
          tone: 'activity' as const,
          icon: (accent: string) => <Footprints size={20} color={accent} />,
          miniBars: [0.35, 0.5, 0.42, 0.62, 0.48, 0.68, 0.78]
        }
      : null,
    snapshot.activeCaloriesKcal !== null
      ? {
          label: t('health.activeCalories'),
          value: formatNumber(snapshot.activeCaloriesKcal, locale),
          unit: 'kcal',
          context: t('todayDashboard.today'),
          comparisonLabel: t('health.lastSynced', { value: formatHealthTimestamp(snapshot.capturedAt, locale, t) }),
          comparisonValue: getHealthProviderLabel(t, snapshot.source),
          tone: 'nutrition' as const,
          icon: (accent: string) => <Flame size={20} color={accent} />,
          progressPercent: Math.min(100, Math.round((snapshot.activeCaloriesKcal / 600) * 100))
        }
      : null,
    snapshot.sleepMinutes !== null
      ? {
          label: t('health.sleepDuration'),
          value: formatSleep(snapshot.sleepMinutes, t),
          context: t('todayDashboard.yesterday'),
          comparisonLabel: t('health.lastSynced', { value: formatHealthTimestamp(snapshot.capturedAt, locale, t) }),
          comparisonValue: getHealthProviderLabel(t, snapshot.source),
          tone: 'sleep' as const,
          icon: (accent: string) => <Bed size={20} color={accent} />,
          progressPercent: Math.min(100, Math.round((snapshot.sleepMinutes / 480) * 100))
        }
      : null,
    snapshot.workoutMinutes !== null
      ? {
          label: t('health.workoutMinutes'),
          value: String(snapshot.workoutMinutes),
          unit: t('common.minutesShort'),
          context: t('todayDashboard.today'),
          comparisonLabel: t('health.lastSynced', { value: formatHealthTimestamp(snapshot.capturedAt, locale, t) }),
          comparisonValue: getHealthProviderLabel(t, snapshot.source),
          tone: 'training' as const,
          icon: (accent: string) => <Timer size={20} color={accent} />,
          progressPercent: Math.min(100, Math.round((snapshot.workoutMinutes / 60) * 100))
        }
      : null
  ].filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));

  if (snapshot.source === 'APPLE_HEALTH') {
    return baseMetrics;
  }

  return [
    ...baseMetrics,
    snapshot.recoveryScore !== null
      ? {
          label: t('health.recoveryScore'),
          value: formatNumber(snapshot.recoveryScore, locale),
          unit: '%',
          context: t('health.recovery'),
          comparisonLabel: t('health.lastSynced', { value: formatHealthTimestamp(snapshot.capturedAt, locale, t) }),
          comparisonValue: getHealthProviderLabel(t, snapshot.source),
          tone: 'recovery' as const,
          icon: (accent: string) => <HeartPulse size={20} color={accent} />,
          progressPercent: snapshot.recoveryScore
        }
      : null,
    snapshot.strainScore !== null
      ? {
          label: t('health.strain'),
          value: formatNumber(snapshot.strainScore, locale),
          context: t('health.activity'),
          comparisonLabel: t('health.lastSynced', { value: formatHealthTimestamp(snapshot.capturedAt, locale, t) }),
          comparisonValue: getHealthProviderLabel(t, snapshot.source),
          tone: 'training' as const,
          icon: (accent: string) => <Activity size={20} color={accent} />,
          progressPercent: Math.min(100, Math.round((snapshot.strainScore / 21) * 100))
        }
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
  healthWidgetGrid: {
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
  skeletonHeader: {
    gap: 12,
    paddingTop: 8
  },
  skeletonLine: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999
  },
  skeletonTitle: {
    height: 38,
    width: '78%'
  },
  skeletonIntroWide: {
    height: 14,
    width: '92%'
  },
  skeletonIntro: {
    height: 14,
    width: '68%'
  },
  skeletonProviderHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12
  },
  skeletonIcon: {
    backgroundColor: colors.healthMuted,
    borderRadius: 18,
    height: 48,
    width: 48
  },
  skeletonCopy: {
    flex: 1,
    gap: 8,
    paddingTop: 2
  },
  skeletonProviderName: {
    height: 18,
    width: '48%'
  },
  skeletonBodyWide: {
    height: 12,
    width: '86%'
  },
  skeletonBody: {
    height: 12,
    width: '62%'
  },
  skeletonPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 36,
    width: 112
  },
  skeletonHelper: {
    height: 12,
    width: '52%'
  },
  skeletonButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    height: 52,
    width: '100%'
  },
  successText: { color: colors.success, fontWeight: '700' },
  errorText: { color: colors.danger, fontWeight: '700' }
});
