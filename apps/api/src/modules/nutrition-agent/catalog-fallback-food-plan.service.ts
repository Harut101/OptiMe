import { Injectable } from '@nestjs/common';
import type {
  DailyFoodPlan,
  DailyFoodPlanSource,
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
import { normalizeFoodPlanNutrition } from './food-plan-nutrition-normalizer';
import {
  FoodPlanRecipeTemplateService,
  selectRecipeCandidateForRole,
  type FoodPlanRecipePreparationStyle,
  type FoodPlanRecipeTemplate,
  type RecipeTemplateIngredient
} from './food-plan-recipe-template.service';
import { FOOD_PLAN_VALIDATION_TOLERANCES } from './food-plan-validation.constants';
import type { NutritionAgentInput } from './nutrition-agent.types';

type ResolvedRecipeIngredient = RecipeTemplateIngredient & { candidate: FoodCatalogCandidate };

type ResolvedRecipeTemplate = Omit<FoodPlanRecipeTemplate, 'ingredients'> & {
  ingredients: ResolvedRecipeIngredient[];
};

export type CatalogFoodPlanComposeOptions = {
  /**
   * A stable variation key changes catalog ranking without changing the plan's
   * real local date. Regeneration uses it to select the next safe menu.
   */
  selectionSeed?: string;
};

@Injectable()
export class CatalogFallbackFoodPlanService {
  constructor(
    private readonly foodCatalog: FoodCatalogService,
    private readonly foodCatalogSelection: FoodCatalogSelectionService,
    private readonly portionSolver: FoodPlanPortionSolverService,
    private readonly recipeTemplates: FoodPlanRecipeTemplateService
  ) {}

  async create(input: NutritionAgentInput, reasons: string[]): Promise<DailyFoodPlan | null> {
    return this.compose(input, reasons, 'DETERMINISTIC_FALLBACK');
  }

  async compose(
    input: NutritionAgentInput,
    reasons: string[],
    source: DailyFoodPlanSource,
    options: CatalogFoodPlanComposeOptions = {}
  ): Promise<DailyFoodPlan | null> {
    if (input.nutritionTarget.safety.status === 'NEEDS_MORE_INFO') {
      return null;
    }

    const catalogSelection = await this.foodCatalogSelection.selectForDailyPlan({
      locale: input.locale,
      dietType: input.nutritionPreference?.dietType,
      planLocalDate: options.selectionSeed
        ? `${input.planLocalDate}:${options.selectionSeed}`
        : input.planLocalDate,
      preferredFoods: input.nutritionPreference?.preferredFoods,
      maxPerRole: 8,
      restrictions: {
        allergies: input.nutritionPreference?.allergies,
        excludedFoods: input.nutritionPreference?.excludedFoods,
        dislikedFoods: input.nutritionPreference?.dislikedFoods
      }
    });
    const recipes = this.recipeTemplates.listForDailyPlan({
      dietType: input.nutritionPreference?.dietType,
      mealsPerDay: input.nutritionPreference?.mealsPerDay
    });
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
      source,
      localDate: input.planLocalDate,
      locale: input.locale,
      nutritionTargetSnapshot: input.nutritionTargetSnapshot,
      totals,
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
    return normalizeFoodPlanNutrition(
      this.solveFallbackPortions(fallbackPlan, input, catalogSelection.candidates)
    );
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
    const title = mealTitle(recipe.mealType, ingredients, locale);

    return {
      id: `${recipe.mealType.toLowerCase()}-${index + 1}`,
      mealType: recipe.mealType,
      title,
      shortDescription: mealDescription(locale),
      ...totals,
      prepTimeMinutes: recipe.prepTimeMinutes,
      servingSummary: servingSummary(locale),
      ingredients,
      preparationSteps: preparationSteps(recipe.preparationStyle, ingredients, locale),
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

function resolveRecipes(
  recipes: FoodPlanRecipeTemplate[],
  candidatesByRole: Record<FoodCatalogSelectionRole, FoodCatalogCandidate[]>
): ResolvedRecipeTemplate[] {
  const roleCursors: Partial<Record<FoodCatalogSelectionRole, number>> = {};

  return recipes.map((recipe) => {
    const usedSlugs = new Set<string>();
    const ingredients = recipe.ingredients.flatMap((ingredient) => {
      const candidate = selectRecipeCandidateForRole(
        ingredient.role,
        candidatesByRole,
        roleCursors,
        usedSlugs
      );
      if (!candidate) return [];
      usedSlugs.add(candidate.slug);
      return [{ ...ingredient, candidate }];
    });
    return { ...recipe, ingredients };
  });
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

function mealTitle(
  type: FoodMealType,
  ingredients: FoodIngredient[],
  locale: NutritionAgentInput['locale']
) {
  const ingredientNames = ingredients
    .map((ingredient) => ingredient.name.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (!ingredientNames.length) return mealTypeLabel(type, locale);
  if (ingredientNames.length === 1) return ingredientNames[0];

  const [primaryIngredient, ...supportingIngredients] = ingredientNames;
  return `${primaryIngredient} ${mealTitleWords(locale).with} ${joinIngredientNames(supportingIngredients, locale)}`;
}

function mealTitleWords(locale: NutritionAgentInput['locale']) {
  return {
    'en-US': { with: 'with', and: 'and' },
    'ru-RU': { with: '\u0441', and: '\u0438' },
    'fr-FR': { with: 'avec', and: 'et' },
    'zh-CN': { with: '\u914d', and: '\u548c' }
  }[locale];
}

function joinIngredientNames(names: string[], locale: NutritionAgentInput['locale']) {
  if (names.length <= 1) return names[0] ?? '';

  const { and } = mealTitleWords(locale);
  if (names.length === 2) return `${names[0]} ${and} ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
}

function mealTypeLabel(type: FoodMealType, locale: NutritionAgentInput['locale']) {
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

function preparationSteps(
  style: FoodPlanRecipePreparationStyle,
  ingredients: FoodIngredient[],
  locale: NutritionAgentInput['locale']
) {
  const ingredientNames = joinIngredientNames(
    ingredients
      .map((ingredient) => ingredient.name.trim())
      .filter(Boolean)
      .slice(0, 3),
    locale
  );
  const copy = preparationCopy(locale);
  return [
    `${copy.measure} ${ingredientNames}.`,
    copy[style]
  ];
}

function preparationCopy(locale: NutritionAgentInput['locale']) {
  return {
    'en-US': {
      measure: 'Measure the portions shown for',
      BOWL: 'Combine in a bowl. Heat ingredients only when their product guidance calls for it.',
      PLATE: 'Prepare each ingredient as appropriate, then serve everything together on one plate.',
      SNACK: 'Assemble the ingredients and serve when ready.'
    },
    'ru-RU': {
      measure: 'Подготовьте ингредиенты в указанных порциях:',
      BOWL: 'Соберите ингредиенты в миске. Нагревайте их только если это указано для конкретного продукта.',
      PLATE: 'Приготовьте каждый ингредиент подходящим способом и подайте всё вместе на одной тарелке.',
      SNACK: 'Соберите ингредиенты и подавайте, когда всё готово.'
    },
    'fr-FR': {
      measure: 'Préparez les ingrédients dans les portions indiquées :',
      BOWL: 'Assemblez-les dans un bol. Chauffez un ingrédient uniquement si les indications du produit le prévoient.',
      PLATE: 'Préparez chaque ingrédient de façon adaptée, puis servez le tout dans une seule assiette.',
      SNACK: 'Assemblez les ingrédients et servez lorsque tout est prêt.'
    },
    'zh-CN': {
      measure: '按标示份量准备：',
      BOWL: '在碗中组合食材。仅在食品说明需要时加热食材。',
      PLATE: '按各食材的适当方式准备，然后一起装盘。',
      SNACK: '组合食材，准备好后即可食用。'
    }
  }[locale];
}

function replacementText(locale: NutritionAgentInput['locale']) {
  return { 'en-US': 'A similar allowed catalog ingredient', 'ru-RU': 'Похожий разрешённый продукт из каталога', 'fr-FR': 'Un ingrédient autorisé similaire du catalogue', 'zh-CN': '目录中类似的可用食材' }[locale];
}

function macroNote(locale: NutritionAgentInput['locale']) {
  return { 'en-US': 'Choose a similar portion to keep the meal balanced.', 'ru-RU': 'Выберите похожую порцию, чтобы сохранить баланс блюда.', 'fr-FR': 'Choisissez une portion similaire pour garder le repas équilibré.', 'zh-CN': '选择相近份量以保持这一餐的平衡。' }[locale];
}
