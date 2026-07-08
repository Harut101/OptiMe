import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MeasurementSystem } from '@optime/shared-types';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { formatDate, formatPercentage, formatWeight } from '@/i18n/formatters';
import { colors } from '@/theme/colors';
import type { WeightSummary } from '@/types/api';

interface WeightProgressCardProps {
  summary?: WeightSummary | null;
  locale: string;
  measurementSystem: MeasurementSystem;
  compact?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onUpdate: () => void;
}

export function WeightProgressCard({
  summary,
  locale,
  measurementSystem,
  compact = false,
  isLoading,
  isError,
  onUpdate
}: WeightProgressCardProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Card>
        <SectionHeader title={t('weight.progressTitle')} />
        <Text variant="muted">{t('common.loading')}</Text>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <SectionHeader title={t('weight.progressTitle')} />
        <Text variant="muted">{t('weight.unavailable')}</Text>
        <Button title={t('weight.updateWeight')} variant="secondary" onPress={onUpdate} />
      </Card>
    );
  }

  const hasCurrent = summary?.currentWeightKg !== null && summary?.currentWeightKg !== undefined;
  const hasTarget = summary?.targetWeightKg !== null && summary?.targetWeightKg !== undefined;
  const current = hasCurrent ? formatWeight(summary.currentWeightKg!, locale, measurementSystem) : t('weight.noCurrentWeight');
  const target = hasTarget ? formatWeight(summary.targetWeightKg!, locale, measurementSystem) : t('weight.noTargetWeight');
  const remaining =
    summary?.remainingToGoalKg !== null && summary?.remainingToGoalKg !== undefined
      ? formatWeight(summary.remainingToGoalKg, locale, measurementSystem)
      : null;
  const progress =
    summary?.progressPercent !== null && summary?.progressPercent !== undefined
      ? formatPercentage(summary.progressPercent / 100, locale)
      : null;
  const lastUpdated = summary?.lastUpdatedAt
    ? t('weight.lastUpdatedValue', { value: formatDate(summary.lastUpdatedAt, locale) })
    : t('weight.noWeightEntries');
  const accessibilityLabel = [
    t('weight.progressTitle'),
    t('weight.currentValue', { value: current }),
    hasTarget ? t('weight.targetValue', { value: target }) : t('weight.noTargetWeight')
  ].join('. ');

  return (
    <Card>
      <View accessible accessibilityLabel={accessibilityLabel} style={styles.content}>
        <SectionHeader title={t('weight.progressTitle')} />
        {summary?.safetyStatus === 'LIMITED' ? (
          <StatusPill label={t('weight.safetyLimited')} tone="warning" />
        ) : null}
        <View style={compact ? styles.compactRow : styles.row}>
          <Metric label={t('weight.currentWeight')} value={current} />
          <Metric label={t('weight.targetWeight')} value={target} />
        </View>
        {hasCurrent && hasTarget && remaining ? (
          <Text variant="muted">
            {t('weight.remainingToGoal', { value: remaining })}
            {progress ? ` · ${t('weight.progressPercent', { value: progress })}` : ''}
          </Text>
        ) : (
          <Text variant="muted">{hasCurrent ? t('weight.setTargetHint') : t('weight.addCurrentHint')}</Text>
        )}
        <Text variant="muted">{lastUpdated}</Text>
        <Button title={hasCurrent ? t('weight.updateWeight') : t('weight.addWeight')} variant="secondary" onPress={onUpdate} />
      </View>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text variant="muted">{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  compactRow: {
    flexDirection: 'row',
    gap: 10
  },
  metric: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    backgroundColor: colors.cardMuted,
    gap: 4
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary
  }
});
