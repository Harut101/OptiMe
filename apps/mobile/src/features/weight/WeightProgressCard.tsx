import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MeasurementSystem } from '@optime/shared-types';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { formatNumber, formatWeight } from '@/i18n/formatters';
import { themeColorsByMode, type ThemeMode } from '@/theme/colors';
import { useTheme } from '@/theme/theme-provider';
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
  appearance,
  onUpdate
}: WeightProgressCardProps) {
  const { t } = useTranslation();
  const { colors: runtimeColors, mode } = useTheme();
  const palette = appearance ? themeColorsByMode[appearance] : runtimeColors;
  const isDark = appearance ? appearance === 'dark' : mode === 'dark';
  const accent = isDark ? '#A7F20D' : palette.success;
  const buttonColor = isDark ? '#9BE80E' : accent;

  if (isLoading) {
    return (
      <Card>
        <Text variant="label" style={[styles.loadingTitle, { color: accent }]}>{t('weight.progressTitle')}</Text>
        <Text variant="muted">{t('common.loading')}</Text>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <Text variant="label" style={[styles.loadingTitle, { color: accent }]}>{t('weight.progressTitle')}</Text>
        <Text variant="muted">{t('weight.unavailable')}</Text>
        <UpdateButton
          title={t('weight.updateWeight')}
          color={buttonColor}
          textColor={palette.textOnAccent}
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
  const displayUnit = getWeightUnit(measurementSystem);
  const currentUnit = hasCurrent ? displayUnit : '';
  const targetValue = hasTarget
    ? formatNumber(toDisplayWeight(summary.targetWeightKg!, measurementSystem), locale, { maximumFractionDigits: 1 })
    : null;
  const remaining =
    summary?.remainingToGoalKg !== null && summary?.remainingToGoalKg !== undefined
      ? formatWeight(summary.remainingToGoalKg, locale, measurementSystem)
      : null;
  const relation = getTargetRelation(summary?.currentWeightKg ?? null, summary?.targetWeightKg ?? null);
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
        <Text variant="label" style={[styles.title, { color: accent }]}>
          {targetValue ? `${t('weight.targetWeight')} ${targetValue} ${displayUnit}` : t('weight.progressTitle')}
        </Text>
        {summary?.safetyStatus === 'LIMITED' ? (
          <StatusPill label={t('weight.safetyLimited')} tone="warning" />
        ) : null}
      </View>

      <View style={styles.heroRow}>
        <Text style={[styles.heroValue, { color: accent }]}>{currentValue}</Text>
        {currentUnit ? <Text style={[styles.heroUnit, { color: palette.textSecondary }]}>{currentUnit}</Text> : null}
        {relation ? <TargetArrow relation={relation} color={palette.health} mutedColor={palette.textMuted} /> : null}
      </View>

      <Text style={[styles.supportingText, { color: palette.textSecondary }]}>
        {hasCurrent && hasTarget && remaining
          ? t('weight.remainingToGoal', { value: remaining })
          : hasCurrent
            ? t('weight.noTargetWeight')
            : t('weight.addCurrentHint')}
      </Text>

      <UpdateButton
        title={hasCurrent ? t('weight.updateWeight') : t('weight.addWeight')}
        color={buttonColor}
        textColor={palette.textOnAccent}
        onPress={onUpdate}
      />
    </View>
  );
}

function TargetArrow({
  relation,
  color,
  mutedColor
}: {
  relation: 'above' | 'below' | 'at';
  color: string;
  mutedColor: string;
}) {
  const icon = relation === 'above'
    ? <ArrowUp size={18} color={color} strokeWidth={3} />
    : relation === 'below'
      ? <ArrowDown size={18} color={color} strokeWidth={3} />
      : <Minus size={18} color={mutedColor} strokeWidth={3} />;

  return <View style={styles.targetArrow}>{icon}</View>;
}

function getTargetRelation(currentWeightKg: number | null, targetWeightKg: number | null) {
  if (currentWeightKg === null || targetWeightKg === null) {
    return null;
  }

  const difference = currentWeightKg - targetWeightKg;
  if (Math.abs(difference) < 0.2) {
    return 'at' as const;
  }

  return difference > 0 ? 'above' as const : 'below' as const;
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
  loadingTitle: {
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  widget: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 8,
    overflow: 'hidden',
    padding: 20,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 26,
    elevation: 4
  },
  compactWidget: {
    minHeight: 188,
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
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase'
  },
  heroRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 7
  },
  heroValue: {
    fontSize: 54,
    fontWeight: '600',
    letterSpacing: -2.8,
    lineHeight: 58
  },
  heroUnit: {
    fontSize: 13,
    fontWeight: '600',
    paddingBottom: 8
  },
  targetArrow: {
    marginBottom: 12
  },
  supportingText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 19
  },
  updateButton: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 44,
    paddingHorizontal: 16
  },
  updateButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }]
  },
  updateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2
  }
});
