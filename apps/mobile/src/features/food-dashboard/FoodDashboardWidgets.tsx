import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight, CircleCheck, Flame, MoreHorizontal, Utensils } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { StatusPill } from '@/components/StatusPill';
import { colors } from '@/theme/colors';
import type {
  FoodDayLogResponse,
  FoodMeal,
  FoodMealProgressStatus
} from '@/types/api';
import {
  FOOD_STATUSES,
  formatFoodProgress,
  formatFoodProgressDetail,
  getMealProgress,
  getMealStatusActionLabel,
  getMealStatusLabel
} from '@/features/food-tracking/food-tracking-summary';

export function NutritionSummaryWidget({
  label,
  targetKcal,
  dayTypeLabel,
  totals,
  statusLabel,
  onWhyPress
}: {
  label: string;
  targetKcal: number;
  dayTypeLabel: string;
  totals: {
    caloriesKcal: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  };
  statusLabel: string;
  onWhyPress: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTop}>
        <View style={styles.iconBubble}>
          <Flame size={20} color={colors.nutrition} strokeWidth={2.6} />
        </View>
        <StatusPill label={statusLabel} tone="success" />
      </View>
      <Text variant="label">{label}</Text>
      <View style={styles.kcalRow}>
        <Text variant="metric" style={styles.kcalValue}>{targetKcal}</Text>
        <Text variant="body" style={styles.kcalUnit}>kcal</Text>
      </View>
      <Text variant="muted">{dayTypeLabel}</Text>
      <View style={styles.macroGrid}>
        <MacroMetricWidget label={t('today.protein')} value={Math.round(totals.proteinGrams)} unit="g" tone="protein" />
        <MacroMetricWidget label={t('today.carbs')} value={Math.round(totals.carbsGrams)} unit="g" tone="carbs" />
        <MacroMetricWidget label={t('today.fat')} value={Math.round(totals.fatGrams)} unit="g" tone="fat" />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('nutritionTargets.why')} onPress={onWhyPress} style={styles.whyButton}>
        <Text variant="label" style={styles.whyText}>{t('nutritionTargets.why')}</Text>
        <ChevronRight size={16} color={colors.nutrition} />
      </Pressable>
    </View>
  );
}

export function MacroMetricWidget({
  label,
  value,
  unit,
  tone = 'nutrition'
}: {
  label: string;
  value: number | string;
  unit: string;
  tone?: 'nutrition' | 'protein' | 'carbs' | 'fat';
}) {
  const toneColor = {
    nutrition: colors.nutrition,
    protein: colors.training,
    carbs: colors.warning,
    fat: colors.recovery
  }[tone];

  return (
    <View style={styles.macroCard} accessible accessibilityLabel={`${label}. ${value} ${unit}`}>
      <View style={[styles.macroDot, { backgroundColor: toneColor }]} />
      <Text variant="caption" style={styles.macroLabel}>{label}</Text>
      <Text variant="body" style={styles.macroValue}>{value}<Text variant="caption"> {unit}</Text></Text>
    </View>
  );
}

export function MealProgressWidget({
  foodLog,
  trackingUnavailable
}: {
  foodLog?: FoodDayLogResponse;
  trackingUnavailable: boolean;
}) {
  const { t } = useTranslation();
  const progress = formatFoodProgress(foodLog, t) ?? t('foodTracking.noMealsMarkedYet');
  const detail = trackingUnavailable || foodLog?.supported === false
    ? t('foodTracking.trackingStructuredOnly')
    : formatFoodProgressDetail(foodLog, t);
  const value = getProgressPercent(foodLog);

  return (
    <View
      style={styles.progressCard}
      accessible
      accessibilityLabel={t('foodTracking.progressAccessibility', { progress, detail })}
    >
      <View style={styles.progressCopy}>
        <Text variant="label">{t('foodTracking.todaysFoodProgress')}</Text>
        <Text variant="heading">{progress}</Text>
        <Text variant="muted">{detail}</Text>
      </View>
      <View style={styles.progressVisual}>
        <Text variant="body" style={styles.progressPercent}>{value}%</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${value}%` }]} />
        </View>
      </View>
    </View>
  );
}

export function PremiumMealCard({
  meal,
  foodLog,
  disabled,
  onPress,
  onUpdateStatus,
  onOpenActions
}: {
  meal: FoodMeal;
  foodLog?: FoodDayLogResponse;
  disabled?: boolean;
  onPress: () => void;
  onUpdateStatus: (status: FoodMealProgressStatus) => void;
  onOpenActions: () => void;
}) {
  const { t } = useTranslation();
  const progress = getMealProgress(foodLog, meal.id);
  const status = progress?.status ?? 'PLANNED';

  return (
    <View style={styles.mealCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('food.mealAccessibility', {
          type: t(`food.mealTypes.${meal.mealType}`),
          title: meal.title,
          kcal: String(meal.caloriesKcal),
          protein: String(Math.round(meal.proteinGrams))
        })}
        onPress={onPress}
        style={({ pressed }) => [styles.mealPressable, pressed ? styles.pressed : null]}
      >
        <View style={styles.mealAccent}>
          <Utensils size={18} color={colors.nutrition} strokeWidth={2.5} />
        </View>
        <View style={styles.mealCopy}>
          <View style={styles.mealTopLine}>
            <Text variant="label" style={styles.mealType}>{t(`food.mealTypes.${meal.mealType}`)}</Text>
            <StatusPill label={getMealStatusLabel(status, t)} tone={status === 'EATEN' ? 'success' : status === 'SKIPPED' ? 'warning' : 'neutral'} />
          </View>
          <Text variant="body" style={styles.mealTitle}>{meal.title}</Text>
          <Text variant="caption">
            {t('food.mealMacros', {
              kcal: String(meal.caloriesKcal),
              protein: String(Math.round(meal.proteinGrams))
            })}
            {meal.prepTimeMinutes !== null ? ` · ${t('food.prepTimeValue', { minutes: String(meal.prepTimeMinutes) })}` : ''}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </Pressable>
      <MealStatusControl
        currentStatus={status}
        disabled={disabled}
        compact
        onChange={onUpdateStatus}
        trailing={(
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('food.mealActions')}
            onPress={onOpenActions}
            style={styles.moreButton}
          >
            <MoreHorizontal size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      />
    </View>
  );
}

export function MealStatusControl({
  currentStatus,
  disabled,
  compact = false,
  onChange,
  trailing
}: {
  currentStatus: FoodMealProgressStatus;
  disabled?: boolean;
  compact?: boolean;
  onChange?: (status: FoodMealProgressStatus) => void;
  trailing?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <View style={[styles.statusControl, compact ? styles.statusControlCompact : null]}>
      {FOOD_STATUSES.map((status) => {
        const selected = status === currentStatus;
        return (
          <Pressable
            key={status}
            disabled={disabled || selected || !onChange}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: disabled || selected || !onChange }}
            accessibilityLabel={getMealStatusActionLabel(status, t)}
            onPress={() => onChange?.(status)}
            style={[styles.statusChip, selected ? styles.statusChipSelected : null]}
          >
            {selected ? <CircleCheck size={13} color={colors.textInverse} /> : null}
            <Text variant="caption" style={[styles.statusChipText, selected ? styles.statusChipTextSelected : null]}>
              {getMealStatusLabel(status, t)}
            </Text>
          </Pressable>
        );
      })}
      {trailing}
    </View>
  );
}

function getProgressPercent(foodLog?: FoodDayLogResponse) {
  if (!foodLog?.mealProgress?.length) return 0;
  const marked = foodLog.mealProgress.filter((meal) => meal.status !== 'PLANNED').length;
  return Math.round((marked / foodLog.mealProgress.length) * 100);
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: colors.card,
    borderColor: 'rgba(103, 206, 103, 0.28)',
    borderRadius: 28,
    borderWidth: 1,
    gap: 10,
    padding: 18,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3
  },
  summaryTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  iconBubble: {
    alignItems: 'center',
    backgroundColor: colors.nutritionMuted,
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  kcalRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6
  },
  kcalValue: {
    color: colors.textPrimary,
    fontSize: 42,
    lineHeight: 46
  },
  kcalUnit: {
    color: colors.textSecondary,
    fontWeight: '800',
    paddingBottom: 6
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 8
  },
  macroCard: {
    backgroundColor: colors.cardMuted,
    borderRadius: 18,
    flex: 1,
    gap: 3,
    minHeight: 78,
    padding: 10
  },
  macroDot: {
    borderRadius: 999,
    height: 8,
    width: 8
  },
  macroLabel: {
    fontWeight: '800'
  },
  macroValue: {
    fontWeight: '900'
  },
  whyButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    minHeight: 44
  },
  whyText: {
    color: colors.primaryDark
  },
  progressCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: 'rgba(135, 227, 225, 0.34)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16
  },
  progressCopy: {
    flex: 1,
    gap: 4
  },
  progressVisual: {
    alignItems: 'flex-end',
    gap: 8,
    minWidth: 92
  },
  progressPercent: {
    fontSize: 22,
    fontWeight: '900'
  },
  progressTrack: {
    backgroundColor: colors.nutritionMuted,
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
    width: 86
  },
  progressFill: {
    backgroundColor: colors.nutrition,
    borderRadius: 999,
    height: '100%'
  },
  mealCard: {
    backgroundColor: colors.card,
    borderColor: 'rgba(209, 209, 214, 0.72)',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2
  },
  mealPressable: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 14
  },
  pressed: {
    backgroundColor: colors.cardPressed
  },
  mealAccent: {
    alignItems: 'center',
    backgroundColor: colors.nutritionMuted,
    borderRadius: 17,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  mealCopy: {
    flex: 1,
    gap: 4
  },
  mealTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between'
  },
  mealType: {
    color: colors.nutrition,
    fontWeight: '900'
  },
  mealTitle: {
    fontWeight: '900'
  },
  statusControl: {
    alignItems: 'center',
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    padding: 10
  },
  statusControlCompact: {
    paddingTop: 9
  },
  statusChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 9
  },
  statusChipSelected: {
    backgroundColor: colors.nutrition,
    borderColor: colors.nutrition
  },
  statusChipText: {
    color: colors.textSecondary,
    fontWeight: '800'
  },
  statusChipTextSelected: {
    color: colors.textInverse
  },
  moreButton: {
    alignItems: 'center',
    backgroundColor: colors.cardMuted,
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    marginLeft: 'auto',
    width: 44
  }
});
