import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Bed, Flame, Footprints, Timer } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HealthMetricWidget } from '@/components/HealthMetricWidget';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { formatNumber } from '@/i18n/formatters';
import { getHealthProviderLabel } from '@/i18n/enum-labels';
import { useTheme } from '@/theme/theme-provider';
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
  const { colors } = useTheme();
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
    <View style={styles.section}>
      <View
        accessible
        accessibilityLabel={`${t('todayDashboard.wearableSummary')}. ${formatSourceIncluded(source, t)}. ${formatLastSynced(snapshot.capturedAt, locale, t)}`}
        style={styles.sectionHeader}
      >
        <Text variant="heading" style={styles.sectionTitle}>
          {t('todayDashboard.wearableSummary')}
        </Text>
        <Text variant="muted">{formatSourceIncluded(source, t)}</Text>
      </View>
      <View style={styles.metricGrid}>
        <HealthMetricWidget
          label={t('todayDashboard.steps')}
          value={formatNullableNumber(snapshot.steps, locale)}
          unit={t('health.steps').toLowerCase()}
          context={formatLastSynced(snapshot.capturedAt, locale, t)}
          comparisonLabel={t('todayDashboard.wearableSummary')}
          comparisonValue={formatSourceIncluded(source, t)}
          tone="activity"
          icon={(accent) => <Footprints size={20} color={accent} />}
        />
        <HealthMetricWidget
          label={t('todayDashboard.sleep')}
          value={formatSleep(snapshot.sleepMinutes, t)}
          context={formatLastSynced(snapshot.capturedAt, locale, t)}
          comparisonLabel={t('todayDashboard.wearableSummary')}
          comparisonValue={formatSourceIncluded(source, t)}
          tone="sleep"
          icon={(accent) => <Bed size={20} color={accent} />}
        />
        <HealthMetricWidget
          label={t('todayDashboard.activeCalories')}
          value={formatNullableNumber(snapshot.activeCaloriesKcal, locale)}
          unit="kcal"
          context={formatLastSynced(snapshot.capturedAt, locale, t)}
          comparisonLabel={t('todayDashboard.wearableSummary')}
          comparisonValue={formatSourceIncluded(source, t)}
          tone="nutrition"
          icon={(accent) => <Flame size={20} color={accent} />}
        />
        <HealthMetricWidget
          label={t('todayDashboard.workoutMinutes')}
          value={snapshot.workoutMinutes === null ? '-' : String(snapshot.workoutMinutes)}
          unit={t('common.minutesShort')}
          context={formatLastSynced(snapshot.capturedAt, locale, t)}
          comparisonLabel={t('todayDashboard.wearableSummary')}
          comparisonValue={formatSourceIncluded(source, t)}
          tone="training"
          icon={(accent) => <Timer size={20} color={accent} />}
        />
      </View>
      <Text variant="muted" style={styles.metaText}>
        {t('todayDashboard.lastSynced', { value: formatLastSynced(snapshot.capturedAt, locale, t) })}
      </Text>
      {snapshot.isStale ? <Text style={[styles.stale, { color: colors.warning }]}>{t('health.wearableDataStale')}</Text> : null}
    </View>
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
  section: {
    gap: 10
  },
  sectionHeader: {
    gap: 3,
    paddingHorizontal: 2
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 27
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  metaText: {
    paddingHorizontal: 2
  },
  stale: {
    fontWeight: '700',
    paddingHorizontal: 2
  }
});
