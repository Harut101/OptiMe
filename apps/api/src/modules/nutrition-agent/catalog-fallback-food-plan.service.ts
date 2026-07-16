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
import { FoodCatalogSelectionService } from '../food-catalog/food-catalog-selection.service';
import type { FoodCatalogCandidate, FoodCatalogSelectionRole } from '../food-catalog/food-catalog.types';
import { FoodPlanPortionSolverService } from './food-plan-portion-solver.service';
import { FOOD_PLAN_VALIDATION_TOLERANCES } from './food-plan-validation.constants';
import type { NutritionAgentInput } from './nutrition-agent.types';

type RecipeIngredient = {
  role: FoodCatalogSelectionRole;
  grams: number;
};

type RecipeTemplate = {
  mealType: FoodMealType;
  ingredients: RecipeIngredient[];
};

type ResolvedRecipeIngredient = RecipeIngredient & { candidate: FoodCatalogCandidate };

type ResolvedRecipeTemplate = Omit<RecipeTemplate, 'ingredients'> & {
  ingredients: ResolvedRecipeIngredient[];
};

@Injectable()
export class CatalogFallbackFoodPlanService {
  constructor(
    private readonly foodCatalog: FoodCatalogService,
    private readonly foodCatalogSelection: FoodCatalogSelectionService,
    private readonly portionSolver: FoodPlanPortionSolverService
  ) {}

  async create(input: NutritionAgentInput, reasons: string[]): Promise<DailyFoodPlan | null> {
    if (input.nutritionTarget.safety.status === 'NEEDS_MORE_INFO') {
      return null;
    }

    const catalogSelection = await this.foodCatalogSelection.selectForDailyPlan({
      locale: input.locale,
      dietType: input.nutritionPreference?.dietType,
      planLocalDate: input.planLocalDate,
      preferredFoods: input.nutritionPreference?.preferredFoods,
      maxPerRole: 8,
      restrictions: {
        allergies: input.nutritionPreference?.allergies,
        excludedFoods: input.nutritionPreference?.excludedFoods,
        dislikedFoods: input.nutritionPreference?.dislikedFoods
      }
    });
    const recipes = withMealCount(
      getRecipes(input.nutritionPreference?.dietType),
      input.nutritionPreference?.mealsPerDay,
      input.nutritionPreference?.dietType
    );
    const resolvedRecipes = resolveRecipes(recipes, catalogSelection.byRole);
    const baseCalories = resolvedRecipes.reduce(
      (sum, recipe) => sum + recipe.ingredients.reduce(
        (mealSum, ingredient) => mealSum + (ingredient.candidate.caloriesPer100g * ingredient.grams / 100),
        0
      ),
      0
    );

    if (baseCalories <= 0) {
      return null;
    }

    const scale = clamp(input.nutritionTarget.calories.targetKcal / baseCalories, 0.6, 2.4);
    const meals = resolvedRecipes.map((recipe, index) => this.createMeal(
      recipe,
      index,
      scale,
      input.locale
    ));

    if (meals.some((meal) => meal.ingredients.length === 0)) {
      return null;
    }

    const totals = sumNutrition(meals);
    const fallbackPlan: DailyFoodPlan = {
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
    return this.solveFallbackPortions(fallbackPlan, input, catalogSelection.candidates);
  }

  private solveFallbackPortions(
    foodPlan: DailyFoodPlan,
    input: NutritionAgentInput,
    catalogCandidates: FoodCatalogCandidate[]
  ) {
    const macros = input.nutritionTarget.macros;
    if (!macros) return foodPlan;

    const result = this.portionSolver.solve({
      foodPlan,
      target: {
        caloriesKcal: input.nutritionTarget.calories.targetKcal,
        proteinGrams: macros.proteinGrams,
        carbsGrams: macros.carbsGrams,
        fatGrams: macros.fatGrams
      },
      catalogCandidates
    });
    return result.adjusted ? result.foodPlan : foodPlan;
  }

  private createMeal(
    recipe: ResolvedRecipeTemplate,
    index: number,
    scale: number,
    locale: NutritionAgentInput['locale']
  ): FoodMeal {
    const ingredients = recipe.ingredients.map((template) => {
      const { candidate } = template;
      const quantity = roundToFive(template.grams * scale);
      const nutrition = this.foodCatalog.calculateNutrition(candidate, quantity);
      return {
        catalogFoodSlug: candidate.slug,
        name: candidate.name,
        quantity,
        unit: 'g' as const,
        caloriesKcal: nutrition.caloriesKcal,
        proteinGrams: nutrition.proteinGrams,
        carbsGrams: nutrition.carbsGrams,
        fatGrams: nutrition.fatGrams,
        isOptional: false
      } satisfies FoodIngredient;
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
  if (dietType === DietType.KETO || dietType === DietType.LOW_CARB) return lowCarbRecipes;
  if (dietType === DietType.VEGAN) return veganRecipes;
  if (dietType === DietType.VEGETARIAN) return vegetarianRecipes;
  if (dietType === DietType.PESCATARIAN) return pescatarianRecipes;
  if (dietType === DietType.MEDITERRANEAN) return mediterraneanRecipes;
  return omnivoreRecipes;
}

function withMealCount(
  recipes: RecipeTemplate[],
  mealsPerDay?: number,
  dietType?: DietType | null
): RecipeTemplate[] {
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
      { role: 'FRUIT', grams: 110 },
      { role: dietType === DietType.VEGAN ? 'MAIN_PROTEIN' : 'DAIRY_OR_ALTERNATIVE', grams: 90 }
    ]
  };
  return [...recipes, ...Array.from({ length: count - 3 }, () => snack)];
}

const omnivoreRecipes: RecipeTemplate[] = [
  { mealType: 'BREAKFAST', ingredients: [
    { role: 'BREAKFAST_BASE', grams: 70 },
    { role: 'DAIRY_OR_ALTERNATIVE', grams: 200 },
    { role: 'FRUIT', grams: 120 }
  ] },
  { mealType: 'LUNCH', ingredients: [
    { role: 'MAIN_PROTEIN', grams: 190 },
    { role: 'CARBOHYDRATE', grams: 220 },
    { role: 'VEGETABLE', grams: 150 },
    { role: 'FAT', grams: 12 }
  ] },
  { mealType: 'DINNER', ingredients: [
    { role: 'MAIN_PROTEIN', grams: 170 },
    { role: 'CARBOHYDRATE', grams: 190 },
    { role: 'VEGETABLE', grams: 120 },
    { role: 'VEGETABLE', grams: 100 },
    { role: 'FAT', grams: 10 }
  ] }
];

const vegetarianRecipes: RecipeTemplate[] = [
  { mealType: 'BREAKFAST', ingredients: [
    { role: 'BREAKFAST_BASE', grams: 70 },
    { role: 'MAIN_PROTEIN', grams: 150 },
    { role: 'FRUIT', grams: 120 }
  ] },
  { mealType: 'LUNCH', ingredients: [
    { role: 'MAIN_PROTEIN', grams: 210 },
    { role: 'CARBOHYDRATE', grams: 210 },
    { role: 'VEGETABLE', grams: 160 },
    { role: 'FAT', grams: 12 }
  ] },
  { mealType: 'DINNER', ingredients: [
    { role: 'MAIN_PROTEIN', grams: 190 },
    { role: 'CARBOHYDRATE', grams: 180 },
    { role: 'VEGETABLE', grams: 220 },
    { role: 'FAT', grams: 10 }
  ] }
];

const pescatarianRecipes: RecipeTemplate[] = [
  { mealType: 'BREAKFAST', ingredients: [
    { role: 'BREAKFAST_BASE', grams: 65 },
    { role: 'DAIRY_OR_ALTERNATIVE', grams: 200 },
    { role: 'FRUIT', grams: 120 }
  ] },
  { mealType: 'LUNCH', ingredients: [
    { role: 'MAIN_PROTEIN', grams: 200 },
    { role: 'CARBOHYDRATE', grams: 210 },
    { role: 'VEGETABLE', grams: 180 },
    { role: 'FAT', grams: 12 }
  ] },
  { mealType: 'DINNER', ingredients: [
    { role: 'MAIN_PROTEIN', grams: 180 },
    { role: 'CARBOHYDRATE', grams: 170 },
    { role: 'VEGETABLE', grams: 230 },
    { role: 'FAT', grams: 10 }
  ] }
];

const mediterraneanRecipes: RecipeTemplate[] = [
  { mealType: 'BREAKFAST', ingredients: [
    { role: 'BREAKFAST_BASE', grams: 65 },
    { role: 'DAIRY_OR_ALTERNATIVE', grams: 180 },
    { role: 'FRUIT', grams: 140 }
  ] },
  { mealType: 'LUNCH', ingredients: [
    { role: 'MAIN_PROTEIN', grams: 190 },
    { role: 'CARBOHYDRATE', grams: 190 },
    { role: 'VEGETABLE', grams: 220 },
    { role: 'FAT', grams: 15 }
  ] },
  { mealType: 'DINNER', ingredients: [
    { role: 'MAIN_PROTEIN', grams: 170 },
    { role: 'CARBOHYDRATE', grams: 160 },
    { role: 'VEGETABLE', grams: 250 },
    { role: 'FAT', grams: 12 }
  ] }
];

const veganRecipes: RecipeTemplate[] = [
  { mealType: 'BREAKFAST', ingredients: [
    { role: 'BREAKFAST_BASE', grams: 75 },
    { role: 'MAIN_PROTEIN', grams: 170 },
    { role: 'FRUIT', grams: 130 }
  ] },
  { mealType: 'LUNCH', ingredients: [
    { role: 'MAIN_PROTEIN', grams: 230 },
    { role: 'CARBOHYDRATE', grams: 200 },
    { role: 'VEGETABLE', grams: 160 },
    { role: 'FAT', grams: 12 }
  ] },
  { mealType: 'DINNER', ingredients: [
    { role: 'MAIN_PROTEIN', grams: 210 },
    { role: 'CARBOHYDRATE', grams: 180 },
    { role: 'VEGETABLE', grams: 130 },
    { role: 'VEGETABLE', grams: 100 },
    { role: 'FAT', grams: 10 }
  ] }
];

const lowCarbRecipes: RecipeTemplate[] = [
  { mealType: 'BREAKFAST', ingredients: [
    { role: 'MAIN_PROTEIN', grams: 150 },
    { role: 'DAIRY_OR_ALTERNATIVE', grams: 180 },
    { role: 'FAT', grams: 70 }
  ] },
  { mealType: 'LUNCH', ingredients: [
    { role: 'MAIN_PROTEIN', grams: 210 },
    { role: 'VEGETABLE', grams: 220 },
    { role: 'FAT', grams: 20 }
  ] },
  { mealType: 'DINNER', ingredients: [
    { role: 'MAIN_PROTEIN', grams: 200 },
    { role: 'VEGETABLE', grams: 180 },
    { role: 'VEGETABLE', grams: 100 },
    { role: 'FAT', grams: 18 }
  ] }
];

function resolveRecipes(
  recipes: RecipeTemplate[],
  candidatesByRole: Record<FoodCatalogSelectionRole, FoodCatalogCandidate[]>
): ResolvedRecipeTemplate[] {
  const roleCursors: Partial<Record<FoodCatalogSelectionRole, number>> = {};

  return recipes.map((recipe) => {
    const usedSlugs = new Set<string>();
    const ingredients = recipe.ingredients.flatMap((ingredient) => {
      const candidate = selectCandidateForRole(ingredient.role, candidatesByRole, roleCursors, usedSlugs);
      if (!candidate) return [];
      usedSlugs.add(candidate.slug);
      return [{ ...ingredient, candidate }];
    });
    return { ...recipe, ingredients };
  });
}

function selectCandidateForRole(
  role: FoodCatalogSelectionRole,
  candidatesByRole: Record<FoodCatalogSelectionRole, FoodCatalogCandidate[]>,
  roleCursors: Partial<Record<FoodCatalogSelectionRole, number>>,
  usedSlugs: Set<string>
) {
  for (const candidateRole of [role, ...ROLE_FALLBACKS[role]]) {
    const candidates = candidatesByRole[candidateRole];
    const cursor = roleCursors[candidateRole] ?? 0;
    for (let offset = 0; offset < candidates.length; offset += 1) {
      const index = (cursor + offset) % candidates.length;
      const candidate = candidates[index];
      if (usedSlugs.has(candidate.slug)) continue;
      roleCursors[candidateRole] = index + 1;
      return candidate;
    }
  }

  return null;
}

const ROLE_FALLBACKS: Record<FoodCatalogSelectionRole, FoodCatalogSelectionRole[]> = {
  BREAKFAST_BASE: ['CARBOHYDRATE'],
  MAIN_PROTEIN: [],
  CARBOHYDRATE: ['BREAKFAST_BASE'],
  VEGETABLE: [],
  FRUIT: [],
  FAT: [],
  DAIRY_OR_ALTERNATIVE: ['MAIN_PROTEIN', 'BREAKFAST_BASE']
};

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
