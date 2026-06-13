import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
  getPlatformHealthProvider,
  getPlatformHealthProviderLabel
} from '@/features/health/health-platform';
import { nativeHealthService } from '@/features/health/native-health.service';
import { colors } from '@/theme/colors';

export default function HealthDataScreen() {
  const queryClient = useQueryClient();
  const [showPermissionExplanation, setShowPermissionExplanation] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const provider = getPlatformHealthProvider();
  const providerLabel = getPlatformHealthProviderLabel();
  const statusQuery = useQuery({
    queryKey: ['health-status'],
    queryFn: getHealthStatus
  });
  const connection = statusQuery.data?.connections.find((item) => item.provider === provider);
  const isConnected = connection?.status === 'CONNECTED';

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!provider) {
        throw new Error('Health data is not available on this platform yet.');
      }

      return connectHealthProvider({
        provider,
        permissionsGranted: FOUNDATION_HEALTH_PERMISSIONS
      });
    },
    onSuccess: async () => {
      setSuccessMessage(`${providerLabel} connection foundation is now enabled.`);
      setShowPermissionExplanation(false);
      await queryClient.invalidateQueries({ queryKey: ['health-status'] });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!provider) {
        throw new Error('Health data is not available on this platform yet.');
      }

      return disconnectHealthProvider({ provider });
    },
    onSuccess: async () => {
      setSuccessMessage(`${providerLabel} is disconnected. Synced summaries are kept until you delete them.`);
      await queryClient.invalidateQueries({ queryKey: ['health-status'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!provider) {
        throw new Error('Health data is not available on this platform yet.');
      }

      return deleteHealthData({ provider });
    },
    onSuccess: async (result) => {
      setSuccessMessage(`Deleted ${result.summaryCountDeleted} synced health summaries.`);
      await queryClient.invalidateQueries({ queryKey: ['health-status'] });
    }
  });

  const syncMutation = useMutation({
    mutationFn: () => nativeHealthService.syncLast7Days(),
    onSuccess: async (result) => {
      setSuccessMessage(
        result.syncedDays > 0
          ? 'Health summaries synced.'
          : 'Health sync completed. No daily summaries were available.'
      );
      await queryClient.invalidateQueries({ queryKey: ['health-status'] });
    }
  });

  const errorMessage =
    syncMutation.error?.message ??
    connectMutation.error?.message ??
    disconnectMutation.error?.message ??
    deleteMutation.error?.message ??
    (statusQuery.isError ? 'Health status is unavailable right now.' : null);
  const isBusy =
    connectMutation.isPending ||
    disconnectMutation.isPending ||
    deleteMutation.isPending ||
    syncMutation.isPending;

  return (
    <Screen>
      <Text variant="heading">Health data</Text>
      <Card>
        <Text variant="label">{providerLabel}</Text>
        <Text variant="body">
          Health data is optional. Later, OptiMe can use daily summaries like steps, sleep,
          workouts, and activity to make plans more aware of your day.
        </Text>
        <Text variant="muted">
          Current status:{' '}
          {statusQuery.isLoading ? 'Checking...' : formatHealthStatus(connection?.status)}
        </Text>
        <Text variant="muted">
          Native sync requires a development build with health support. Expo Go will show a safe
          unavailable message.
        </Text>
      </Card>

      <Card>
        <Text variant="label">Sync now</Text>
        <Text variant="muted">
          In a development build, OptiMe can request permission for steps, sleep, workouts, and
          activity, then sync daily summaries for the last 7 days.
        </Text>
        <Text variant="muted">
          Weight, heart rate, and resting heart rate stay off in this spike.
        </Text>
        <Button
          title={syncMutation.isPending ? 'Syncing...' : 'Sync now'}
          disabled={isBusy || !provider}
          onPress={() => {
            setSuccessMessage(null);
            syncMutation.mutate();
          }}
        />
      </Card>

      {showPermissionExplanation || !isConnected ? (
        <Card>
          <Text variant="label">Before you connect</Text>
          <Text variant="muted">Health data is optional and you can disconnect anytime.</Text>
          <Text variant="muted">
            OptiMe stores daily summaries first, not raw samples by default.
          </Text>
          <Text variant="muted">
            Data is used only to improve plan personalization later. This is not medical advice.
          </Text>
          <Text variant="muted">
            You can delete synced health data without deleting your account.
          </Text>
          <View style={styles.actions}>
            <Button
              title={isBusy ? 'Connecting...' : 'Continue'}
              disabled={isBusy || !provider}
              onPress={() => {
                setSuccessMessage(null);
                connectMutation.mutate();
              }}
            />
            <Button
              title="Cancel"
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
          <Text variant="label">Manage connection</Text>
          <Text variant="muted">
            You are connected at the foundation level. Real native health sync will come in a later
            development build through Sync now.
          </Text>
          <Text variant="muted">
            Disconnecting stops future use. It does not delete stored summaries.
          </Text>
          <View style={styles.actions}>
            <Button
              title={isBusy ? 'Disconnecting...' : 'Disconnect'}
              variant="secondary"
              disabled={isBusy}
              onPress={() => {
                setSuccessMessage(null);
                disconnectMutation.mutate();
              }}
            />
            <Button
              title={isBusy ? 'Deleting...' : 'Delete synced health data'}
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
          title="Review connection explanation"
          variant="ghost"
          onPress={() => setShowPermissionExplanation(true)}
        />
      ) : null}

      {successMessage ? (
        <Card>
          <Text variant="label">Updated</Text>
          <Text variant="muted">{successMessage}</Text>
        </Card>
      ) : null}

      {errorMessage ? (
        <Card>
          <Text variant="label" style={styles.errorText}>
            Health data unavailable
          </Text>
          <Text variant="muted">{errorMessage}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

function formatHealthStatus(status?: string) {
  if (status === 'CONNECTED') {
    return 'Connected';
  }

  if (status === 'PERMISSION_DENIED') {
    return 'Permission denied';
  }

  if (status === 'ERROR') {
    return 'Sync error';
  }

  return 'Not connected';
}

const styles = StyleSheet.create({
  actions: {
    gap: 10
  },
  errorText: {
    color: colors.danger
  }
});
