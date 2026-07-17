import type {
  DailyFoodPlan,
  FoodIngredientUnit,
  FoodMeal,
  FoodMealType,
  FoodSubstitutionReasonCode,
  SupportedLocale
} from '@optime/shared-types';

import { FOOD_PLAN_VALIDATION_TOLERANCES } from './food-plan-validation.constants';
import type { NutritionAgentInput } from './nutrition-agent.types';

export function createDeterministicFoodPlan(
  input: NutritionAgentInput,
  source: DailyFoodPlan['source'],
  reasons: string[] = []
): DailyFoodPlan {
  const target = input.nutritionTarget;
  const mealCount = normalizeMealCount(input.nutritionPreference?.mealsPerDay);
  const totals = target.safety.status === 'NEEDS_MORE_INFO'
    ? { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
    : {
        caloriesKcal: target.calories.targetKcal,
        proteinGrams: target.macros.proteinGrams,
        carbsGrams: target.macros.carbsGrams,
        fatGrams: target.macros.fatGrams
      };
  const splits = getMealSplits(mealCount);
  const restrictedFoods = [
    ...(input.nutritionPreference?.allergies ?? []),
    ...(input.nutritionPreference?.excludedFoods ?? [])
  ];
  const safePreferredFoods = (input.nutritionPreference?.preferredFoods ?? []).filter(
    (food) => isSafePreferredFood(food, restrictedFoods)
  );
  const meals = splits.map((split, index) =>
    createMeal({
      index,
      mealCount,
      split,
      totals,
      preferredFood: safePreferredFoods[index],
      restrictedFoods,
      trainingDay: target.dayType === 'TRAINING_DAY',
      locale: input.locale
    })
  );

  return {
    source,
    localDate: input.planLocalDate,
    locale: input.locale,
    nutritionTargetSnapshot: input.nutritionTargetSnapshot,
    totals: roundTotals(totals),
    validation: {
      status: source === 'DETERMINISTIC_FALLBACK' ? 'FALLBACK' : 'VALID',
      reasons,
      tolerances: {
        caloriesPercent: FOOD_PLAN_VALIDATION_TOLERANCES.caloriesPercent,
        proteinGrams: FOOD_PLAN_VALIDATION_TOLERANCES.proteinGrams,
        carbsGrams: FOOD_PLAN_VALIDATION_TOLERANCES.carbsGrams,
        fatGrams: FOOD_PLAN_VALIDATION_TOLERANCES.fatGrams
      }
    },
    meals
  };
}

function createMeal(input: {
  index: number;
  mealCount: number;
  split: number;
  totals: { caloriesKcal: number; proteinGrams: number; carbsGrams: number; fatGrams: number };
  preferredFood?: string;
  restrictedFoods: string[];
  trainingDay: boolean;
  locale: SupportedLocale;
}): FoodMeal {
  const mealType = getMealType(input.index, input.mealCount, input.trainingDay);
  const totals = roundTotals({
    caloriesKcal: input.totals.caloriesKcal * input.split,
    proteinGrams: input.totals.proteinGrams * input.split,
    carbsGrams: input.totals.carbsGrams * input.split,
    fatGrams: input.totals.fatGrams * input.split
  });
  const copy = getFoodPlanCopy(input.locale);
  const title = copy.mealTitles[mealType];
  const ingredientName = getSafeFallbackIngredientName({
    preferredFood: input.preferredFood,
    title,
    restrictedFoods: input.restrictedFoods,
    copy
  });

  return {
    id: `${mealType.toLowerCase()}-${input.index + 1}`,
    mealType,
    title,
    shortDescription: copy.shortDescription,
    ...totals,
    prepTimeMinutes: input.index === 0 ? 10 : 15,
    servingSummary: copy.servingSummary,
    ingredients: [
      {
        name: ingredientName,
        quantity: 1,
        unit: 'serving' as FoodIngredientUnit,
        ...totals,
        isOptional: false
      }
    ],
    preparationSteps: [
      copy.preparationStepOne,
      copy.preparationStepTwo
    ],
    substitutions: [
      {
        originalItem: ingredientName,
        replacementItem: copy.substitution,
        servingSummary: copy.comparableServing,
        reasonCode: 'SIMILAR_MACROS' as FoodSubstitutionReasonCode,
        macroImpactNote: copy.macroImpactNote
      }
    ],
    explanation: {
      reasonCodes: [
        'TARGET_ALIGNED',
        input.trainingDay ? 'TRAINING_SUPPORT' : 'BALANCED_ENERGY',
        'SIMPLE_PREP'
      ]
    }
  };
}

function normalizeMealCount(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) return 3;
  return Math.min(Math.max(Math.trunc(value!), 1), 6);
}

function getMealSplits(mealCount: number) {
  if (mealCount === 1) return [1];
  if (mealCount === 2) return [0.45, 0.55];
  if (mealCount === 3) return [0.3, 0.35, 0.35];
  if (mealCount === 4) return [0.25, 0.3, 0.3, 0.15];
  if (mealCount === 5) return [0.22, 0.26, 0.26, 0.13, 0.13];
  return [0.2, 0.23, 0.23, 0.12, 0.11, 0.11];
}

function getMealType(index: number, mealCount: number, trainingDay: boolean): FoodMealType {
  if (trainingDay && mealCount >= 4 && index === mealCount - 1) return 'POST_WORKOUT';
  const sequence: FoodMealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'SNACK', 'SNACK'];
  return sequence[index] ?? 'SNACK';
}

interface DeterministicFoodPlanCopy {
  mealTitles: Record<FoodMealType, string>;
  shortDescription: string;
  servingSummary: string;
  preparationStepOne: string;
  preparationStepTwo: string;
  substitution: string;
  comparableServing: string;
  macroImpactNote: string;
  preferredPlate: (food: string) => string;
  balancedMeal: string;
  mealComponents: string;
  balancedPlateSuffix: string;
}

const FOOD_PLAN_COPY: Record<SupportedLocale, DeterministicFoodPlanCopy> = {
  'en-US': {
    mealTitles: { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', SNACK: 'Snack', PRE_WORKOUT: 'Pre-workout snack', POST_WORKOUT: 'Post-workout meal' },
    shortDescription: "A simple meal built around today's target.",
    servingSummary: '1 balanced serving',
    preparationStepOne: 'Build the meal from familiar foods that fit your preferences.',
    preparationStepTwo: 'Keep the portion close to the serving summary and adjust only for comfort.',
    substitution: 'Similar preferred protein and carbohydrate option',
    comparableServing: '1 comparable serving',
    macroImpactNote: 'Aim to keep calories and macros close to the listed meal.',
    preferredPlate: (food) => `Balanced ${food} plate`,
    balancedMeal: 'Balanced meal',
    mealComponents: 'Meal components',
    balancedPlateSuffix: 'balanced plate'
  },
  'ru-RU': {
    mealTitles: { BREAKFAST: 'Завтрак', LUNCH: 'Обед', DINNER: 'Ужин', SNACK: 'Перекус', PRE_WORKOUT: 'Перекус перед тренировкой', POST_WORKOUT: 'Приём пищи после тренировки' },
    shortDescription: 'Простой приём пищи, составленный с учётом цели на сегодня.',
    servingSummary: '1 сбалансированная порция',
    preparationStepOne: 'Соберите приём пищи из привычных продуктов, подходящих вашим предпочтениям.',
    preparationStepTwo: 'Ориентируйтесь на указанную порцию и меняйте её только для комфорта.',
    substitution: 'Похожий предпочитаемый источник белка и углеводов',
    comparableServing: '1 сопоставимая порция',
    macroImpactNote: 'Старайтесь сохранять калории и макронутриенты близкими к указанной порции.',
    preferredPlate: (food) => `Сбалансированная тарелка с ${food}`,
    balancedMeal: 'Сбалансированный приём пищи',
    mealComponents: 'Компоненты приёма пищи',
    balancedPlateSuffix: 'сбалансированная тарелка'
  },
  'fr-FR': {
    mealTitles: { BREAKFAST: 'Petit-déjeuner', LUNCH: 'Déjeuner', DINNER: 'Dîner', SNACK: 'Collation', PRE_WORKOUT: 'Collation avant l’entraînement', POST_WORKOUT: 'Repas après l’entraînement' },
    shortDescription: 'Un repas simple construit autour de votre objectif du jour.',
    servingSummary: '1 portion équilibrée',
    preparationStepOne: 'Composez le repas avec des aliments familiers qui respectent vos préférences.',
    preparationStepTwo: 'Restez proche de la portion indiquée et ajustez seulement pour votre confort.',
    substitution: 'Option similaire avec protéines et glucides',
    comparableServing: '1 portion comparable',
    macroImpactNote: 'Essayez de garder les calories et macronutriments proches du repas indiqué.',
    preferredPlate: (food) => `Assiette équilibrée avec ${food}`,
    balancedMeal: 'Repas équilibré',
    mealComponents: 'Composants du repas',
    balancedPlateSuffix: 'assiette équilibrée'
  },
  'zh-CN': {
    mealTitles: { BREAKFAST: '早餐', LUNCH: '午餐', DINNER: '晚餐', SNACK: '加餐', PRE_WORKOUT: '训练前加餐', POST_WORKOUT: '训练后餐' },
    shortDescription: '围绕今日目标制定的一餐简单方案。',
    servingSummary: '1 份均衡餐食',
    preparationStepOne: '用符合您偏好的熟悉食材组合这一餐。',
    preparationStepTwo: '尽量按照建议份量准备，仅为舒适度进行调整。',
    substitution: '相近的蛋白质和碳水化合物选择',
    comparableServing: '1 份相当的份量',
    macroImpactNote: '尽量让热量和宏量营养素接近所列餐食。',
    preferredPlate: (food) => `均衡${food}餐盘`,
    balancedMeal: '均衡餐食',
    mealComponents: '餐食组成',
    balancedPlateSuffix: '均衡餐盘'
  }
};

function getFoodPlanCopy(locale: SupportedLocale) {
  return FOOD_PLAN_COPY[locale];
}

function roundTotals<T extends { caloriesKcal: number; proteinGrams: number; carbsGrams: number; fatGrams: number }>(
  totals: T
) {
  return {
    caloriesKcal: Math.round(totals.caloriesKcal),
    proteinGrams: Math.round(totals.proteinGrams),
    carbsGrams: Math.round(totals.carbsGrams),
    fatGrams: Math.round(totals.fatGrams)
  };
}

function sameFood(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * A user can exclude a previously generated placeholder ingredient. Fallback
 * content must never recreate that same placeholder on a later plan refresh.
 */
function isSafePreferredFood(food: string, restrictedFoods: string[]) {
  const preferred = food.trim();

  if (!preferred) {
    return false;
  }

  return ![
    preferred,
    `Balanced ${preferred} plate`
  ].some((candidate) => containsRestrictedFood(candidate, restrictedFoods));
}

function getSafeFallbackIngredientName(input: {
  preferredFood?: string;
  title: string;
  restrictedFoods: string[];
  copy: DeterministicFoodPlanCopy;
}) {
  const preferred = input.preferredFood?.trim();
  const candidates = [
    preferred ? input.copy.preferredPlate(preferred) : null,
    `${input.title} ${input.copy.balancedPlateSuffix}`,
    input.copy.balancedMeal,
    input.copy.mealComponents
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => !containsRestrictedFood(candidate, input.restrictedFoods))
    ?? input.copy.mealComponents;
}

function containsRestrictedFood(candidate: string, restrictedFoods: string[]) {
  return restrictedFoods.some((restrictedFood) => {
    const normalized = restrictedFood.trim().toLowerCase();

    if (!normalized) {
      return false;
    }

    return new RegExp(`(^|\\b)${escapeRegExp(normalized)}(\\b|$)`, 'i').test(candidate.trim());
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
