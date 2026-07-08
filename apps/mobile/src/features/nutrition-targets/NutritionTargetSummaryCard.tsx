import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Flame, Info } from 'lucide-react-native';
import type {
  NutritionTarget,
  NutritionTargetReason,
  NutritionTargetSnapshot
} from '@optime/shared-types';

import { Card } from '@/components/Card';
import { BottomSheet } from '@/components/BottomSheet';
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
    <>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Flame size={20} color={colors.nutrition} strokeWidth={2.6} />
          </View>
          <View style={styles.headerCopy}>
            <Text variant="label">{t('nutritionTargets.title')}</Text>
            <Text variant="muted">{t(`nutritionTargets.dayType.${summary.dayType}` as never)}</Text>
          </View>
          <View style={[styles.badge, needsMoreInfo ? styles.badgeLimited : null]}>
            <Text style={styles.badgeText}>{t(`nutritionTargets.status.${summary.safetyStatus}` as never)}</Text>
          </View>
        </View>

        <View>
          <Text variant="label">{t('nutritionTargets.title')}</Text>
          <View style={styles.kcalRow}>
            <Text variant="metric" style={styles.kcalValue}>
            {needsMoreInfo
              ? t('nutritionTargets.needsMoreInfo')
              : String(summary.targetKcal)}
            </Text>
            {!needsMoreInfo ? <Text variant="body" style={styles.kcalUnit}>kcal</Text> : null}
          </View>
        </View>

        {!needsMoreInfo ? (
          <View style={styles.macroRow}>
            <Macro label={t('today.protein')} value={`${summary.proteinGrams}g`} tone="protein" />
            <Macro label={t('today.carbs')} value={`${summary.carbsGrams}g`} tone="carbs" />
            <Macro label={t('today.fat')} value={`${summary.fatGrams}g`} tone="fat" />
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('nutritionTargets.why')}
          onPress={() => setExpanded(true)}
          style={styles.whyButton}
        >
          <Info size={16} color={colors.primaryDark} />
          <Text variant="label" style={styles.whyText}>{t('nutritionTargets.why')}</Text>
        </Pressable>
      </Card>
      <BottomSheet
        visible={expanded}
        title={t('nutritionTargets.why')}
        subtitle={explanation.title}
        onClose={() => setExpanded(false)}
      >
        <View style={styles.explanation}>
          {explanation.bullets.map((bullet) => (
            <Text key={bullet} variant="body">- {bullet}</Text>
          ))}
        </View>
      </BottomSheet>
    </>
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

function Macro({ label, value, tone }: { label: string; value: string; tone: 'protein' | 'carbs' | 'fat' }) {
  const toneColor = tone === 'protein' ? colors.training : tone === 'carbs' ? colors.warning : colors.recovery;

  return (
    <View style={styles.macro} accessible accessibilityLabel={`${label}. ${value}`}>
      <View style={[styles.macroDot, { backgroundColor: toneColor }]} />
      <Text variant="label">{label}</Text>
      <Text style={styles.macroValue}>{value}</Text>
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
  card: {
    borderColor: 'rgba(103, 206, 103, 0.28)'
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between'
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.nutritionMuted,
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  headerCopy: {
    flex: 1,
    gap: 2
  },
  badge: {
    backgroundColor: colors.nutritionMuted,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  badgeLimited: {
    backgroundColor: colors.warningMuted
  },
  badgeText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700'
  },
  kcalRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6
  },
  kcalValue: {
    fontSize: 42,
    lineHeight: 46
  },
  kcalUnit: {
    color: colors.textSecondary,
    fontWeight: '800',
    paddingBottom: 6
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  macro: {
    backgroundColor: colors.cardMuted,
    borderRadius: 18,
    flex: 1,
    gap: 3,
    padding: 10
  },
  macroDot: {
    borderRadius: 999,
    height: 8,
    width: 8
  },
  macroValue: {
    fontWeight: '900'
  },
  whyButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    minHeight: 44
  },
  whyText: {
    color: colors.primaryDark
  },
  explanation: {
    gap: 10
  },
  safetyText: {
    color: colors.warning
  }
});
