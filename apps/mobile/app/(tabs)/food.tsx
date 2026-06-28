import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getTodayPlan, regenerateDailyFoodPlan } from '@/api/daily-plans';
import {
  getNutritionPreferences,
  saveNutritionPreferences
} from '@/api/nutrition-preferences';
import { getNutritionTargetPreview } from '@/api/nutrition-targets';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import {
  EMPTY_FOOD_PREFERENCES,
  FoodPreferencesForm,
  FoodPreferencesFormValue,
  fromNutritionPreferencesResponse,
  hasAllergySafetyAnswer,
  toNutritionPreferencesRequest
} from '@/features/food-preferences/FoodPreferencesForm';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { colors } from '@/theme/colors';
import { isDraftDirty } from '@/features/editor/draft-state';
import { getDietTypeLabel } from '@/i18n/enum-labels';
import { NutritionTargetSummaryCard } from '@/features/nutrition-targets/NutritionTargetSummaryCard';
import type { DailyFoodPlan, FoodMeal } from '@/types/api';

const TODAY_PLAN_QUERY_KEY = ['today' + '-plan'] as const;

export default function FoodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const preferences = useQuery({
    queryKey: ['nutrition-preferences'],
    queryFn: getNutritionPreferences
  });
  const nutritionTarget = useQuery({
    queryKey: ['nutrition-target-preview'],
    queryFn: () => getNutritionTargetPreview()
  });
  const todayPlan = useQuery({
    queryKey: TODAY_PLAN_QUERY_KEY,
    queryFn: getTodayPlan
  });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<FoodPreferencesFormValue>(EMPTY_FOOD_PREFERENCES);
  const [savedValue, setSavedValue] = useState<FoodPreferencesFormValue>(EMPTY_FOOD_PREFERENCES);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (preferences.data) {
      const next = fromNutritionPreferencesResponse(preferences.data);
      setValue(next);
      setSavedValue(next);
    }
  }, [preferences.data]);

  const dirty = isDraftDirty(value, savedValue);
  useUnsavedChangesGuard(editing && dirty);

  const mutation = useMutation({
    mutationFn: saveNutritionPreferences,
    onSuccess: async (data) => {
      const next = fromNutritionPreferencesResponse(data);
      setValue(next);
      setSavedValue(next);
      setEditing(false);
      setValidationError(null);
      setSuccessMessage(t('food.savedMessage'));
      queryClient.setQueryData(['nutrition-preferences'], data);
    }
  });
  const regenerateMenu = useMutation({
    mutationFn: (dailyPlanId: string) =>
      regenerateDailyFoodPlan(dailyPlanId, { reason: 'User requested a different full menu.' }),
    onSuccess: async (data) => {
      queryClient.setQueryData(TODAY_PLAN_QUERY_KEY, data);
      setSuccessMessage(t('food.menuRegenerated'));
      await queryClient.invalidateQueries({ queryKey: TODAY_PLAN_QUERY_KEY });
    },
    onError: () => {
      setValidationError(t('food.couldNotRegenerateMenu'));
    }
  });

  if (preferences.isLoading) {
    return <Screen><StateBlock title={t('common.loading')} message={t('food.loadingMessage')} /></Screen>;
  }

  if (preferences.isError) {
    return (
      <Screen>
        <StateBlock title={t('food.unavailable')} message={t('errors.unableLoad')} actionTitle={t('common.retry')} onAction={() => preferences.refetch()} />
      </Screen>
    );
  }

  const startSetup = () => {
    setValue(EMPTY_FOOD_PREFERENCES);
    setSavedValue(EMPTY_FOOD_PREFERENCES);
    setSuccessMessage(null);
    setEditing(true);
  };

  const save = () => {
    if (!hasAllergySafetyAnswer(value)) {
      setValidationError(t('food.allergyRequired'));
      return;
    }
    setValidationError(null);
    mutation.mutate(toNutritionPreferencesRequest(value));
  };

  return (
    <Screen>
      <Text variant="heading">{t('food.title')}</Text>
      <Text variant="muted">{t('food.intro')}</Text>

      <NutritionTargetSummaryCard
        target={nutritionTarget.data}
        isUnavailable={!nutritionTarget.data && nutritionTarget.isError}
      />

      {todayPlan.data?.plan.nutrition.foodPlan ? (
        <DailyFoodPlanCard
          dailyPlanId={todayPlan.data.id}
          foodPlan={todayPlan.data.plan.nutrition.foodPlan}
          isRegenerating={regenerateMenu.isPending}
          onRegenerateMenu={() =>
            Alert.alert(
              t('food.replaceMenuTitle'),
              t('food.replaceMenuMessage'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('food.regenerateMenu'),
                  onPress: () => regenerateMenu.mutate(todayPlan.data!.id)
                }
              ]
            )
          }
          onOpenMeal={(mealId) =>
            router.push({
              pathname: '/meal-details' as never,
              params: { dailyPlanId: todayPlan.data!.id, mealId }
            })
          }
        />
      ) : todayPlan.isError ? (
        <Card>
          <Text variant="label">{t('food.mealPlan')}</Text>
          <Text variant="muted">{t('food.mealPlanUnavailable')}</Text>
        </Card>
      ) : null}

      {validationError && !editing ? <Text style={styles.error}>{validationError}</Text> : null}

      {!preferences.data && !editing ? (
        <StateBlock
          title={t('food.emptyTitle')}
          message={t('food.emptyMessage')}
          actionTitle={t('food.setup')}
          onAction={startSetup}
        />
      ) : editing ? (
        <>
          <FoodPreferencesForm value={value} onChange={setValue} />
          {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
          {mutation.isError ? <Text style={styles.error}>{mutation.error.message}</Text> : null}
          <View style={styles.actions}>
            <Button title={mutation.isPending ? t('common.saving') : t('common.save')} disabled={mutation.isPending || !dirty} onPress={save} />
            <Button
              title={t('common.cancel')}
              variant="secondary"
              disabled={mutation.isPending}
              onPress={() => {
                setValue(savedValue);
                setValidationError(null);
                setEditing(false);
              }}
            />
          </View>
        </>
      ) : (
        <>
          <FoodSummary value={savedValue} />
          <Button title={t('common.edit')} variant="secondary" onPress={() => { setSuccessMessage(null); setEditing(true); }} />
        </>
      )}

      {successMessage ? <Card><Text variant="label">{t('common.saved')}</Text><Text variant="muted">{successMessage}</Text></Card> : null}
    </Screen>
  );
}

function DailyFoodPlanCard({
  dailyPlanId: _dailyPlanId,
  foodPlan,
  isRegenerating,
  onRegenerateMenu,
  onOpenMeal
}: {
  dailyPlanId: string;
  foodPlan: DailyFoodPlan;
  isRegenerating: boolean;
  onRegenerateMenu: () => void;
  onOpenMeal: (mealId: string) => void;
}) {
  const { t } = useTranslation();
  const fallback = foodPlan.source === 'DETERMINISTIC_FALLBACK' || foodPlan.validation.status === 'FALLBACK';

  return (
    <Card>
      <Text variant="label" accessibilityRole="header">{t('food.mealPlan')}</Text>
      <Text variant="muted">{t(`nutritionTargets.dayType.${foodPlan.nutritionTargetSnapshot.dayType}`)}</Text>
      <Text variant="muted">
        {t('food.totalMacros', {
          kcal: String(foodPlan.totals.caloriesKcal),
          protein: String(Math.round(foodPlan.totals.proteinGrams)),
          carbs: String(Math.round(foodPlan.totals.carbsGrams)),
          fat: String(Math.round(foodPlan.totals.fatGrams))
        })}
      </Text>
      {fallback ? <Text style={styles.note}>{t('food.fallbackMealPlan')}</Text> : null}
      <Text variant="muted">{t('food.whyMenu')}</Text>
      <Button
        title={isRegenerating ? t('food.regeneratingMenu') : t('food.regenerateMenu')}
        variant="secondary"
        disabled={isRegenerating}
        accessibilityLabel={t('food.regenerateMenu')}
        onPress={onRegenerateMenu}
      />
      <View style={styles.mealList}>
        {foodPlan.meals.map((meal) => (
          <MealCard key={meal.id} meal={meal} onPress={() => onOpenMeal(meal.id)} />
        ))}
      </View>
    </Card>
  );
}

function MealCard({ meal, onPress }: { meal: FoodMeal; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('food.mealAccessibility', {
        type: t(`food.mealTypes.${meal.mealType}`),
        title: meal.title,
        kcal: String(meal.caloriesKcal),
        protein: String(Math.round(meal.proteinGrams))
      })}
      onPress={onPress}
      style={({ pressed }) => [styles.mealCard, pressed && styles.pressed]}
    >
      <Text variant="label">{t(`food.mealTypes.${meal.mealType}`)}</Text>
      <Text variant="body">{meal.title}</Text>
      <Text variant="muted">
        {t('food.mealMacros', {
          kcal: String(meal.caloriesKcal),
          protein: String(Math.round(meal.proteinGrams))
        })}
      </Text>
      {meal.prepTimeMinutes !== null ? (
        <Text variant="muted">{t('food.prepTimeValue', { minutes: String(meal.prepTimeMinutes) })}</Text>
      ) : null}
      <Text variant="muted">{t('food.noMealImage')}</Text>
      <Text style={styles.linkText}>{t('food.viewMealDetails')}</Text>
    </Pressable>
  );
}

function FoodSummary({ value }: { value: FoodPreferencesFormValue }) {
  const { t } = useTranslation();
  return (
    <Card>
      <Text variant="label">{t('food.current')}</Text>
      <Text>{t('food.dietStyle')}: {getDietTypeLabel(t, value.dietType)}</Text>
      <Text>{t('food.mealsPerDay')}: {value.mealsPerDay}</Text>
      <Text variant="muted">{t('food.allergies')}: {value.allergies || t('food.confirmedNoAllergies')}</Text>
      <Text variant="muted">{t('food.excludedFoods')}: {value.excludedFoods || t('common.noneAdded')}</Text>
      <Text variant="muted">{t('food.dislikedFoods')}: {value.dislikedFoods || t('common.noneAdded')}</Text>
      <Text variant="muted">{t('food.preferredFoods')}: {value.preferredFoods || t('common.noneAdded')}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  error: { color: colors.danger, fontWeight: '600' },
  mealList: { gap: 10, marginTop: 10 },
  mealCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    gap: 4
  },
  pressed: { opacity: 0.78 },
  linkText: { color: colors.primaryDark, fontWeight: '700' },
  note: { color: colors.accent, fontWeight: '700' }
});
