import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';
import type { DailyPlanMeal } from '@optime/shared-types';

import { generateTodayPlan, getTodayPlan, regenerateDailyFoodPlan } from '@/api/daily-plans';
import { getFoodLog, updateFoodMealStatus } from '@/api/food-logs';
import {
  getTodayFoodAvailability,
  getTodayFoodAvailabilityCandidates,
  replaceTodayFoodAvailability
} from '@/api/food-availability';
import {
  getNutritionPreferences,
  saveNutritionPreferences
} from '@/api/nutrition-preferences';
import { evaluatePlanImpact } from '@/api/plan-impact';
import { getNutritionTargetPreview } from '@/api/nutrition-targets';
import { Button } from '@/components/Button';
import { BottomSheet } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { AppFeedbackSheet } from '@/components/AppFeedbackSheet';
import { AppToast } from '@/components/AppToast';
import { ContextNoteCard } from '@/components/ContextNoteCard';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { ScreenSkeleton } from '@/components/ScreenSkeleton';
import { StateBlock } from '@/components/StateBlock';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { MultiSelectChips } from '@/components/MultiSelectChips';
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
import { useSettingsStore } from '@/store/settings-store';
import { NutritionTargetSummaryCard } from '@/features/nutrition-targets/NutritionTargetSummaryCard';
import {
  formatUsageLimitMessage,
  getUsageLimitError
} from '@/features/entitlements/usage-limit-message';
import { PlanImpactPromptCard } from '@/features/plan-impact/PlanImpactPromptCard';
import { PremiumMealCard } from '@/features/food-dashboard/FoodDashboardWidgets';
import type {
  DailyFoodPlan,
  EvaluatePlanImpactResponse,
  FoodDayLogResponse,
  FoodMealProgressStatus,
  NutritionPreferencesRequest,
  PlanImpactChangeType
} from '@/types/api';

const TODAY_PLAN_QUERY_KEY = ['today' + '-plan'] as const;
const MAX_AVAILABLE_FOODS = 20;

export default function FoodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const preferredLocale = useSettingsStore((state) => state.preferredLocale);
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
  const foodLog = useQuery({
    queryKey: ['food-log', todayPlan.data?.id],
    queryFn: () => getFoodLog(todayPlan.data!.id),
    enabled: Boolean(todayPlan.data?.plan.nutrition.foodPlan)
  });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<FoodPreferencesFormValue>(EMPTY_FOOD_PREFERENCES);
  const [savedValue, setSavedValue] = useState<FoodPreferencesFormValue>(EMPTY_FOOD_PREFERENCES);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [planImpact, setPlanImpact] = useState<EvaluatePlanImpactResponse | null>(null);
  const [planImpactError, setPlanImpactError] = useState<string | null>(null);
  const [menuConfirmVisible, setMenuConfirmVisible] = useState(false);
  const [availableFoodsVisible, setAvailableFoodsVisible] = useState(false);
  const [availableFoodsImpactVisible, setAvailableFoodsImpactVisible] = useState(false);
  const [availableFoodSlugs, setAvailableFoodSlugs] = useState<string[]>([]);
  const [availableFoodSearch, setAvailableFoodSearch] = useState('');
  const [availableFoodsError, setAvailableFoodsError] = useState<string | null>(null);
  const availableFoods = useQuery({
    queryKey: ['food-availability-today'],
    queryFn: getTodayFoodAvailability
  });
  const availableFoodCandidates = useQuery({
    queryKey: ['food-availability-candidates'],
    queryFn: getTodayFoodAvailabilityCandidates,
    enabled: availableFoodsVisible
  });

  useEffect(() => {
    if (preferences.data) {
      const next = fromNutritionPreferencesResponse(preferences.data);
      setValue(next);
      setSavedValue(next);
    }
  }, [preferences.data]);

  useEffect(() => {
    if (!availableFoodsVisible) {
      setAvailableFoodSlugs(availableFoods.data?.items.map((item) => item.slug) ?? []);
      setAvailableFoodSearch('');
      setAvailableFoodsError(null);
    }
  }, [availableFoods.data, availableFoodsVisible]);

  const filteredAvailableFoodCandidates = (availableFoodCandidates.data?.items ?? []).filter((item) => (
    item.name.toLocaleLowerCase().includes(availableFoodSearch.trim().toLocaleLowerCase())
  ));

  const dirty = isDraftDirty(value, savedValue);
  useUnsavedChangesGuard(editing && dirty);

  const mutation = useMutation({
    mutationFn: saveNutritionPreferences,
    onSuccess: async (data) => {
      const impactRequest = buildFoodPlanImpactRequest(toNutritionPreferencesRequest(value), savedValue);
      const next = fromNutritionPreferencesResponse(data);
      setValue(next);
      setSavedValue(next);
      setEditing(false);
      setValidationError(null);
      setSuccessMessage(t('food.savedMessage'));
      queryClient.setQueryData(['nutrition-preferences'], data);
      await queryClient.invalidateQueries({ queryKey: ['nutrition-target-preview'] });
      await evaluateFoodPlanImpact(impactRequest.changeTypes, impactRequest.newValues);
    }
  });
  const regenerateTodayPlan = useMutation({
    mutationFn: () => generateTodayPlan(true),
    onSuccess: async (data) => {
      queryClient.setQueryData(TODAY_PLAN_QUERY_KEY, data);
      setPlanImpact(null);
      setPlanImpactError(null);
      setSuccessMessage(t('today.refreshed'));
      await queryClient.invalidateQueries({ queryKey: TODAY_PLAN_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['usage-summary'] });
    },
    onError: (error) => {
      const usageLimit = getUsageLimitError(error);
      setPlanImpactError(
        usageLimit
          ? `${formatUsageLimitMessage(usageLimit, t, preferredLocale)} ${t('settings.upgradeSoon')}`
          : t('today.updateFailed')
      );
    }
  });
  const regenerateMenu = useMutation({
    mutationFn: (dailyPlanId: string) =>
      regenerateDailyFoodPlan(dailyPlanId, { reason: 'User requested a different full menu.' }),
    onSuccess: async (data) => {
      queryClient.setQueryData(TODAY_PLAN_QUERY_KEY, data);
      setSuccessMessage(t('food.menuRegenerated'));
      await queryClient.invalidateQueries({ queryKey: TODAY_PLAN_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['food-log', data.id] });
    },
    onError: (error) => {
      const usageLimit = getUsageLimitError(error);
      setValidationError(
        usageLimit
          ? `${formatUsageLimitMessage(usageLimit, t, preferredLocale)} ${t('settings.upgradeSoon')}`
          : t('food.couldNotRegenerateMenu')
      );
    }
  });
  const updateMealStatus = useMutation({
    mutationFn: ({
      dailyPlanId,
      mealId,
      status
    }: {
      dailyPlanId: string;
      mealId: string;
      status: FoodMealProgressStatus;
    }) => updateFoodMealStatus(dailyPlanId, mealId, status),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['food-log', variables.dailyPlanId], data);
      setValidationError(null);
      setSuccessMessage(t('foodTracking.mealStatusUpdated'));
    },
    onError: () => {
      setSuccessMessage(null);
      setValidationError(t('foodTracking.couldNotUpdateMealStatus'));
    }
  });
  const saveAvailableFoods = useMutation({
    mutationFn: (catalogFoodSlugs: string[]) => replaceTodayFoodAvailability(catalogFoodSlugs),
    onSuccess: async (data) => {
      queryClient.setQueryData(['food-availability-today'], data);
      setAvailableFoodsVisible(false);
      setAvailableFoodsError(null);
      if (todayPlan.data?.plan.nutrition.foodPlan) {
        setAvailableFoodsImpactVisible(true);
      } else {
        setSuccessMessage(t('foodAvailability.saved'));
      }
    },
    onError: () => {
      setAvailableFoodsError(t('foodAvailability.saveFailed'));
    }
  });

  if (preferences.isLoading) {
    return <ScreenSkeleton variant="list" cardCount={4} />;
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

  const openAvailableFoods = () => {
    setAvailableFoodSlugs(availableFoods.data?.items.map((item) => item.slug) ?? []);
    setAvailableFoodsError(null);
    setAvailableFoodsVisible(true);
  };

  async function evaluateFoodPlanImpact(
    changeTypes: PlanImpactChangeType[],
    newValues: Record<string, unknown>
  ) {
    try {
      const impact = await evaluatePlanImpact({ changeTypes, newValues });
      setPlanImpactError(null);
      setPlanImpact(impact.prompt ? impact : null);
    } catch {
      setPlanImpact(null);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t('food.title')} subtitle={t('food.intro')} />

      <NutritionTargetSummaryCard
        target={nutritionTarget.data}
        isUnavailable={!nutritionTarget.data && nutritionTarget.isError}
      />

      <PlanImpactPromptCard
        impact={planImpact}
        isUpdating={regenerateTodayPlan.isPending}
        errorMessage={planImpactError}
        onUpdateToday={() => regenerateTodayPlan.mutate()}
        onFutureOnly={() => {
          setPlanImpact(null);
          setPlanImpactError(null);
          setSuccessMessage(t('planImpact.futureOnlySaved'));
        }}
      />

      <AvailableFoodsPrompt
        selectedCount={availableFoods.data?.items.length}
        isUnavailable={availableFoods.isError}
        onPress={openAvailableFoods}
      />

      {todayPlan.data?.plan.nutrition.foodPlan ? (
        <DailyFoodPlanCard
          dailyPlanId={todayPlan.data.id}
          foodPlan={todayPlan.data.plan.nutrition.foodPlan}
          foodLog={foodLog.data}
          isRegenerating={regenerateMenu.isPending}
          isUpdatingStatus={updateMealStatus.isPending}
          onRegenerateMenu={() => setMenuConfirmVisible(true)}
          onOpenMeal={(mealId) =>
            router.push({
              pathname: '/meal-details' as never,
              params: { dailyPlanId: todayPlan.data!.id, mealId }
            })
          }
          onUpdateMealStatus={(mealId, status) =>
            updateMealStatus.mutate({ dailyPlanId: todayPlan.data!.id, mealId, status })
          }
        />
      ) : todayPlan.data?.plan.nutrition.meals.length ? (
        <FallbackMealPlanCard meals={todayPlan.data.plan.nutrition.meals} />
      ) : todayPlan.isError ? (
        <ContextNoteCard title={t('food.mealPlan')} message={t('food.mealPlanUnavailable')} tone="warning" />
      ) : null}

      <AppFeedbackSheet
        visible={menuConfirmVisible}
        title={t('food.replaceMenuTitle')}
        message={t('food.replaceMenuMessage')}
        tone="warning"
        onClose={() => setMenuConfirmVisible(false)}
        actions={[
          {
            label: regenerateMenu.isPending ? t('food.regeneratingMenu') : t('food.regenerateMenu'),
            disabled: regenerateMenu.isPending || !todayPlan.data,
            onPress: () => {
              if (!todayPlan.data) return;
              setMenuConfirmVisible(false);
              regenerateMenu.mutate(todayPlan.data.id);
            }
          },
          {
            label: t('common.cancel'),
            variant: 'secondary',
            onPress: () => setMenuConfirmVisible(false)
          }
        ]}
      />

      <BottomSheet
        visible={availableFoodsVisible}
        title={t('foodAvailability.title')}
        subtitle={t('foodAvailability.description')}
        onClose={() => {
          if (saveAvailableFoods.isPending) return;
          setAvailableFoodsVisible(false);
          setAvailableFoodsError(null);
        }}
      >
        {availableFoodCandidates.isLoading ? (
          <Text variant="muted">{t('common.loading')}</Text>
        ) : availableFoodCandidates.isError ? (
          <Text style={styles.error}>{t('foodAvailability.unavailable')}</Text>
        ) : availableFoodCandidates.data?.items.length ? (
          <>
            <Field
              label={t('foodAvailability.searchLabel')}
              value={availableFoodSearch}
              onChangeText={setAvailableFoodSearch}
              placeholder={t('foodAvailability.searchPlaceholder')}
              accessibilityLabel={t('foodAvailability.searchLabel')}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text variant="muted">
              {t('foodAvailability.selectionCount', { count: availableFoodSlugs.length })}
            </Text>
            {filteredAvailableFoodCandidates.length ? (
              <MultiSelectChips
                label={t('foodAvailability.chooseLabel')}
                value={availableFoodSlugs}
                options={filteredAvailableFoodCandidates.map((item) => ({
                  label: item.name,
                  value: item.slug
                }))}
                onChange={(next) => {
                  if (next.length <= MAX_AVAILABLE_FOODS) {
                    setAvailableFoodSlugs(next);
                    setAvailableFoodsError(null);
                    return;
                  }
                  setAvailableFoodsError(t('foodAvailability.selectionLimitReached'));
                }}
              />
            ) : (
              <Text variant="muted">{t('foodAvailability.noSearchResults')}</Text>
            )}
          </>
        ) : (
          <Text variant="muted">{t('foodAvailability.empty')}</Text>
        )}
        {availableFoodsError ? <Text style={styles.error}>{availableFoodsError}</Text> : null}
        <View style={styles.actions}>
          <Button
            title={saveAvailableFoods.isPending ? t('common.saving') : t('foodAvailability.save')}
            loading={saveAvailableFoods.isPending}
            disabled={availableFoodCandidates.isLoading || availableFoodCandidates.isError}
            onPress={() => saveAvailableFoods.mutate(availableFoodSlugs)}
          />
          <Button
            title={t('common.cancel')}
            variant="secondary"
            disabled={saveAvailableFoods.isPending}
            onPress={() => setAvailableFoodsVisible(false)}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={availableFoodsImpactVisible}
        title={t('foodAvailability.updateTodayTitle')}
        onClose={() => setAvailableFoodsImpactVisible(false)}
      >
        <Text variant="body">{t('foodAvailability.updateTodayMessage')}</Text>
        <Text variant="muted">{t('foodAvailability.updateTodayLimitNote')}</Text>
        <View style={styles.actions}>
          <Button
            title={regenerateMenu.isPending ? t('food.regeneratingMenu') : t('food.regenerateMenu')}
            loading={regenerateMenu.isPending}
            disabled={regenerateMenu.isPending || !todayPlan.data}
            onPress={() => {
              if (!todayPlan.data) return;
              setAvailableFoodsImpactVisible(false);
              regenerateMenu.mutate(todayPlan.data.id);
            }}
          />
          <Button
            title={t('foodAvailability.futureOnly')}
            variant="secondary"
            disabled={regenerateMenu.isPending}
            onPress={() => {
              setAvailableFoodsImpactVisible(false);
              setSuccessMessage(t('foodAvailability.futureOnlySaved'));
            }}
          />
        </View>
      </BottomSheet>

      {validationError && !editing ? <Text style={styles.error}>{validationError}</Text> : null}

      {!preferences.data ? (
        <StateBlock
          title={t('food.emptyTitle')}
          message={t('food.emptyMessage')}
          actionTitle={t('food.setup')}
          onAction={startSetup}
        />
      ) : (
        <>
          <FoodSummary value={savedValue} />
          <Button title={t('common.edit')} variant="secondary" onPress={() => { setSuccessMessage(null); setEditing(true); }} />
        </>
      )}

      <BottomSheet
        visible={editing}
        title={preferences.data ? t('food.updateFoodPreferences') : t('food.setup')}
        subtitle={t('food.intro')}
        onClose={() => {
          if (mutation.isPending) return;
          setValue(savedValue);
          setValidationError(null);
          setEditing(false);
        }}
      >
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
      </BottomSheet>

      {successMessage ? (
        <AppToast title={t('feedback.savedSuccessfully')} message={successMessage} tone="success" onDismiss={() => setSuccessMessage(null)} />
      ) : null}
    </Screen>
  );
}

function AvailableFoodsPrompt({
  selectedCount,
  isUnavailable,
  onPress
}: {
  selectedCount?: number;
  isUnavailable: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const summary = isUnavailable
    ? t('foodAvailability.unavailable')
    : selectedCount
      ? t('foodAvailability.selectedCount', { count: selectedCount })
      : t('foodAvailability.noneSelected');

  return (
    <View style={styles.availableFoodsSection}>
      <View style={styles.availableFoodsCopy}>
        <Text variant="heading" style={styles.availableFoodsTitle}>{t('foodAvailability.title')}</Text>
        <Text variant="muted">{summary}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('foodAvailability.choose')}
        onPress={onPress}
        style={({ pressed }) => [styles.availableFoodsButton, pressed ? styles.pressed : null]}
      >
        <Plus size={21} color={colors.textPrimary} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

function DailyFoodPlanCard({
  dailyPlanId: _dailyPlanId,
  foodPlan,
  foodLog,
  isRegenerating,
  isUpdatingStatus,
  onRegenerateMenu,
  onOpenMeal,
  onUpdateMealStatus
}: {
  dailyPlanId: string;
  foodPlan: DailyFoodPlan;
  foodLog?: FoodDayLogResponse;
  isRegenerating: boolean;
  isUpdatingStatus: boolean;
  onRegenerateMenu: () => void;
  onOpenMeal: (mealId: string) => void;
  onUpdateMealStatus: (mealId: string, status: FoodMealProgressStatus) => void;
}) {
  const { t } = useTranslation();
  const fallback = foodPlan.source === 'DETERMINISTIC_FALLBACK' || foodPlan.validation.status === 'FALLBACK';

  return (
    <>
      <View style={styles.mealPlanSection}>
        <View style={styles.mealPlanHeader}>
          <Text variant="heading" style={styles.mealPlanTitle}>{t('food.mealPlan')}</Text>
          <Text variant="muted">{t('food.whatToEatToday')}</Text>
        </View>
        {fallback ? (
          <View style={styles.mealPlanInlineStatus}>
            <StatusPill label={t('food.fallbackMealPlan')} tone="warning" />
          </View>
        ) : null}
        <View style={styles.compactActions}>
          <Button
            title={isRegenerating ? t('food.regeneratingMenu') : t('food.regenerateMenu')}
            variant="secondary"
            disabled={isRegenerating}
            accessibilityLabel={t('food.regenerateMenu')}
            onPress={onRegenerateMenu}
            style={styles.compactActionButton}
          />
        </View>
        <View style={styles.mealList}>
          {foodPlan.meals.map((meal) => (
            <PremiumMealCard
              key={meal.id}
              meal={meal}
              foodLog={foodLog}
              disabled={isUpdatingStatus}
              onPress={() => onOpenMeal(meal.id)}
              onUpdateStatus={(status) => onUpdateMealStatus(meal.id, status)}
            />
          ))}
        </View>
      </View>
    </>
  );
}

/** Older and safety-fallback plans still contain practical meal guidance. */
function FallbackMealPlanCard({ meals }: { meals: DailyPlanMeal[] }) {
  const { t } = useTranslation();

  return (
    <View style={styles.mealPlanSection}>
      <View style={styles.mealPlanHeader}>
        <Text variant="heading" style={styles.mealPlanTitle}>{t('food.mealPlan')}</Text>
        <Text variant="muted">{t('food.whatToEatToday')}</Text>
      </View>
      <View style={styles.mealList}>
        {meals.map((meal, index) => (
          <Card key={`${meal.name}-${index}`} style={styles.fallbackMealCard}>
            <Text variant="label" style={styles.fallbackMealName}>{meal.name}</Text>
            {meal.purpose ? <Text variant="muted">{meal.purpose}</Text> : null}
            <View style={styles.fallbackFoodList}>
              {meal.foods.map((food, foodIndex) => (
                <Text key={`${food.name}-${foodIndex}`} variant="body" style={styles.fallbackFoodText}>
                  {food.portion ? `${food.portion} ` : ''}{food.name}
                </Text>
              ))}
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

function FoodSummary({ value }: { value: FoodPreferencesFormValue }) {
  const { t } = useTranslation();
  return (
    <Card>
      <SectionHeader title={t('food.current')} />
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
  mealPlanSection: { gap: 10 },
  mealPlanHeader: {
    gap: 3,
    paddingHorizontal: 2
  },
  mealPlanTitle: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 27
  },
  mealPlanInlineStatus: {
    alignItems: 'flex-start',
    paddingHorizontal: 2
  },
  mealList: { gap: 10 },
  pressed: { opacity: 0.78 },
  linkText: { color: colors.primaryDark, fontWeight: '700' },
  compactActions: {
    flexDirection: 'row',
    gap: 10
  },
  compactActionButton: {
    flex: 1
  },
  availableFoodsSection: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    paddingHorizontal: 2
  },
  availableFoodsCopy: {
    flex: 1,
    gap: 3
  },
  availableFoodsTitle: {
    fontSize: 18,
    lineHeight: 23
  },
  availableFoodsButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.divider,
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  fallbackMealCard: {
    gap: 8
  },
  fallbackMealName: {
    fontSize: 18
  },
  fallbackFoodList: {
    gap: 6
  },
  fallbackFoodText: {
    lineHeight: 22
  }
});

function buildFoodPlanImpactRequest(
  next: NutritionPreferencesRequest,
  previous: FoodPreferencesFormValue
): {
  changeTypes: PlanImpactChangeType[];
  newValues: Record<string, unknown>;
} {
  const changeTypes = new Set<PlanImpactChangeType>();
  const previousAllergies = splitFoodList(previous.allergies);
  const previousExcluded = splitFoodList(previous.excludedFoods);
  const previousDisliked = splitFoodList(previous.dislikedFoods);

  if (listChanged(next.allergies ?? [], previousAllergies)) changeTypes.add('ALLERGY_CHANGED');
  if (listChanged(next.excludedFoods ?? [], previousExcluded)) changeTypes.add('EXCLUDED_FOOD_CHANGED');
  if (listChanged(next.dislikedFoods ?? [], previousDisliked)) changeTypes.add('DISLIKED_FOOD_CHANGED');
  if (next.mealsPerDay !== Number(previous.mealsPerDay)) changeTypes.add('MEAL_COUNT_CHANGED');

  if (changeTypes.size === 0) changeTypes.add('FOOD_PREFERENCES_CHANGED');

  return {
    changeTypes: [...changeTypes],
    newValues: {
      allergies: next.allergies ?? [],
      excludedFoods: next.excludedFoods ?? [],
      dislikedFoods: next.dislikedFoods ?? []
    }
  };
}

function splitFoodList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function listChanged(next: string[], previous: string[]) {
  const normalize = (items: string[]) => items.map((item) => item.toLowerCase().trim()).sort();
  return JSON.stringify(normalize(next)) !== JSON.stringify(normalize(previous));
}
