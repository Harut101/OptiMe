import { Injectable } from '@nestjs/common';
import { DietType } from '@prisma/client';
import type {
  DailyFoodPlan,
  FoodIngredient,
  FoodMeal,
  FoodMealType,
  FoodNutritionTotals,
  FoodSubstitutionReasonCode
} from '@optime/shared-types';

import { FoodCatalogService } from '../food-catalog/food-catalog.service';
import type { FoodCatalogCandidate } from '../food-catalog/food-catalog.types';
import { FOOD_PLAN_VALIDATION_TOLERANCES } from './food-plan-validation.constants';
import type { NutritionAgentInput } from './nutrition-agent.types';

type RecipeIngredient = {
  alternatives: string[];
  grams: number;
};

type RecipeTemplate = {
  mealType: FoodMealType;
  ingredients: RecipeIngredient[];
};

@Injectable()
export class CatalogFallbackFoodPlanService {
  constructor(private readonly foodCatalog: FoodCatalogService) {}

  async create(input: NutritionAgentInput, reasons: string[]): Promise<DailyFoodPlan | null> {
    if (input.nutritionTarget.safety.status === 'NEEDS_MORE_INFO') {
      return null;
    }

    const candidates = await this.foodCatalog.listAllowedCandidates({
      locale: input.locale,
      dietType: input.nutritionPreference?.dietType,
      restrictions: {
        allergies: input.nutritionPreference?.allergies,
        excludedFoods: input.nutritionPreference?.excludedFoods,
        dislikedFoods: input.nutritionPreference?.dislikedFoods
      }
    });
    const bySlug = new Map(candidates.map((candidate) => [candidate.slug, candidate]));
    const recipes = withMealCount(
      getRecipes(input.nutritionPreference?.dietType),
      input.nutritionPreference?.mealsPerDay
    );
    const baseCalories = recipes.reduce(
      (sum, recipe) => sum + recipe.ingredients.reduce((mealSum, ingredient) => {
        const candidate = firstAvailable(ingredient.alternatives, bySlug);
        return mealSum + (candidate ? candidate.caloriesPer100g * ingredient.grams / 100 : 0);
      }, 0),
      0
    );

    if (baseCalories <= 0) {
      return null;
    }

    const scale = clamp(input.nutritionTarget.calories.targetKcal / baseCalories, 0.6, 2.4);
    const meals = recipes.map((recipe, index) => this.createMeal(recipe, index, bySlug, scale, input.locale));

    if (meals.some((meal) => meal.ingredients.length === 0)) {
      return null;
    }

    const totals = sumNutrition(meals);
    return {
      source: 'DETERMINISTIC_FALLBACK',
      localDate: input.planLocalDate,
      locale: input.locale,
      nutritionTargetSnapshot: input.nutritionTargetSnapshot,
      totals,
      validation: {
        status: 'FALLBACK',
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

  private createMeal(
    recipe: RecipeTemplate,
    index: number,
    candidates: Map<string, FoodCatalogCandidate>,
    scale: number,
    locale: NutritionAgentInput['locale']
  ): FoodMeal {
    const ingredients = recipe.ingredients.flatMap((template) => {
      const candidate = firstAvailable(template.alternatives, candidates);
      if (!candidate) return [];
      const quantity = roundToFive(template.grams * scale);
      const nutrition = this.foodCatalog.calculateNutrition(candidate, quantity);
      return [{
        catalogFoodSlug: candidate.slug,
        name: candidate.name,
        quantity,
        unit: 'g' as const,
        caloriesKcal: nutrition.caloriesKcal,
        proteinGrams: nutrition.proteinGrams,
        carbsGrams: nutrition.carbsGrams,
        fatGrams: nutrition.fatGrams,
        isOptional: false
      } satisfies FoodIngredient];
    });
    const totals = sumNutrition(ingredients);
    const title = mealTitle(recipe.mealType, locale);

    return {
      id: `${recipe.mealType.toLowerCase()}-${index + 1}`,
      mealType: recipe.mealType,
      title,
      shortDescription: mealDescription(locale),
      ...totals,
      prepTimeMinutes: recipe.mealType === 'BREAKFAST' ? 10 : 20,
      servingSummary: servingSummary(locale),
      ingredients,
      preparationSteps: [preparationStep(locale)],
      substitutions: ingredients.length
        ? [{
            originalItem: ingredients[0].name,
            replacementItem: replacementText(locale),
            servingSummary: servingSummary(locale),
            reasonCode: 'SIMILAR_MACROS' as FoodSubstitutionReasonCode,
            macroImpactNote: macroNote(locale)
          }]
        : [],
      explanation: {
        reasonCodes: ['TARGET_ALIGNED', 'SIMPLE_PREP', 'SAFETY_ADJUSTED']
      }
    };
  }
}

function getRecipes(dietType?: DietType | null): RecipeTemplate[] {
  if (dietType === DietType.VEGAN) return veganRecipes;
  if (dietType === DietType.VEGETARIAN) return vegetarianRecipes;
  if (dietType === DietType.KETO || dietType === DietType.LOW_CARB) return lowCarbRecipes;
  if (dietType === DietType.PESCATARIAN) return pescatarianRecipes;
  return standardRecipes;
}

function withMealCount(recipes: RecipeTemplate[], mealsPerDay?: number): RecipeTemplate[] {
  const count = Math.min(Math.max(Math.trunc(mealsPerDay ?? 3), 1), 6);
  if (count === 3) return recipes;
  if (count === 1) return [{
    mealType: 'LUNCH',
    ingredients: recipes.flatMap((recipe) => recipe.ingredients)
  }];
  if (count === 2) return [
    recipes[0],
    { mealType: 'DINNER' as const, ingredients: [...recipes[1].ingredients, ...recipes[2].ingredients] }
  ];

  const snack: RecipeTemplate = {
    mealType: 'SNACK',
    ingredients: [
      { alternatives: ['banana', 'apple', 'mixed-berries'], grams: 110 },
      { alternatives: ['greek-yogurt-plain', 'firm-tofu', 'almonds'], grams: 90 }
    ]
  };
  return [...recipes, ...Array.from({ length: count - 3 }, () => snack)];
}

const standardRecipes: RecipeTemplate[] = [
  { mealType: 'BREAKFAST', ingredients: [
    { alternatives: ['rolled-oats'], grams: 70 },
    { alternatives: ['greek-yogurt-plain', 'egg'], grams: 200 },
    { alternatives: ['mixed-berries', 'banana', 'apple'], grams: 120 }
  ] },
  { mealType: 'LUNCH', ingredients: [
    { alternatives: ['chicken-breast-cooked', 'firm-tofu', 'lentils-cooked'], grams: 190 },
    { alternatives: ['brown-rice-cooked', 'quinoa-cooked', 'baked-potato'], grams: 220 },
    { alternatives: ['broccoli-cooked', 'carrot', 'spinach'], grams: 150 },
    { alternatives: ['olive-oil', 'avocado'], grams: 12 }
  ] },
  { mealType: 'DINNER', ingredients: [
    { alternatives: ['salmon-cooked', 'chicken-breast-cooked', 'firm-tofu'], grams: 170 },
    { alternatives: ['quinoa-cooked', 'brown-rice-cooked', 'baked-potato'], grams: 190 },
    { alternatives: ['mixed-salad-greens', 'spinach', 'broccoli-cooked'], grams: 120 },
    { alternatives: ['tomato', 'cucumber', 'carrot'], grams: 100 },
    { alternatives: ['olive-oil', 'avocado'], grams: 10 }
  ] }
];

const pescatarianRecipes: RecipeTemplate[] = [
  standardRecipes[0],
  { ...standardRecipes[1], ingredients: [
    { alternatives: ['salmon-cooked', 'firm-tofu', 'lentils-cooked'], grams: 180 },
    ...standardRecipes[1].ingredients.slice(1)
  ] },
  standardRecipes[2]
];

const vegetarianRecipes: RecipeTemplate[] = [
  standardRecipes[0],
  { ...standardRecipes[1], ingredients: [
    { alternatives: ['lentils-cooked', 'firm-tofu', 'egg'], grams: 210 },
    ...standardRecipes[1].ingredients.slice(1)
  ] },
  { ...standardRecipes[2], ingredients: [
    { alternatives: ['firm-tofu', 'lentils-cooked', 'egg'], grams: 190 },
    ...standardRecipes[2].ingredients.slice(1)
  ] }
];

const veganRecipes: RecipeTemplate[] = [
  { mealType: 'BREAKFAST', ingredients: [
    { alternatives: ['rolled-oats'], grams: 75 },
    { alternatives: ['firm-tofu', 'chickpeas-cooked'], grams: 170 },
    { alternatives: ['mixed-berries', 'banana', 'apple'], grams: 130 }
  ] },
  { mealType: 'LUNCH', ingredients: [
    { alternatives: ['lentils-cooked', 'chickpeas-cooked', 'firm-tofu'], grams: 230 },
    { alternatives: ['brown-rice-cooked', 'quinoa-cooked', 'baked-potato'], grams: 200 },
    { alternatives: ['broccoli-cooked', 'carrot', 'spinach'], grams: 160 },
    { alternatives: ['olive-oil', 'avocado'], grams: 12 }
  ] },
  { mealType: 'DINNER', ingredients: [
    { alternatives: ['chickpeas-cooked', 'lentils-cooked', 'firm-tofu'], grams: 210 },
    { alternatives: ['quinoa-cooked', 'brown-rice-cooked', 'baked-potato'], grams: 180 },
    { alternatives: ['mixed-salad-greens', 'spinach', 'broccoli-cooked'], grams: 130 },
    { alternatives: ['tomato', 'cucumber', 'carrot'], grams: 100 },
    { alternatives: ['olive-oil', 'avocado'], grams: 10 }
  ] }
];

const lowCarbRecipes: RecipeTemplate[] = [
  { mealType: 'BREAKFAST', ingredients: [
    { alternatives: ['egg', 'firm-tofu'], grams: 150 },
    { alternatives: ['greek-yogurt-plain', 'firm-tofu'], grams: 180 },
    { alternatives: ['avocado', 'olive-oil'], grams: 70 }
  ] },
  { mealType: 'LUNCH', ingredients: [
    { alternatives: ['chicken-breast-cooked', 'firm-tofu', 'salmon-cooked'], grams: 210 },
    { alternatives: ['broccoli-cooked', 'spinach', 'mixed-salad-greens'], grams: 220 },
    { alternatives: ['olive-oil', 'avocado'], grams: 20 }
  ] },
  { mealType: 'DINNER', ingredients: [
    { alternatives: ['salmon-cooked', 'chicken-breast-cooked', 'firm-tofu'], grams: 200 },
    { alternatives: ['mixed-salad-greens', 'spinach', 'broccoli-cooked'], grams: 180 },
    { alternatives: ['tomato', 'cucumber', 'carrot'], grams: 100 },
    { alternatives: ['olive-oil', 'avocado'], grams: 18 }
  ] }
];

function firstAvailable(alternatives: string[], candidates: Map<string, FoodCatalogCandidate>) {
  return alternatives.map((slug) => candidates.get(slug)).find((candidate): candidate is FoodCatalogCandidate => Boolean(candidate));
}

function sumNutrition(items: Array<FoodNutritionTotals>) {
  return items.reduce<FoodNutritionTotals>(
    (totals, item) => ({
      caloriesKcal: totals.caloriesKcal + item.caloriesKcal,
      proteinGrams: totals.proteinGrams + item.proteinGrams,
      carbsGrams: totals.carbsGrams + item.carbsGrams,
      fatGrams: totals.fatGrams + item.fatGrams
    }),
    { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundToFive(value: number) {
  return Math.max(5, Math.round(value / 5) * 5);
}

function mealTitle(type: FoodMealType, locale: NutritionAgentInput['locale']) {
  const titles: Record<NutritionAgentInput['locale'], Record<FoodMealType, string>> = {
    'en-US': { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', SNACK: 'Snack', PRE_WORKOUT: 'Pre-workout snack', POST_WORKOUT: 'Post-workout meal' },
    'ru-RU': { BREAKFAST: 'Завтрак', LUNCH: 'Обед', DINNER: 'Ужин', SNACK: 'Перекус', PRE_WORKOUT: 'Перекус перед тренировкой', POST_WORKOUT: 'Приём пищи после тренировки' },
    'fr-FR': { BREAKFAST: 'Petit-déjeuner', LUNCH: 'Déjeuner', DINNER: 'Dîner', SNACK: 'Collation', PRE_WORKOUT: 'Collation avant l’entraînement', POST_WORKOUT: 'Repas après l’entraînement' },
    'zh-CN': { BREAKFAST: '早餐', LUNCH: '午餐', DINNER: '晚餐', SNACK: '加餐', PRE_WORKOUT: '训练前加餐', POST_WORKOUT: '训练后餐' }
  };
  return titles[locale][type];
}

function mealDescription(locale: NutritionAgentInput['locale']) {
  return {
    'en-US': 'A practical meal built from safe catalog ingredients.',
    'ru-RU': 'Практичный приём пищи из безопасных продуктов каталога.',
    'fr-FR': 'Un repas pratique composé d’ingrédients sûrs du catalogue.',
    'zh-CN': '由目录中安全食材组成的实用一餐。'
  }[locale];
}

function servingSummary(locale: NutritionAgentInput['locale']) {
  return { 'en-US': 'Portion shown below', 'ru-RU': 'Порция указана ниже', 'fr-FR': 'Portion indiquée ci-dessous', 'zh-CN': '份量如下' }[locale];
}

function preparationStep(locale: NutritionAgentInput['locale']) {
  return { 'en-US': 'Prepare the listed ingredients in a simple way that fits your routine.', 'ru-RU': 'Приготовьте указанные продукты простым способом, подходящим вашему распорядку.', 'fr-FR': 'Préparez les ingrédients indiqués simplement, selon votre routine.', 'zh-CN': '以适合自己日常节奏的简单方式准备列出的食材。' }[locale];
}

function replacementText(locale: NutritionAgentInput['locale']) {
  return { 'en-US': 'A similar allowed catalog ingredient', 'ru-RU': 'Похожий разрешённый продукт из каталога', 'fr-FR': 'Un ingrédient autorisé similaire du catalogue', 'zh-CN': '目录中类似的可用食材' }[locale];
}

function macroNote(locale: NutritionAgentInput['locale']) {
  return { 'en-US': 'Choose a similar portion to keep the meal balanced.', 'ru-RU': 'Выберите похожую порцию, чтобы сохранить баланс блюда.', 'fr-FR': 'Choisissez une portion similaire pour garder le repas équilibré.', 'zh-CN': '选择相近份量以保持这一餐的平衡。' }[locale];
}
