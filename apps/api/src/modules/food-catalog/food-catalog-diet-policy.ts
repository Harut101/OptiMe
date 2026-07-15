import { DietType } from '@prisma/client';

const MAX_CARBS_PER_100G: Partial<Record<DietType, number>> = {
  [DietType.KETO]: 10,
  [DietType.LOW_CARB]: 15
};

/**
 * Catalog-level suitability guardrails. They keep selection conservative but
 * do not replace medical or religious certification decisions.
 */
export function isFoodCatalogDietCompatible(
  dietType: DietType | null | undefined,
  foodDietTypes: DietType[],
  carbsPer100g: number
) {
  if (!dietType || dietType === DietType.NONE || dietType === DietType.OMNIVORE) return true;

  const maxCarbs = MAX_CARBS_PER_100G[dietType];
  if (maxCarbs !== undefined) return carbsPer100g <= maxCarbs;

  if (dietType === DietType.HALAL || dietType === DietType.KOSHER) {
    // Generic nutrient data cannot prove certification or preparation method.
    // Keep existing behavior until a verified compliance source is introduced.
    return true;
  }

  return foodDietTypes.includes(dietType);
}

export function getFoodCatalogDietPolicyNote(dietType: DietType) {
  if (dietType === DietType.KETO) return 'Catalog selection limits foods to 10 g carbs per 100 g.';
  if (dietType === DietType.LOW_CARB) return 'Catalog selection limits foods to 15 g carbs per 100 g.';
  if (dietType === DietType.HALAL || dietType === DietType.KOSHER) {
    return 'No certification-level catalog filter is available yet.';
  }
  return null;
}
