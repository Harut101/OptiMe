import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  excludeDailyFoodIngredient,
  getTodayPlan,
  regenerateDailyFoodMeal
} from '@/api/daily-plans';
import { getFoodLog, updateFoodMealStatus } from '@/api/food-logs';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import {
  FOOD_STATUSES,
  getMealProgress,
  getMealStatus,
  getMealStatusActionLabel,
  getMealStatusLabel
} from '@/features/food-tracking/food-tracking-summary';
import { formatTime } from '@/i18n/formatters';
import { useSettingsStore } from '@/store/settings-store';
import { colors } from '@/theme/colors';
import type { FoodMealProgressStatus } from '@/types/api';

export default function MealDetailsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const preferredLocale = useSettingsStore((state) => state.preferredLocale);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    onError: () => {
      setMessage(null);
      setErrorMessage(t('food.couldNotRegenerateMeal'));
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
    return <StateBlock title={t('common.loading')} message={t('food.mealDetailsLoading')} />;
  }

  const todayPlan = today.data ?? null;
  const foodPlan = todayPlan && todayPlan.id === params.dailyPlanId ? todayPlan.plan.nutrition.foodPlan : null;
  const meal = foodPlan?.meals.find((item) => item.id === params.mealId);
  const progress = meal ? getMealProgress(foodLog.data, meal.id) : null;
  const status = meal ? getMealStatus(foodLog.data, meal.id) : 'PLANNED';

  if (!foodPlan || !meal) {
    return (
      <Screen>
        <StateBlock title={t('food.mealUnavailable')} message={t('food.mealUnavailableMessage')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="heading">{meal.title}</Text>
      <Text variant="muted">{t(`food.mealTypes.${meal.mealType}`)}</Text>

      <Card>
        <Text variant="label" accessibilityRole="header">{t('food.mealActions')}</Text>
        <View style={styles.statusWrap}>
          <Text variant="label">{t('foodTracking.mealStatus')}</Text>
          <Text style={styles.statusChip}>{getMealStatusLabel(status, t)}</Text>
          {foodLog.isError || foodLog.data?.supported === false ? (
            <Text variant="muted">{t('foodTracking.trackingStructuredOnly')}</Text>
          ) : (
            <View style={styles.statusActions}>
              {FOOD_STATUSES.filter((item) => item !== status).map((nextStatus) => (
                <Button
                  key={nextStatus}
                  title={getMealStatusActionLabel(nextStatus, t)}
                  variant="secondary"
                  disabled={updateMealStatus.isPending}
                  accessibilityLabel={t('foodTracking.updateMealStatusTo', {
                    meal: meal.title,
                    status: getMealStatusLabel(nextStatus, t)
                  })}
                  onPress={() => updateMealStatus.mutate(nextStatus)}
                />
              ))}
            </View>
          )}
          {progress?.updatedAt ? (
            <Text variant="muted">{t('today.updatedAt', { time: formatTime(progress.updatedAt, preferredLocale) })}</Text>
          ) : null}
        </View>
        <Button
          title={regenerateMeal.isPending ? t('food.regeneratingMeal') : t('food.regenerateMeal')}
          disabled={regenerateMeal.isPending}
          accessibilityLabel={t('food.regenerateMeal')}
          onPress={() =>
            Alert.alert(
              t('food.replaceMealTitle'),
              t('food.replaceMealMessage'),
              [
                { text: t('food.keepCurrentMeal'), style: 'cancel' },
                {
                  text: t('food.regenerateMeal'),
                  onPress: () => regenerateMeal.mutate()
                }
              ]
            )
          }
        />
        {message ? <Text style={styles.success}>{message}</Text> : null}
        {errorMessage ? <Text style={styles.warning}>{errorMessage}</Text> : null}
      </Card>

      <Card>
        <Text variant="label">{t('food.approximateNutrition')}</Text>
        <Text variant="body">
          {t('food.totalMacros', {
            kcal: String(meal.caloriesKcal),
            protein: String(Math.round(meal.proteinGrams)),
            carbs: String(Math.round(meal.carbsGrams)),
            fat: String(Math.round(meal.fatGrams))
          })}
        </Text>
        <Text variant="muted">{t('food.serving')}: {meal.servingSummary}</Text>
        {meal.prepTimeMinutes !== null ? (
          <Text variant="muted">{t('food.prepTimeValue', { minutes: String(meal.prepTimeMinutes) })}</Text>
        ) : null}
        <Text variant="muted">{t('food.noMealImage')}</Text>
      </Card>

      <Card>
        <Text variant="label" accessibilityRole="header">{t('food.ingredients')}</Text>
        {meal.ingredients.map((ingredient) => (
          <View key={`${ingredient.name}-${ingredient.quantity}`} style={styles.ingredient}>
            <Text variant="body">
              {ingredient.name}: {ingredient.quantity} {ingredient.unit}
            </Text>
            <Button
              title={t('food.excludeIngredient')}
              variant="secondary"
              disabled={excludeIngredient.isPending}
              accessibilityLabel={t('food.excludeIngredientAccessibility', { ingredient: ingredient.name })}
              onPress={() =>
                Alert.alert(
                  t('food.excludeIngredientTitle'),
                  t('food.excludeIngredientMessage', { ingredient: ingredient.name }),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('food.excludeIngredient'),
                      style: 'destructive',
                      onPress: () => excludeIngredient.mutate(ingredient.name)
                    }
                  ]
                )
              }
            />
          </View>
        ))}
      </Card>

      <Card>
        <Text variant="label" accessibilityRole="header">{t('food.preparation')}</Text>
        {meal.preparationSteps.map((step, index) => (
          <Text key={`${index}-${step}`} variant="body">
            {index + 1}. {step}
          </Text>
        ))}
      </Card>

      <Card>
        <Text variant="label" accessibilityRole="header">{t('food.substitutions')}</Text>
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
        <Text variant="label">{t('food.whyMeal')}</Text>
        {meal.explanation.reasonCodes.map((code) => (
          <Text key={code} variant="muted">{t(`food.mealReasons.${code}`)}</Text>
        ))}
        {foodPlan.source === 'DETERMINISTIC_FALLBACK' ? (
          <Text style={styles.warning}>{t('food.fallbackMealPlan')}</Text>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ingredient: { gap: 8, paddingVertical: 8 },
  substitution: { gap: 3, paddingVertical: 5 },
  statusWrap: { gap: 8 },
  statusChip: {
    alignSelf: 'flex-start',
    color: colors.primaryDark,
    backgroundColor: '#e7f3ef',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontWeight: '800'
  },
  statusActions: { gap: 8 },
  success: { color: colors.primaryDark, fontWeight: '700' },
  warning: { color: colors.accent, fontWeight: '700' }
});
