import { Injectable } from '@nestjs/common';
import { DietType } from '@prisma/client';
import type { FoodMealType } from '@optime/shared-types';

import type {
  DailyFoodCatalogSelection,
  FoodCatalogCandidate,
  FoodCatalogSelectionRole
} from '../food-catalog/food-catalog.types';

export type RecipeTemplateIngredient = {
  role: FoodCatalogSelectionRole;
  grams: number;
};

export type FoodPlanRecipePreparationStyle = 'BOWL' | 'PLATE' | 'SNACK';

export type FoodPlanRecipeTemplate = {
  id: string;
  mealType: FoodMealType;
  titleHint: string;
  preparationStyle: FoodPlanRecipePreparationStyle;
  prepTimeMinutes: number;
  ingredients: RecipeTemplateIngredient[];
};

export type FoodPlanRecipeTemplateGuidance = {
  id: string;
  mealType: FoodMealType;
  titleHint: string;
  preparationStyle: FoodPlanRecipePreparationStyle;
  prepTimeMinutes: number;
  ingredientRoles: FoodCatalogSelectionRole[];
};

export const FOOD_PLAN_RECIPE_ROLE_FALLBACKS: Record<
  FoodCatalogSelectionRole,
  FoodCatalogSelectionRole[]
> = {
  BREAKFAST_BASE: ['CARBOHYDRATE'],
  MAIN_PROTEIN: [],
  CARBOHYDRATE: ['BREAKFAST_BASE'],
  VEGETABLE: [],
  FRUIT: [],
  FAT: [],
  DAIRY_OR_ALTERNATIVE: ['MAIN_PROTEIN', 'BREAKFAST_BASE']
};

@Injectable()
export class FoodPlanRecipeTemplateService {
  /**
   * Returns deterministic meal structures. Ingredient names and nutrition
   * values still come from the already-filtered catalog on each request.
   */
  listForDailyPlan(input: {
    dietType?: DietType | null;
    mealsPerDay?: number;
  }): FoodPlanRecipeTemplate[] {
    return withMealCount(baseTemplatesForDiet(input.dietType), input.mealsPerDay, input.dietType);
  }

  listAvailableForSelection(input: {
    dietType?: DietType | null;
    mealsPerDay?: number;
    catalogSelection: DailyFoodCatalogSelection;
  }): FoodPlanRecipeTemplate[] {
    return this.listForDailyPlan(input).filter((template) => (
      template.ingredients.every((ingredient) => hasCandidateForRole(
        ingredient.role,
        input.catalogSelection.byRole
      ))
    ));
  }

  toPlanningGuidance(templates: FoodPlanRecipeTemplate[]): FoodPlanRecipeTemplateGuidance[] {
    return templates.map((template) => ({
      id: template.id,
      mealType: template.mealType,
      titleHint: template.titleHint,
      preparationStyle: template.preparationStyle,
      prepTimeMinutes: template.prepTimeMinutes,
      ingredientRoles: template.ingredients.map((ingredient) => ingredient.role)
    }));
  }
}

function baseTemplatesForDiet(dietType?: DietType | null): FoodPlanRecipeTemplate[] {
  if (dietType === DietType.KETO || dietType === DietType.LOW_CARB) return lowCarbTemplates;
  if (dietType === DietType.VEGAN) return veganTemplates;
  if (dietType === DietType.VEGETARIAN) return vegetarianTemplates;
  if (dietType === DietType.PESCATARIAN) return pescatarianTemplates;
  if (dietType === DietType.MEDITERRANEAN) return mediterraneanTemplates;
  return omnivoreTemplates;
}

function withMealCount(
  templates: FoodPlanRecipeTemplate[],
  mealsPerDay?: number,
  dietType?: DietType | null
): FoodPlanRecipeTemplate[] {
  const count = Math.min(Math.max(Math.trunc(mealsPerDay ?? 3), 1), 6);
  if (count === 3) return templates;

  const templatePrefix = dietType?.toLowerCase() ?? 'omnivore';
  if (count === 1) {
    return [{
      id: `${templatePrefix}-full-day-plate`,
      mealType: 'LUNCH',
      titleHint: 'Complete balanced plate',
      preparationStyle: 'PLATE',
      prepTimeMinutes: 20,
      ingredients: templates.flatMap((template) => template.ingredients)
    }];
  }

  if (count === 2) {
    return [
      templates[0],
      {
        id: `${templatePrefix}-combined-main-plate`,
        mealType: 'DINNER',
        titleHint: 'Balanced main meal',
        preparationStyle: 'PLATE',
        prepTimeMinutes: 20,
        ingredients: [...templates[1].ingredients, ...templates[2].ingredients]
      }
    ];
  }

  const snackProteinRole = dietType === DietType.VEGAN ? 'MAIN_PROTEIN' : 'DAIRY_OR_ALTERNATIVE';
  const snacks = Array.from({ length: count - 3 }, (_, index): FoodPlanRecipeTemplate => ({
    id: `${templatePrefix}-simple-snack-${index + 1}`,
    mealType: 'SNACK',
    titleHint: 'Simple fruit snack',
    preparationStyle: 'SNACK',
    prepTimeMinutes: 5,
    ingredients: [
      { role: 'FRUIT', grams: 110 },
      { role: snackProteinRole, grams: 90 }
    ]
  }));
  return [...templates, ...snacks];
}

function hasCandidateForRole(
  role: FoodCatalogSelectionRole,
  candidatesByRole: DailyFoodCatalogSelection['byRole']
) {
  return [role, ...FOOD_PLAN_RECIPE_ROLE_FALLBACKS[role]].some((candidateRole) => (
    candidatesByRole[candidateRole].length > 0
  ));
}

export function selectRecipeCandidateForRole(
  role: FoodCatalogSelectionRole,
  candidatesByRole: DailyFoodCatalogSelection['byRole'],
  roleCursors: Partial<Record<FoodCatalogSelectionRole, number>>,
  usedSlugs: Set<string>
): FoodCatalogCandidate | null {
  for (const candidateRole of [role, ...FOOD_PLAN_RECIPE_ROLE_FALLBACKS[role]]) {
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

const omnivoreTemplates: FoodPlanRecipeTemplate[] = [
  template('omnivore-balanced-breakfast', 'BREAKFAST', 'Balanced breakfast bowl', [
    ['BREAKFAST_BASE', 70], ['DAIRY_OR_ALTERNATIVE', 200], ['FRUIT', 120]
  ]),
  template('omnivore-protein-grain-lunch', 'LUNCH', 'Protein and grain bowl', [
    ['MAIN_PROTEIN', 190], ['CARBOHYDRATE', 220], ['VEGETABLE', 150], ['FAT', 12]
  ]),
  template('omnivore-balanced-dinner', 'DINNER', 'Protein and vegetable dinner', [
    ['MAIN_PROTEIN', 170], ['CARBOHYDRATE', 190], ['VEGETABLE', 120], ['VEGETABLE', 100], ['FAT', 10]
  ])
];

const vegetarianTemplates: FoodPlanRecipeTemplate[] = [
  template('vegetarian-protein-breakfast', 'BREAKFAST', 'Vegetarian protein breakfast', [
    ['BREAKFAST_BASE', 70], ['MAIN_PROTEIN', 150], ['FRUIT', 120]
  ]),
  template('vegetarian-protein-grain-lunch', 'LUNCH', 'Vegetarian protein and grain bowl', [
    ['MAIN_PROTEIN', 210], ['CARBOHYDRATE', 210], ['VEGETABLE', 160], ['FAT', 12]
  ]),
  template('vegetarian-balanced-dinner', 'DINNER', 'Vegetarian balanced dinner', [
    ['MAIN_PROTEIN', 190], ['CARBOHYDRATE', 180], ['VEGETABLE', 220], ['FAT', 10]
  ])
];

const pescatarianTemplates: FoodPlanRecipeTemplate[] = [
  template('pescatarian-balanced-breakfast', 'BREAKFAST', 'Balanced breakfast bowl', [
    ['BREAKFAST_BASE', 65], ['DAIRY_OR_ALTERNATIVE', 200], ['FRUIT', 120]
  ]),
  template('pescatarian-protein-grain-lunch', 'LUNCH', 'Pescatarian protein and grain bowl', [
    ['MAIN_PROTEIN', 200], ['CARBOHYDRATE', 210], ['VEGETABLE', 180], ['FAT', 12]
  ]),
  template('pescatarian-balanced-dinner', 'DINNER', 'Pescatarian vegetable dinner', [
    ['MAIN_PROTEIN', 180], ['CARBOHYDRATE', 170], ['VEGETABLE', 230], ['FAT', 10]
  ])
];

const mediterraneanTemplates: FoodPlanRecipeTemplate[] = [
  template('mediterranean-balanced-breakfast', 'BREAKFAST', 'Mediterranean-style breakfast', [
    ['BREAKFAST_BASE', 65], ['DAIRY_OR_ALTERNATIVE', 180], ['FRUIT', 140]
  ]),
  template('mediterranean-protein-grain-lunch', 'LUNCH', 'Mediterranean protein and grain bowl', [
    ['MAIN_PROTEIN', 190], ['CARBOHYDRATE', 190], ['VEGETABLE', 220], ['FAT', 15]
  ]),
  template('mediterranean-balanced-dinner', 'DINNER', 'Mediterranean vegetable dinner', [
    ['MAIN_PROTEIN', 170], ['CARBOHYDRATE', 160], ['VEGETABLE', 250], ['FAT', 12]
  ])
];

const veganTemplates: FoodPlanRecipeTemplate[] = [
  template('vegan-protein-breakfast', 'BREAKFAST', 'Plant protein breakfast', [
    ['BREAKFAST_BASE', 75], ['MAIN_PROTEIN', 170], ['FRUIT', 130]
  ]),
  template('vegan-protein-grain-lunch', 'LUNCH', 'Plant protein and grain bowl', [
    ['MAIN_PROTEIN', 230], ['CARBOHYDRATE', 200], ['VEGETABLE', 160], ['FAT', 12]
  ]),
  template('vegan-balanced-dinner', 'DINNER', 'Plant protein vegetable dinner', [
    ['MAIN_PROTEIN', 210], ['CARBOHYDRATE', 180], ['VEGETABLE', 130], ['VEGETABLE', 100], ['FAT', 10]
  ])
];

const lowCarbTemplates: FoodPlanRecipeTemplate[] = [
  template('low-carb-protein-breakfast', 'BREAKFAST', 'Low-carb protein breakfast', [
    ['MAIN_PROTEIN', 150], ['DAIRY_OR_ALTERNATIVE', 180], ['FAT', 70]
  ]),
  template('low-carb-protein-lunch', 'LUNCH', 'Low-carb protein and vegetable lunch', [
    ['MAIN_PROTEIN', 210], ['VEGETABLE', 220], ['FAT', 20]
  ]),
  template('low-carb-protein-dinner', 'DINNER', 'Low-carb protein and vegetable dinner', [
    ['MAIN_PROTEIN', 200], ['VEGETABLE', 180], ['VEGETABLE', 100], ['FAT', 18]
  ])
];

function template(
  id: string,
  mealType: FoodMealType,
  titleHint: string,
  ingredients: Array<[FoodCatalogSelectionRole, number]>
): FoodPlanRecipeTemplate {
  return {
    id,
    mealType,
    titleHint,
    preparationStyle: preparationStyleForMealType(mealType),
    prepTimeMinutes: prepTimeForMealType(mealType),
    ingredients: ingredients.map(([role, grams]) => ({ role, grams }))
  };
}

function preparationStyleForMealType(mealType: FoodMealType): FoodPlanRecipePreparationStyle {
  if (mealType === 'BREAKFAST') return 'BOWL';
  if (mealType === 'SNACK' || mealType === 'PRE_WORKOUT' || mealType === 'POST_WORKOUT') {
    return 'SNACK';
  }
  return 'PLATE';
}

function prepTimeForMealType(mealType: FoodMealType) {
  if (mealType === 'BREAKFAST') return 10;
  if (mealType === 'SNACK' || mealType === 'PRE_WORKOUT' || mealType === 'POST_WORKOUT') {
    return 5;
  }
  return 20;
}
