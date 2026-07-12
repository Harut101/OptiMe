import { FoodRestrictionTag } from '@prisma/client';

import type { FoodCatalogRestrictions } from './food-catalog.types';

export interface NormalizedFoodRestrictions {
  exactNames: string[];
  tags: FoodRestrictionTag[];
}

const TAG_KEYWORDS: Record<FoodRestrictionTag, string[]> = {
  DAIRY: ['milk', 'dairy', 'lactose', 'yogurt', 'cheese', 'молоко', 'молочн', 'лактоз', 'lait', 'lactose', 'yaourt', 'fromage', '乳制品', '牛奶', '酸奶', '奶酪'],
  EGG: ['egg', 'eggs', 'яйцо', 'яйца', 'œuf', 'oeuf', 'œufs', 'oeufs', '鸡蛋'],
  FISH: ['fish', 'seafood', 'salmon', 'треск', 'лосос', 'рыба', 'морепродукт', 'poisson', 'fruits de mer', 'saumon', '鱼', '三文鱼', '海鲜'],
  SHELLFISH: ['shellfish', 'seafood', 'crustacean', 'shrimp', 'prawn', 'моллюск', 'ракообраз', 'кревет', 'морепродукт', 'crustacé', 'crevette', 'fruits de mer', '甲壳类', '虾', '海鲜'],
  PEANUT: ['peanut', 'groundnut', 'nuts', 'nut', 'арахис', 'орех', 'cacahuète', 'noix', '花生', '坚果'],
  TREE_NUT: ['tree nut', 'nuts', 'nut', 'almond', 'cashew', 'walnut', 'орех', 'миндаль', 'noix', 'amande', '坚果', '杏仁'],
  SOY: ['soy', 'soya', 'tofu', 'соев', 'соя', 'tofu', 'soja', '大豆', '豆腐'],
  SESAME: ['sesame', 'кунжут', 'sésame', '芝麻'],
  WHEAT: ['wheat', 'пшениц', 'blé', '小麦'],
  GLUTEN: ['gluten', 'глютен', 'gluten', '麸质']
};

export function normalizeFoodRestrictions(input?: FoodCatalogRestrictions): NormalizedFoodRestrictions {
  const exactNames = [...(input?.allergies ?? []), ...(input?.excludedFoods ?? []), ...(input?.dislikedFoods ?? [])]
    .map(normalizeFoodName)
    .filter(Boolean);
  const tags = new Set<FoodRestrictionTag>();

  for (const name of exactNames) {
    for (const [tag, keywords] of Object.entries(TAG_KEYWORDS) as Array<[FoodRestrictionTag, string[]]>) {
      if (keywords.some((keyword) => name.includes(keyword))) {
        tags.add(tag);
      }
    }
  }

  return { exactNames: [...new Set(exactNames)], tags: [...tags] };
}

export function normalizeFoodName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}
