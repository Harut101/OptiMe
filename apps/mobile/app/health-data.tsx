import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  connectHealthProvider,
  deleteHealthData,
  disconnectHealthProvider,
  getHealthStatus
} from '@/api/health';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import {
  FOUNDATION_HEALTH_PERMISSIONS,
  getPlatformHealthProvider
} from '@/features/health/health-platform';
import { nativeHealthService } from '@/features/health/native-health.service';
import { colors } from '@/theme/colors';
import { getHealthProviderLabel } from '@/i18n/enum-labels';

export default function HealthDataScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showPermissionExplanation, setShowPermissionExplanation] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const provider = getPlatformHealthProvider();
  const providerLabel = provider ? getHealthProviderLabel(t, provider) : t('health.title');
  const statusQuery = useQuery({
    queryKey: ['health-status'],
    queryFn: getHealthStatus
  });
  const connection = statusQuery.data?.connections.find((item) => item.provider === provider);
  const isConnected = connection?.status === 'CONNECTED';

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!provider) {
        throw new Error(t('errors.nativeHealthUnsupported'));
      }

      return connectHealthProvider({
        provider,
        permissionsGranted: FOUNDATION_HEALTH_PERMISSIONS
      });
    },
    onSuccess: async () => {
      setSuccessMessage(t('health.connectionEnabled', { provider: providerLabel }));
      setShowPermissionExplanation(false);
      await queryClient.invalidateQueries({ queryKey: ['health-status'] });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!provider) {
        throw new Error(t('errors.nativeHealthUnsupported'));
      }

      return disconnectHealthProvider({ provider });
    },
    onSuccess: async () => {
      setSuccessMessage(t('health.disconnectedMessage', { provider: providerLabel }));
      await queryClient.invalidateQueries({ queryKey: ['health-status'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!provider) {
        throw new Error(t('errors.nativeHealthUnsupported'));
      }

      return deleteHealthData({ provider });
    },
    onSuccess: async (result) => {
      setSuccessMessage(t('health.deletedCount', { count: result.summaryCountDeleted }));
      await queryClient.invalidateQueries({ queryKey: ['health-status'] });
    }
  });

  const syncMutation = useMutation({
    mutationFn: () => nativeHealthService.syncLast7Days(),
    onSuccess: async (result) => {
      setSuccessMessage(
        result.syncedDays > 0
          ? t('health.synced')
          : t('health.syncedEmpty')
      );
      await queryClient.invalidateQueries({ queryKey: ['health-status'] });
    }
  });

  const errorMessage =
    syncMutation.error?.message ??
    connectMutation.error?.message ??
    disconnectMutation.error?.message ??
    deleteMutation.error?.message ??
    (statusQuery.isError ? t('health.unavailable') : null);
  const isBusy =
    connectMutation.isPending ||
    disconnectMutation.isPending ||
    deleteMutation.isPending ||
    syncMutation.isPending;

  return (
    <Screen>
      <Text variant="heading">{t('health.title')}</Text>
      <Card>
        <Text variant="label">{providerLabel}</Text>
        <Text variant="body">
          {t('health.intro')}
        </Text>
        <Text variant="muted">
          {t('health.status')}:{' '}
          {statusQuery.isLoading ? t('common.loading') : formatHealthStatus(connection?.status, t)}
        </Text>
        <Text variant="muted">
          {t('health.nativeBuildHelp')}
        </Text>
      </Card>

      <Card>
        <Text variant="label">{t('health.sync')}</Text>
        <Text variant="muted">
          {t('health.syncHelp')}
        </Text>
        <Text variant="muted">
          {t('health.syncScope')}
        </Text>
        <Button
          title={syncMutation.isPending ? t('health.syncing') : t('health.sync')}
          disabled={isBusy || !provider}
          onPress={() => {
            setSuccessMessage(null);
            syncMutation.mutate();
          }}
        />
      </Card>

      {showPermissionExplanation || !isConnected ? (
        <Card>
          <Text variant="label">{t('health.beforeConnect')}</Text>
          <Text variant="muted">{t('health.explanation')}</Text>
          <View style={styles.actions}>
            <Button
              title={isBusy ? t('health.connecting') : t('health.continue')}
              disabled={isBusy || !provider}
              onPress={() => {
                setSuccessMessage(null);
                connectMutation.mutate();
              }}
            />
            <Button
              title={t('common.cancel')}
              variant="ghost"
              disabled={isBusy}
              onPress={() => {
                setShowPermissionExplanation(false);
                if (!isConnected) {
                  router.back();
                }
              }}
            />
          </View>
        </Card>
      ) : (
        <Card>
          <Text variant="label">{t('health.manage')}</Text>
          <Text variant="muted">{t('health.manageHelp')}</Text>
          <View style={styles.actions}>
            <Button
              title={isBusy ? t('health.disconnecting') : t('health.disconnect')}
              variant="secondary"
              disabled={isBusy}
              onPress={() => {
                setSuccessMessage(null);
                disconnectMutation.mutate();
              }}
            />
            <Button
              title={isBusy ? t('health.deleting') : t('health.deleteData')}
              variant="danger"
              disabled={isBusy}
              onPress={() => {
                setSuccessMessage(null);
                deleteMutation.mutate();
              }}
            />
          </View>
        </Card>
      )}

      {isConnected && !showPermissionExplanation ? (
        <Button
          title={t('health.review')}
          variant="ghost"
          onPress={() => setShowPermissionExplanation(true)}
        />
      ) : null}

      {successMessage ? (
        <Card>
          <Text variant="label">{t('health.updated')}</Text>
          <Text variant="muted">{successMessage}</Text>
        </Card>
      ) : null}

      {errorMessage ? (
        <Card>
          <Text variant="label" style={styles.errorText}>
            {t('health.unavailable')}
          </Text>
          <Text variant="muted">{errorMessage}</Text>
        </Card>
      ) : null}
    </Screen>
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
  if (status === 'CONNECTED') {
    return t('health.connected');
  }

  if (status === 'PERMISSION_DENIED') {
    return t('health.permissionDenied');
  }

  if (status === 'ERROR') {
    return t('health.syncError');
  }

  return t('health.notConnected');
}

const styles = StyleSheet.create({
  actions: {
    gap: 10
  },
  errorText: {
    color: colors.danger
  }
});
