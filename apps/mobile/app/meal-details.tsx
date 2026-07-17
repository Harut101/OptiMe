import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ban, RefreshCw } from 'lucide-react-native';

import {
  applyDailyFoodIngredientSwap,
  excludeDailyFoodIngredient,
  getDailyFoodIngredientSwapSuggestions,
  getTodayPlan,
  regenerateDailyFoodMeal
} from '@/api/daily-plans';
import { getFoodLog, updateFoodMealStatus } from '@/api/food-logs';
import { AppFeedbackSheet } from '@/components/AppFeedbackSheet';
import { AppToast } from '@/components/AppToast';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ContextNoteCard } from '@/components/ContextNoteCard';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { ScreenSkeleton } from '@/components/ScreenSkeleton';
import { StateBlock } from '@/components/StateBlock';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { MacroMetricWidget, MealStatusControl } from '@/features/food-dashboard/FoodDashboardWidgets';
import {
  FOOD_STATUSES,
  getMealProgress,
  getMealStatus,
  getMealStatusActionLabel,
  getMealStatusLabel
} from '@/features/food-tracking/food-tracking-summary';
import {
  formatUsageLimitMessage,
  getUsageLimitError
} from '@/features/entitlements/usage-limit-message';
import { formatTime } from '@/i18n/formatters';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme/theme-provider';
import type { ThemeColors } from '@/theme/colors';
import type { FoodMealProgressStatus } from '@/types/api';

export default function MealDetailsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const queryClient = useQueryClient();
  const preferredLocale = useSettingsStore((state) => state.preferredLocale);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [regenerateSheetVisible, setRegenerateSheetVisible] = useState(false);
  const [ingredientToExclude, setIngredientToExclude] = useState<string | null>(null);
  const [ingredientToSwap, setIngredientToSwap] = useState<{ name: string; slug: string } | null>(null);
  const params = useLocalSearchParams<{ dailyPlanId?: string; mealId?: string }>();
  const today = useQuery({
    queryKey: ['today-plan'],
    queryFn: getTodayPlan
  });
  const foodLog = useQuery({
    queryKey: ['food-log', params.dailyPlanId],
    queryFn: () => getFoodLog(String(params.dailyPlanId)),
    enabled: Boolean(params.dailyPlanId)
  });
  const swapSuggestions = useQuery({
    queryKey: [
      'food-ingredient-swap-suggestions',
      params.dailyPlanId,
      params.mealId,
      ingredientToSwap?.slug
    ],
    queryFn: () => getDailyFoodIngredientSwapSuggestions(
      String(params.dailyPlanId),
      String(params.mealId),
      String(ingredientToSwap?.slug)
    ),
    enabled: Boolean(params.dailyPlanId && params.mealId && ingredientToSwap?.slug)
  });
  const regenerateMeal = useMutation({
    mutationFn: () =>
      regenerateDailyFoodMeal(String(params.dailyPlanId), String(params.mealId), {
        reason: 'User requested a different meal option.'
      }),
    onSuccess: async (data) => {
      setErrorMessage(null);
      setMessage(t('food.mealRegenerated'));
      queryClient.setQueryData(['today-plan'], data);
      await queryClient.invalidateQueries({ queryKey: ['today-plan'] });
      await queryClient.invalidateQueries({ queryKey: ['food-log', data.id] });
    },
    onError: (error) => {
      const usageLimit = getUsageLimitError(error);
      setMessage(null);
      setErrorMessage(
        usageLimit
          ? `${formatUsageLimitMessage(usageLimit, t, preferredLocale)} ${t('settings.upgradeSoon')}`
          : t('food.couldNotRegenerateMeal')
      );
    }
  });
  const excludeIngredient = useMutation({
    mutationFn: (ingredientName: string) =>
      excludeDailyFoodIngredient(String(params.dailyPlanId), ingredientName),
    onSuccess: async () => {
      setErrorMessage(null);
      setMessage(t('food.ingredientExcluded'));
      await queryClient.invalidateQueries({ queryKey: ['nutrition-preferences'] });
    },
    onError: () => {
      setMessage(null);
      setErrorMessage(t('food.couldNotExcludeIngredient'));
    }
  });
  const applyIngredientSwap = useMutation({
    mutationFn: (replacementCatalogFoodSlug: string) => {
      if (!ingredientToSwap) throw new Error('No ingredient selected for swapping.');
      return applyDailyFoodIngredientSwap(
        String(params.dailyPlanId),
        String(params.mealId),
        ingredientToSwap.slug,
        replacementCatalogFoodSlug
      );
    },
    onSuccess: async (data) => {
      setIngredientToSwap(null);
      setErrorMessage(null);
      setMessage(t('food.ingredientSwapped'));
      queryClient.setQueryData(['today-plan'], data);
      await queryClient.invalidateQueries({ queryKey: ['today-plan'] });
    },
    onError: () => {
      setMessage(null);
      setErrorMessage(t('food.couldNotSwapIngredient'));
    }
  });
  const updateMealStatus = useMutation({
    mutationFn: (status: FoodMealProgressStatus) =>
      updateFoodMealStatus(String(params.dailyPlanId), String(params.mealId), status),
    onSuccess: (data) => {
      setErrorMessage(null);
      setMessage(t('foodTracking.mealStatusUpdated'));
      queryClient.setQueryData(['food-log', params.dailyPlanId], data);
    },
    onError: () => {
      setMessage(null);
      setErrorMessage(t('foodTracking.couldNotUpdateMealStatus'));
    }
  });

  if (today.isLoading) {
    return <ScreenSkeleton variant="detail" cardCount={3} topSafeArea={false} />;
  }

  const todayPlan = today.data ?? null;
  const foodPlan = todayPlan && todayPlan.id === params.dailyPlanId ? todayPlan.plan.nutrition.foodPlan : null;
  const meal = foodPlan?.meals.find((item) => item.id === params.mealId);
  const progress = meal ? getMealProgress(foodLog.data, meal.id) : null;
  const status = meal ? getMealStatus(foodLog.data, meal.id) : 'PLANNED';

  if (!foodPlan || !meal) {
    return (
      <Screen topSafeArea={false}>
        <StateBlock title={t('food.mealUnavailable')} message={t('food.mealUnavailableMessage')} />
      </Screen>
    );
  }

  return (
    <Screen topSafeArea={false}>
      <Card variant="elevated" style={styles.heroCard}>
        <View style={styles.heroTop}>
          <StatusPill
            label={getMealStatusLabel(status, t)}
            tone={status === 'EATEN' ? 'success' : status === 'SKIPPED' ? 'warning' : 'neutral'}
          />
          {meal.prepTimeMinutes !== null ? (
            <Text variant="caption" style={styles.prepBadge}>{t('food.prepTimeValue', { minutes: String(meal.prepTimeMinutes) })}</Text>
          ) : null}
        </View>
        <Text variant="heading">{meal.title}</Text>
        <Text variant="muted">{meal.servingSummary}</Text>
      </Card>

      <Card>
        <SectionHeader title={t('food.mealActions')} />
        <View style={styles.statusWrap}>
          <Text variant="label">{t('foodTracking.mealStatus')}</Text>
          {foodLog.isError || foodLog.data?.supported === false ? (
            <Text variant="muted">{t('foodTracking.trackingStructuredOnly')}</Text>
          ) : (
            <MealStatusControl
              currentStatus={status}
              disabled={updateMealStatus.isPending}
              onChange={(nextStatus) => updateMealStatus.mutate(nextStatus)}
            />
          )}
          {progress?.updatedAt ? (
            <Text variant="muted">{t('today.updatedAt', { time: formatTime(progress.updatedAt, preferredLocale) })}</Text>
          ) : null}
        </View>
        <Button
          title={regenerateMeal.isPending ? t('food.regeneratingMeal') : t('food.regenerateMeal')}
          disabled={regenerateMeal.isPending}
          accessibilityLabel={t('food.regenerateMeal')}
          onPress={() => setRegenerateSheetVisible(true)}
        />
        {message ? <AppToast title={t('feedback.savedSuccessfully')} message={message} tone="success" onDismiss={() => setMessage(null)} /> : null}
        {errorMessage ? <ContextNoteCard title={t('food.mealUnavailable')} message={errorMessage} tone="warning" /> : null}
      </Card>

      <Card>
        <SectionHeader title={t('food.approximateNutrition')} />
        <View style={styles.macroGrid}>
          <View style={styles.macroRow}>
            <MacroMetricWidget label={t('food.calories')} value={meal.caloriesKcal} unit="kcal" tone="nutrition" />
            <MacroMetricWidget label={t('today.protein')} value={Math.round(meal.proteinGrams)} unit="g" tone="protein" />
          </View>
          <View style={styles.macroRow}>
            <MacroMetricWidget label={t('today.carbs')} value={Math.round(meal.carbsGrams)} unit="g" tone="carbs" />
            <MacroMetricWidget label={t('today.fat')} value={Math.round(meal.fatGrams)} unit="g" tone="fat" />
          </View>
        </View>
      </Card>

      <Card>
        <SectionHeader title={t('food.ingredients')} />
        {meal.ingredients.map((ingredient) => (
          <View key={`${ingredient.name}-${ingredient.quantity}`} style={styles.ingredientRow}>
            <View style={styles.ingredientCopy}>
              <Text variant="bodyStrong">{ingredient.name}</Text>
              <Text variant="caption">{ingredient.quantity} {ingredient.unit}</Text>
            </View>
            <View style={styles.ingredientActions}>
              {ingredient.catalogFoodSlug ? (
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.ingredientAction, pressed ? styles.actionPressed : null]}
                  disabled={applyIngredientSwap.isPending}
                  accessibilityLabel={t('food.swapIngredientAccessibility', { ingredient: ingredient.name })}
                  onPress={() => setIngredientToSwap({ name: ingredient.name, slug: ingredient.catalogFoodSlug! })}
                >
                <RefreshCw size={15} color={colors.health} />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.ingredientAction, pressed ? styles.actionPressed : null]}
                disabled={excludeIngredient.isPending}
                accessibilityLabel={t('food.excludeIngredientAccessibility', { ingredient: ingredient.name })}
                onPress={() => setIngredientToExclude(ingredient.name)}
              >
                <Ban size={15} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <SectionHeader title={t('food.preparation')} />
        {meal.preparationSteps.map((step, index) => (
          <Text key={`${index}-${step}`} variant="body">
            {index + 1}. {step}
          </Text>
        ))}
      </Card>

      <Card>
        <SectionHeader title={t('food.substitutions')} />
        {meal.substitutions.length ? meal.substitutions.map((substitution) => (
          <View key={`${substitution.originalItem}-${substitution.replacementItem}`} style={styles.substitution}>
            <Text variant="body">
              {substitution.originalItem} {'->'} {substitution.replacementItem}
            </Text>
            <Text variant="muted">{substitution.servingSummary}</Text>
            <Text variant="muted">{t(`food.substitutionReasons.${substitution.reasonCode}`)}</Text>
            {substitution.macroImpactNote ? <Text variant="muted">{substitution.macroImpactNote}</Text> : null}
          </View>
        )) : <Text variant="muted">{t('food.noSubstitutions')}</Text>}
      </Card>

      <Card>
        <SectionHeader title={t('food.whyMeal')} />
        {meal.explanation.reasonCodes.map((code) => (
          <Text key={code} variant="muted">{t(`food.mealReasons.${code}`)}</Text>
        ))}
        {foodPlan.source === 'DETERMINISTIC_FALLBACK' ? (
          <Text style={styles.warning}>{t('food.fallbackMealPlan')}</Text>
        ) : null}
      </Card>

      <AppFeedbackSheet
        visible={regenerateSheetVisible}
        title={t('food.replaceMealTitle')}
        message={t('food.replaceMealMessage')}
        tone="warning"
        onClose={() => setRegenerateSheetVisible(false)}
        actions={[
          {
            label: regenerateMeal.isPending ? t('food.regeneratingMeal') : t('food.regenerateMeal'),
            disabled: regenerateMeal.isPending,
            onPress: () => {
              setRegenerateSheetVisible(false);
              regenerateMeal.mutate();
            }
          },
          {
            label: t('food.keepCurrentMeal'),
            variant: 'secondary',
            onPress: () => setRegenerateSheetVisible(false)
          }
        ]}
      />

      <AppFeedbackSheet
        visible={Boolean(ingredientToExclude)}
        title={t('food.excludeIngredientTitle', { ingredient: ingredientToExclude ?? '' })}
        message={t('food.excludeIngredientMessage', { ingredient: ingredientToExclude ?? '' })}
        tone="warning"
        onClose={() => setIngredientToExclude(null)}
        actions={[
          {
            label: t('food.excludeIngredient'),
            variant: 'danger',
            disabled: excludeIngredient.isPending || !ingredientToExclude,
            onPress: () => {
              if (!ingredientToExclude) return;
              const ingredient = ingredientToExclude;
              setIngredientToExclude(null);
              excludeIngredient.mutate(ingredient);
            }
          },
          {
            label: t('common.cancel'),
            variant: 'secondary',
            onPress: () => setIngredientToExclude(null)
          }
        ]}
      />

      <BottomSheet
        visible={Boolean(ingredientToSwap)}
        title={t('food.swapAlternativesTitle')}
        subtitle={t('food.swapAlternativesMessage', { ingredient: ingredientToSwap?.name ?? '' })}
        onClose={() => setIngredientToSwap(null)}
      >
        {swapSuggestions.isLoading ? <Text variant="muted">{t('common.loading')}</Text> : null}
        {swapSuggestions.isError ? <Text variant="muted">{t('food.couldNotSwapIngredient')}</Text> : null}
        {swapSuggestions.data?.suggestions.length === 0 ? (
          <Text variant="muted">{t('food.noSafeAlternatives')}</Text>
        ) : null}
        {swapSuggestions.data?.suggestions.map((suggestion) => (
          <View key={suggestion.slug} style={styles.swapOption}>
            <View style={styles.swapCopy}>
              <Text variant="label">{suggestion.name}</Text>
              <Text variant="muted">
                {t('food.swapAlternativeServing', {
                  quantity: String(suggestion.quantity),
                  unit: suggestion.unit
                })}
              </Text>
            </View>
            <Button
              title={applyIngredientSwap.isPending ? t('common.loading') : t('food.swapIngredient')}
              variant="secondary"
              disabled={applyIngredientSwap.isPending}
              accessibilityLabel={t('food.swapIngredientAccessibility', { ingredient: suggestion.name })}
              onPress={() => applyIngredientSwap.mutate(suggestion.slug)}
            />
          </View>
        ))}
      </BottomSheet>
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  heroCard: {
    borderColor: 'rgba(103, 206, 103, 0.32)'
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  prepBadge: {
    color: colors.health,
    fontWeight: '800'
  },
  ingredientRow: {
    alignItems: 'flex-start',
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 13
  },
  ingredientCopy: { flex: 1, gap: 2, minWidth: 0 },
  ingredientActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8
  },
  ingredientAction: {
    alignItems: 'center',
    borderColor: colors.divider,
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  actionPressed: { opacity: 0.7 },
  swapOption: {
    alignItems: 'center',
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 12
  },
  swapCopy: { flex: 1, gap: 2 },
  substitution: { gap: 3, paddingVertical: 5 },
  statusWrap: { gap: 8 },
  macroGrid: {
    gap: 10
  },
  macroRow: { flexDirection: 'row', gap: 10 },
  warning: { color: colors.accent, fontWeight: '700' }
});
