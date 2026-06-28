import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type {
  NutritionTarget,
  NutritionTargetReason,
  NutritionTargetSnapshot
} from '@optime/shared-types';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';

type TargetLike = NutritionTarget | NutritionTargetSnapshot;

export function NutritionTargetSummaryCard({
  target,
  isUnavailable = false
}: {
  target?: TargetLike | null;
  isUnavailable?: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (isUnavailable) {
    return (
      <Card>
        <Text variant="label">{t('nutritionTargets.title')}</Text>
        <Text variant="muted">{t('nutritionTargets.unavailable')}</Text>
      </Card>
    );
  }

  if (!target) return null;

  const summary = toTargetSummary(target);
  const needsMoreInfo = summary.safetyStatus === 'NEEDS_MORE_INFO' || summary.targetKcal <= 0;
  const translate = t as unknown as Translate;
  const explanation = localizeExplanation(summary.explanation, translate);

  return (
    <Card>
      <View style={styles.header}>
        <View>
          <Text variant="label">{t('nutritionTargets.title')}</Text>
          <Text variant="heading">
            {needsMoreInfo
              ? t('nutritionTargets.needsMoreInfo')
              : t('nutritionTargets.kcal', { count: summary.targetKcal })}
          </Text>
        </View>
        <View style={[styles.badge, needsMoreInfo ? styles.badgeLimited : null]}>
          <Text style={styles.badgeText}>{t(`nutritionTargets.status.${summary.safetyStatus}` as never)}</Text>
        </View>
      </View>

      <Text variant="muted">{t(`nutritionTargets.dayType.${summary.dayType}` as never)}</Text>

      {!needsMoreInfo ? (
        <View style={styles.macroRow}>
          <Macro label={t('today.protein')} value={`${summary.proteinGrams}g`} />
          <Macro label={t('today.carbs')} value={`${summary.carbsGrams}g`} />
          <Macro label={t('today.fat')} value={`${summary.fatGrams}g`} />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('nutritionTargets.why')}
        onPress={() => setExpanded((value) => !value)}
        style={styles.whyButton}
      >
        <Text variant="label">{expanded ? t('nutritionTargets.hideWhy') : t('nutritionTargets.why')}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.explanation}>
          <Text variant="body">{explanation.title}</Text>
          {explanation.bullets.map((bullet) => (
            <Text key={bullet} variant="muted">- {bullet}</Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function localizeExplanation(
  explanation: NutritionTarget['explanation'] | LegacyNutritionTargetExplanation,
  t: Translate
) {
  if (isCodedExplanation(explanation)) {
    return {
      title: t(`nutritionTargets.titleCodes.${explanation.titleCode}` as never),
      bullets: explanation.reasonCodes.map((reason) => localizeReason(reason, t))
    };
  }

  return explanation;
}

function localizeReason(reason: NutritionTargetReason, t: Translate) {
  const params = reason.params ?? {};
  const missingFields = params.missingFields?.map((field) =>
    t(`nutritionTargets.missingFields.${field}` as never)
  );
  const primaryGoal = params.primaryGoal
    ? t(`nutritionTargets.primaryGoals.${params.primaryGoal}` as never)
    : undefined;

  return t(`nutritionTargets.reasons.${reason.code}` as never, {
    ...params,
    primaryGoal,
    missingFields: formatList(missingFields ?? [])
  });
}

function formatList(items: string[]) {
  return items.join(', ');
}

function isCodedExplanation(
  explanation: NutritionTarget['explanation'] | LegacyNutritionTargetExplanation
): explanation is NutritionTarget['explanation'] {
  return 'titleCode' in explanation && Array.isArray(explanation.reasonCodes);
}

interface LegacyNutritionTargetExplanation {
  title: string;
  bullets: string[];
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.macro}>
      <Text variant="label">{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

function toTargetSummary(target: TargetLike) {
  if ('calories' in target) {
    return {
      dayType: target.dayType,
      targetKcal: target.calories.targetKcal,
      proteinGrams: target.macros.proteinGrams,
      carbsGrams: target.macros.carbsGrams,
      fatGrams: target.macros.fatGrams,
      safetyStatus: target.safety.status,
      safetyReasons: target.safety.reasons,
      explanation: target.explanation
    };
  }

  return {
    dayType: target.dayType,
    targetKcal: target.targetKcal,
    proteinGrams: target.proteinGrams,
    carbsGrams: target.carbsGrams,
    fatGrams: target.fatGrams,
    safetyStatus: target.safetyStatus,
    safetyReasons: target.safetyReasons,
    explanation: target.explanation
  };
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between'
  },
  badge: {
    backgroundColor: '#e4f2ec',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  badgeLimited: {
    backgroundColor: '#f7ecd9'
  },
  badgeText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700'
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12
  },
  macro: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    flex: 1,
    padding: 10
  },
  whyButton: {
    marginTop: 12
  },
  explanation: {
    gap: 6,
    marginTop: 8
  },
  safetyText: {
    color: colors.accent
  }
});
