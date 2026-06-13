import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Href, router } from 'expo-router';

import { getEntitlements, getUsageSummary } from '@/api/account';
import { getHealthStatus } from '@/api/health';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import {
  getPlatformHealthProvider,
  getPlatformHealthProviderLabel
} from '@/features/health/health-platform';
import { WELLNESS_DISCLAIMER } from '@/features/safety/safety-copy';
import { useAuthStore } from '@/store/auth-store';

const HEALTH_DATA_ROUTE = '/health-data' as Href;

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const entitlements = useQuery({
    queryKey: ['entitlements'],
    queryFn: getEntitlements
  });
  const usage = useQuery({
    queryKey: ['usage-summary'],
    queryFn: getUsageSummary
  });
  const healthStatus = useQuery({
    queryKey: ['health-status'],
    queryFn: getHealthStatus
  });
  const healthProvider = getPlatformHealthProvider();
  const healthProviderLabel = getPlatformHealthProviderLabel();
  const platformConnection = healthStatus.data?.connections.find(
    (connection) => connection.provider === healthProvider
  );
  const generationUsage = usage.data?.items.find(
    (item) => item.feature === 'DAILY_PLAN_GENERATION'
  );
  const refreshUsage = usage.data?.items.find((item) => item.feature === 'DAILY_PLAN_REFRESH');

  return (
    <Screen>
      <Text variant="heading">Profile</Text>
      <Card>
        <Text variant="label">Account</Text>
        <Text variant="body">{user?.email ?? 'Signed in'}</Text>
      </Card>
      <Card>
        <Text variant="label">Plan</Text>
        {entitlements.isError ? (
          <Text variant="muted">Plan details unavailable</Text>
        ) : (
          <>
            <Text variant="body">
              Current plan: {formatPlan(entitlements.data?.currentPlan ?? 'FREE')}
            </Text>
            <Text variant="muted">
              Plan quality: {formatPlanQuality(entitlements.data?.planQualityMode ?? 'BASIC')}
            </Text>
            <Text variant="muted">
              Daily plan limit: {formatUsageLimit(generationUsage)}
            </Text>
            <Text variant="muted">Refresh limit: {formatUsageLimit(refreshUsage)}</Text>
            <Text variant="muted">Upgrade options coming soon.</Text>
          </>
        )}
      </Card>
      <Card>
        <Text variant="label">Health data</Text>
        <Text variant="body">
          Connect health data later to help OptiMe adapt plans using steps, sleep, workouts, and
          activity.
        </Text>
        <Text variant="muted">Provider: {healthProviderLabel}</Text>
        <Text variant="muted">
          Status:{' '}
          {healthStatus.isLoading
            ? 'Checking...'
            : healthStatus.isError
              ? 'Health details unavailable'
              : formatHealthStatus(platformConnection?.status)}
        </Text>
        <Text variant="muted">
          Optional. This foundation does not request native health permissions or sync real health
          data yet.
        </Text>
        <Button
          title={platformConnection?.status === 'CONNECTED' ? 'Manage' : 'Connect'}
          variant="secondary"
          onPress={() => router.push(HEALTH_DATA_ROUTE)}
        />
      </Card>
      <Card>
        <Text variant="label">Safety</Text>
        <Text variant="body">{user?.safeMode ? 'Safe mode is active.' : 'Standard wellness mode is active.'}</Text>
        <Text variant="muted">Age-aware safety is managed by the backend from your date of birth.</Text>
        <Text variant="muted">{WELLNESS_DISCLAIMER}</Text>
      </Card>
      <Button
        title="Log out"
        variant="secondary"
        onPress={async () => {
          await clearSession();
          queryClient.clear();
          router.replace('/(auth)/welcome');
        }}
      />
    </Screen>
  );
}

function formatPlan(plan: string) {
  return plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();
}

function formatPlanQuality(mode: string) {
  if (mode === 'PERSONALIZED') {
    return 'Personalized';
  }

  if (mode === 'ADAPTIVE') {
    return 'Adaptive';
  }

  return 'Basic';
}

function formatUsageLimit(item?: { limit: number; periodType: string }) {
  if (!item) {
    return 'Plan details unavailable';
  }

  return `${item.limit}/${item.periodType.toLowerCase() === 'daily' ? 'day' : 'period'}`;
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
