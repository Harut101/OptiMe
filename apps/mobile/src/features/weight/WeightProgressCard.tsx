import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MeasurementSystem } from '@optime/shared-types';

import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { formatDate, formatNumber, formatPercentage, formatWeight } from '@/i18n/formatters';
import { themeColorsByMode, type ThemeMode } from '@/theme/colors';
import type { WeightSummary } from '@/types/api';
import { getWeightUnit, toDisplayWeight } from './weight-format';

interface WeightProgressCardProps {
  summary?: WeightSummary | null;
  locale: string;
  measurementSystem: MeasurementSystem;
  compact?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  appearance?: ThemeMode;
  onUpdate: () => void;
}

export function WeightProgressCard({
  summary,
  locale,
  measurementSystem,
  compact = false,
  isLoading,
  isError,
  appearance = 'light',
  onUpdate
}: WeightProgressCardProps) {
  const { t } = useTranslation();
  const palette = themeColorsByMode[appearance];
  const isDark = appearance === 'dark';
  const accent = isDark ? '#A7F20D' : palette.success;
  const buttonColor = isDark ? '#9BE80E' : accent;

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
        <UpdateButton
          title={t('weight.updateWeight')}
          color={buttonColor}
          textColor={palette.textInverse}
          onPress={onUpdate}
        />
      </Card>
    );
  }

  const hasCurrent = summary?.currentWeightKg !== null && summary?.currentWeightKg !== undefined;
  const hasTarget = summary?.targetWeightKg !== null && summary?.targetWeightKg !== undefined;
  const current = hasCurrent ? formatWeight(summary.currentWeightKg!, locale, measurementSystem) : t('weight.noCurrentWeight');
  const target = hasTarget ? formatWeight(summary.targetWeightKg!, locale, measurementSystem) : t('weight.noTargetWeight');
  const currentValue = hasCurrent
    ? formatNumber(toDisplayWeight(summary.currentWeightKg!, measurementSystem), locale, { maximumFractionDigits: 1 })
    : '--';
  const currentUnit = hasCurrent ? getWeightUnit(measurementSystem) : '';
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
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.widget,
        compact ? styles.compactWidget : styles.fullWidget,
        {
          backgroundColor: isDark ? palette.card : palette.surfaceElevated,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(209, 209, 214, 0.72)',
          shadowColor: isDark ? '#000000' : palette.textPrimary,
          shadowOpacity: isDark ? 0.22 : 0.1
        }
      ]}
    >
      <View style={styles.topRow}>
        <Text variant="label" style={[styles.title, { color: accent }]}>{t('weight.progressTitle')}</Text>
        {summary?.safetyStatus === 'LIMITED' ? (
          <StatusPill label={t('weight.safetyLimited')} tone="warning" />
        ) : null}
      </View>

      <View style={styles.heroRow}>
        <Text style={[styles.heroValue, { color: accent }]}>{currentValue}</Text>
        {currentUnit ? <Text style={[styles.heroUnit, { color: palette.textSecondary }]}>{currentUnit}</Text> : null}
      </View>

      <View style={styles.statRow}>
        <Metric label={t('weight.currentWeight')} value={current} textColor={palette.textPrimary} mutedColor={palette.textSecondary} />
        <Metric label={t('weight.targetWeight')} value={target} textColor={palette.textPrimary} mutedColor={palette.textSecondary} />
      </View>

      {hasCurrent && hasTarget && remaining ? (
        <Text style={[styles.supportingText, { color: palette.textSecondary }]}>
          {t('weight.remainingToGoal', { value: remaining })}
          {progress ? ` · ${t('weight.progressPercent', { value: progress })}` : ''}
        </Text>
      ) : (
        <Text style={[styles.supportingText, { color: palette.textSecondary }]}>{hasCurrent ? t('weight.setTargetHint') : t('weight.addCurrentHint')}</Text>
      )}
      <Text style={[styles.lastUpdated, { color: palette.textMuted }]}>{lastUpdated}</Text>

      <UpdateButton
        title={hasCurrent ? t('weight.updateWeight') : t('weight.addWeight')}
        color={buttonColor}
        textColor={palette.textInverse}
        onPress={onUpdate}
      />
    </View>
  );
}

function Metric({
  label,
  value,
  textColor,
  mutedColor
}: {
  label: string;
  value: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: textColor }]}>{value}</Text>
    </View>
  );
}

function UpdateButton({
  title,
  color,
  textColor,
  onPress
}: {
  title: string;
  color: string;
  textColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.updateButton,
        { backgroundColor: color },
        pressed ? styles.updateButtonPressed : null
      ]}
    >
      <Text style={[styles.updateButtonText, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  widget: {
    borderRadius: 26,
    borderWidth: 1,
    gap: 10,
    overflow: 'hidden',
    padding: 18,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 26,
    elevation: 4
  },
  compactWidget: {
    minHeight: 208,
    width: '100%'
  },
  fullWidget: {
    width: '100%'
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  heroRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6
  },
  heroValue: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -2.4,
    lineHeight: 54
  },
  heroUnit: {
    fontSize: 13,
    fontWeight: '900',
    paddingBottom: 8
  },
  statRow: {
    flexDirection: 'row',
    gap: 14
  },
  metric: {
    flexShrink: 1,
    gap: 2
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase'
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '900'
  },
  supportingText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16
  },
  lastUpdated: {
    fontSize: 11,
    fontWeight: '700'
  },
  updateButton: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16
  },
  updateButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }]
  },
  updateButtonText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2
  }
});
