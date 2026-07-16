import { FoodPreparationLevel } from '@prisma/client';

import type { SeedFoodCatalogItem } from './types';

const READY_TO_EAT_SLUGS = new Set([
  'greek-yogurt-plain', 'whole-grain-bread', 'spinach', 'mixed-salad-greens',
  'tomato', 'cucumber', 'carrot', 'mixed-berries', 'banana', 'apple', 'avocado',
  'olive-oil', 'almonds', 'canned-tuna-in-water', 'hummus', 'rice-cakes',
  'bell-pepper', 'snap-peas', 'orange', 'pear', 'grapes', 'kiwi', 'peach',
  'mango', 'pineapple', 'strawberries', 'blueberries', 'cottage-cheese',
  'skim-milk', 'unsweetened-soy-milk', 'peanut-butter', 'walnuts', 'chia-seeds',
  'pumpkin-seeds', 'tahini', 'sunflower-seeds', 'dark-chocolate', 'honey', 'lemon'
]);

const QUICK_ASSEMBLY_SLUGS = new Set([
  'chicken-breast-cooked', 'salmon-cooked', 'lentils-cooked', 'chickpeas-cooked',
  'brown-rice-cooked', 'quinoa-cooked', 'baked-potato', 'broccoli-cooked',
  'turkey-breast-cooked', 'lean-beef-cooked', 'cod-cooked', 'shrimp-cooked',
  'black-beans-cooked', 'kidney-beans-cooked', 'edamame-cooked', 'green-peas-cooked',
  'white-rice-cooked', 'couscous-cooked', 'whole-wheat-pasta-cooked', 'pasta-cooked',
  'buckwheat-cooked', 'barley-cooked', 'corn-cooked', 'sweet-potato-baked',
  'whole-grain-wrap', 'green-beans-cooked', 'mushrooms-cooked', 'cauliflower-cooked',
  'asparagus-cooked', 'kale-cooked', 'cabbage-cooked', 'eggplant-cooked',
  'beetroot-cooked', 'vegetable-medley'
]);

/**
 * Curated foods are explicitly classified; unknown and future foods stay
 * conservative until reviewed rather than being assumed to be convenient.
 */
export function resolveFoodPreparationLevel(item: SeedFoodCatalogItem) {
  if (item.preparationLevel) return item.preparationLevel;
  if (READY_TO_EAT_SLUGS.has(item.slug)) return FoodPreparationLevel.READY_TO_EAT;
  if (QUICK_ASSEMBLY_SLUGS.has(item.slug)) return FoodPreparationLevel.QUICK_ASSEMBLY;
  return FoodPreparationLevel.COOK_REQUIRED;
}
