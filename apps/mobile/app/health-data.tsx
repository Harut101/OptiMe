import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import {
  createMockWearableSnapshot,
  getHealthConnections,
  getTodayWearableSnapshot
} from '@/api/health';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { getHealthProviderLabel } from '@/i18n/enum-labels';
import { colors } from '@/theme/colors';
import type { HealthConnectionFoundation, HealthProvider, WearableSnapshotResponse } from '@/types/api';

const FOUNDATION_SOURCES: HealthProvider[] = ['APPLE_HEALTH', 'HEALTH_CONNECT', 'WHOOP'];

export default function HealthDataScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
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
      <Text variant="heading">{t('health.connectionsTitle')}</Text>
      <Text variant="muted">{t('health.connectionsIntro')}</Text>
      <Text variant="muted">{t('health.optional')}</Text>

      {FOUNDATION_SOURCES.map((source) => (
        <ConnectionCard
          key={source}
          source={source}
          connection={connections.data?.connections.find((item) => item.source === source)}
        />
      ))}

      <WearableSnapshotCard
        snapshot={snapshot.data}
        isUnavailable={snapshot.isError}
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
        {actionMessage ? <Text variant="muted">{actionMessage}</Text> : null}
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
        <Card>
          <Text variant="label" style={styles.errorText}>{t('health.unavailable')}</Text>
          <Text variant="muted">{t('errors.unableLoad')}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

function ConnectionCard({
  source,
  connection
}: {
  source: HealthProvider;
  connection?: HealthConnectionFoundation;
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
        <Text variant="label">{getProviderName(source, t)}</Text>
        <Text style={[
          styles.statusPill,
          isConnected ? styles.connectedPill : null,
          needsAttention ? styles.attentionPill : null
        ]}>
          {getConnectionStatusLabel(status, t)}
        </Text>
      </View>
      </View>
      <Text variant="body">{getProviderDescription(source, t)}</Text>
      <Text variant="muted">
        {isConnected ? t('health.wearableDataConnected') : t('health.comingSoon')}
      </Text>
      {connection?.lastSyncAt ? (
        <Text variant="muted">{t('health.lastSynced', { value: connection.lastSyncAt })}</Text>
      ) : null}
    </Card>
  );
}

function WearableSnapshotCard({
  snapshot,
  isUnavailable
}: {
  snapshot?: WearableSnapshotResponse;
  isUnavailable: boolean;
}) {
  const { t } = useTranslation();

  if (isUnavailable) {
    return (
      <Card>
        <Text variant="label">{t('health.wearableSnapshot')}</Text>
        <Text variant="muted">{t('health.noRecentWearableData')}</Text>
      </Card>
    );
  }

  if (!snapshot?.snapshot) {
    return (
      <Card>
        <Text variant="label">{t('health.wearableSnapshot')}</Text>
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
      <Text variant="label">{t('health.wearableSnapshot')}</Text>
      </View>
      <Text variant="body">
        {snapshot.snapshot.isStale ? t('health.wearableDataStale') : t('health.wearableDataConnected')}
      </Text>
      <Text variant="muted">{getHealthProviderLabel(t, snapshot.snapshot.source)} · {snapshot.snapshot.localDate}</Text>
      <View style={styles.metricGrid}>
        <Metric label={t('health.steps')} value={snapshot.snapshot.steps} />
        <Metric label={t('health.activeCalories')} value={snapshot.snapshot.activeCaloriesKcal} />
        <Metric label={t('health.sleepDuration')} value={snapshot.snapshot.sleepMinutes} />
        <Metric label={t('health.recoveryScore')} value={snapshot.snapshot.recoveryScore} />
        <Metric label={t('health.strain')} value={snapshot.snapshot.strainScore} />
      </View>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.metric}>
      <Text variant="muted">{label}</Text>
      <Text variant="body">{value === null ? '-' : String(value)}</Text>
    </View>
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
  return t('health.whoopDescription');
}

function getProviderName(source: HealthProvider, t: TFunction) {
  if (source === 'HEALTH_CONNECT') return t('health.healthConnect');
  return getHealthProviderLabel(t, source);
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center'
  },
  statusPill: {
    color: colors.ink,
    backgroundColor: '#F1EEE8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontWeight: '800'
  },
  connectedPill: {
    color: colors.primaryDark,
    backgroundColor: '#e7f3ef'
  },
  attentionPill: {
    color: colors.danger,
    backgroundColor: '#FFE8EE'
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  metric: {
    minWidth: '45%',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 10,
    gap: 3
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
