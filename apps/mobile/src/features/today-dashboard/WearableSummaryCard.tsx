import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { MetricCard } from '@/components/MetricCard';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { formatNumber } from '@/i18n/formatters';
import { getHealthProviderLabel } from '@/i18n/enum-labels';
import { colors } from '@/theme/colors';
import type {
  HealthDataSource,
  HealthConnectionFoundation,
  WearableSnapshotResponse
} from '@/types/api';

interface WearableSummaryCardProps {
  wearable?: WearableSnapshotResponse;
  connections?: HealthConnectionFoundation[];
  locale: string;
  onOpenHealth: () => void;
}

export function WearableSummaryCard({
  wearable,
  connections,
  locale,
  onOpenHealth
}: WearableSummaryCardProps) {
  const { t } = useTranslation();
  const snapshot = wearable?.snapshot ?? null;
  const connectedSource = connections?.find((connection) => connection.status === 'CONNECTED')?.source ?? null;
  const source = snapshot?.source ?? connectedSource;

  if (!snapshot) {
    return (
      <Card>
        <SectionHeader title={t('todayDashboard.wearableSummary')} subtitle={t('todayDashboard.noWearableData')} />
        <Text variant="muted">{t('todayDashboard.connectAppleHealth')}</Text>
        <Button title={t('health.manage')} variant="secondary" onPress={onOpenHealth} />
      </Card>
    );
  }

  return (
    <Card>
      <View
        accessible
        accessibilityLabel={`${t('todayDashboard.wearableSummary')}. ${formatSourceIncluded(source, t)}. ${formatLastSynced(snapshot.capturedAt, locale, t)}`}
      >
        <SectionHeader
          title={t('todayDashboard.wearableSummary')}
          subtitle={formatSourceIncluded(source, t)}
        />
      </View>
      <View style={styles.metricGrid}>
        <MetricCard
          label={t('todayDashboard.steps')}
          value={formatNullableNumber(snapshot.steps, locale)}
          tone="health"
        />
        <MetricCard
          label={t('todayDashboard.sleep')}
          value={formatSleep(snapshot.sleepMinutes, t)}
          tone="recovery"
        />
        <MetricCard
          label={t('todayDashboard.activeCalories')}
          value={formatNullableKcal(snapshot.activeCaloriesKcal, locale, t)}
          tone="nutrition"
        />
        <MetricCard
          label={t('todayDashboard.workoutMinutes')}
          value={formatNullableMinutes(snapshot.workoutMinutes, t)}
          tone="training"
        />
      </View>
      <Text variant="muted">{t('todayDashboard.lastSynced', { value: formatLastSynced(snapshot.capturedAt, locale, t) })}</Text>
      {snapshot.isStale ? <Text style={styles.stale}>{t('health.wearableDataStale')}</Text> : null}
    </Card>
  );
}

function formatSourceIncluded(
  source: HealthDataSource | null,
  t: TFunction
) {
  if (!source) return t('todayDashboard.healthDataIncluded');
  if (source === 'APPLE_HEALTH') return t('todayDashboard.appleHealthIncluded');
  return t('todayDashboard.sourceIncluded', { source: getHealthProviderLabel(t, source) });
}

function formatNullableNumber(value: number | null, locale: string) {
  return value === null ? '-' : formatNumber(value, locale);
}

function formatNullableKcal(value: number | null, locale: string, t: TFunction) {
  return value === null ? '-' : t('todayDashboard.kcalValue', { value: formatNumber(value, locale) });
}

function formatNullableMinutes(value: number | null, t: TFunction) {
  return value === null ? '-' : t('todayDashboard.minuteValue', { value: String(value) });
}

function formatSleep(value: number | null, t: TFunction) {
  if (value === null) return '-';
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours > 0
    ? t('todayDashboard.sleepValue', { hours: String(hours), minutes: String(minutes) })
    : t('todayDashboard.minuteValue', { value: String(minutes) });
}

function formatLastSynced(value: string, locale: string, t: TFunction) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('health.notSynced');
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameLocalDay(date, today)) return t('todayDashboard.today');
  if (isSameLocalDay(date, yesterday)) return t('todayDashboard.yesterday');

  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function isSameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  stale: {
    color: colors.warning,
    fontWeight: '700'
  }
});
