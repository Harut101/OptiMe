import { DietType, FoodCatalogCategory } from '@prisma/client';

type UnknownRecord = Record<string, unknown>;

type UsdaNutrient = {
  amount?: unknown;
  value?: unknown;
  nutrient?: { id?: unknown; name?: unknown; unitName?: unknown };
  nutrientId?: unknown;
  nutrientName?: unknown;
  unitName?: unknown;
};

type UsdaFood = {
  fdcId?: unknown;
  description?: unknown;
  dataType?: unknown;
  foodClass?: unknown;
  foodCategory?: { description?: unknown } | unknown;
  foodNutrients?: UsdaNutrient[] | unknown;
};

export type PreparedUsdaFdcFood = {
  sourceFoodId: string;
  slug: string;
  name: string;
  category: FoodCatalogCategory;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number | null;
  // USDA data is imported inactive. Dietary suitability and restriction tags
  // are intentionally reviewed in OptiMe before an item can be used in plans.
  dietTypes: DietType[];
  dataType: string;
};

export type UsdaFdcPreparationResult = {
  foods: PreparedUsdaFdcFood[];
  skipped: Array<{ sourceFoodId: string | null; reason: string }>;
};

export function prepareUsdaFdcImport(
  payload: unknown,
  allowedDataTypes: string[] = ['Foundation']
): UsdaFdcPreparationResult {
  const foods = getFoods(payload);
  const acceptedDataTypes = new Set(allowedDataTypes.map(normalizeLabel));
  const prepared: PreparedUsdaFdcFood[] = [];
  const skipped: UsdaFdcPreparationResult['skipped'] = [];
  const seenIds = new Set<string>();

  for (const value of foods) {
    if (!isRecord(value)) {
      skipped.push({ sourceFoodId: null, reason: 'invalid_food_record' });
      continue;
    }

    const food = value as UsdaFood;
    const sourceFoodId = positiveIntegerString(food.fdcId);
    const name = readableString(food.description);
    const dataType = readableString(food.dataType) ?? readableString(food.foodClass) ?? 'Unknown';

    if (!sourceFoodId || !name) {
      skipped.push({ sourceFoodId, reason: 'missing_id_or_description' });
      continue;
    }
    if (seenIds.has(sourceFoodId)) {
      skipped.push({ sourceFoodId, reason: 'duplicate_fdc_id' });
      continue;
    }
    seenIds.add(sourceFoodId);

    if (!acceptedDataTypes.has(normalizeLabel(dataType))) {
      skipped.push({ sourceFoodId, reason: 'data_type_not_allowed' });
      continue;
    }

    const nutrition = extractNutrition(food.foodNutrients);
    if (!nutrition) {
      skipped.push({ sourceFoodId, reason: 'missing_required_nutrients' });
      continue;
    }
    if (!isPlausibleNutrition(nutrition)) {
      skipped.push({ sourceFoodId, reason: 'nutrition_out_of_range' });
      continue;
    }

    prepared.push({
      sourceFoodId,
      slug: `usda-fdc-${sourceFoodId}`,
      name,
      category: inferCategory(name, food.foodCategory),
      ...nutrition,
      dietTypes: [],
      dataType
    });
  }

  return { foods: prepared, skipped };
}

function getFoods(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  for (const key of ['foods', 'FoundationFoods', 'foundationFoods']) {
    if (Array.isArray(payload[key])) return payload[key] as unknown[];
  }
  return [];
}

function extractNutrition(value: unknown) {
  if (!Array.isArray(value)) return null;

  const nutrients = value.filter(isRecord) as UsdaNutrient[];
  const calories = findNutrient(nutrients, ['1008'], ['energy'], 'kcal');
  const protein = findNutrient(nutrients, ['1003'], ['protein']);
  const carbs = findNutrient(nutrients, ['1005'], ['carbohydrate']);
  const fat = findNutrient(nutrients, ['1004'], ['total lipid', 'fat']);
  const fiber = findNutrient(nutrients, ['1079'], ['fiber', 'fibre']);

  if (calories === null || protein === null || carbs === null || fat === null) return null;
  return {
    caloriesPer100g: round(calories, 0),
    proteinPer100g: round(protein, 2),
    carbsPer100g: round(carbs, 2),
    fatPer100g: round(fat, 2),
    fiberPer100g: fiber === null ? null : round(fiber, 2)
  };
}

function findNutrient(
  nutrients: UsdaNutrient[],
  ids: string[],
  nameParts: string[],
  requiredUnit?: string
) {
  for (const nutrient of nutrients) {
    const id = readableString(nutrient.nutrient?.id ?? nutrient.nutrientId);
    const name = normalizeLabel(readableString(nutrient.nutrient?.name ?? nutrient.nutrientName) ?? '');
    const unit = normalizeLabel(readableString(nutrient.nutrient?.unitName ?? nutrient.unitName) ?? '');
    const amount = finiteNumber(nutrient.amount ?? nutrient.value);
    if (amount === null) continue;
    if (requiredUnit && unit && unit !== normalizeLabel(requiredUnit)) continue;
    if (ids.includes(id ?? '') || nameParts.some((part) => name.includes(part))) return amount;
  }
  return null;
}

function isPlausibleNutrition(nutrition: Omit<PreparedUsdaFdcFood, 'sourceFoodId' | 'slug' | 'name' | 'category' | 'dietTypes' | 'dataType'>) {
  return nutrition.caloriesPer100g >= 1
    && nutrition.caloriesPer100g <= 1000
    && [nutrition.proteinPer100g, nutrition.carbsPer100g, nutrition.fatPer100g, nutrition.fiberPer100g ?? 0]
      .every((value) => Number.isFinite(value) && value >= 0 && value <= 100);
}

function inferCategory(name: string, category: unknown) {
  const text = normalizeLabel(`${name} ${isRecord(category) ? readableString(category.description) ?? '' : ''}`);
  if (/(chicken|turkey|beef|pork|fish|salmon|tuna|shrimp|egg|tofu|tempeh)/.test(text)) return FoodCatalogCategory.PROTEIN;
  if (/(milk|yogurt|cheese|dairy)/.test(text)) return FoodCatalogCategory.DAIRY_OR_ALTERNATIVE;
  if (/(bean|lentil|chickpea|pea)/.test(text)) return FoodCatalogCategory.LEGUME;
  if (/(rice|oat|pasta|bread|grain|cereal|potato|corn|barley|quinoa)/.test(text)) return FoodCatalogCategory.GRAIN;
  if (/(apple|banana|berry|orange|grape|pear|peach|mango|fruit)/.test(text)) return FoodCatalogCategory.FRUIT;
  if (/(oil|nut|seed|avocado|butter)/.test(text)) return FoodCatalogCategory.FAT;
  if (/(vegetable|broccoli|spinach|carrot|tomato|cucumber|pepper|onion|mushroom|cabbage|zucchini)/.test(text)) return FoodCatalogCategory.VEGETABLE;
  return FoodCatalogCategory.OTHER;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readableString(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return normalized.length ? normalized : null;
}

function positiveIntegerString(value: unknown) {
  const parsed = finiteNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed > 0 ? String(parsed) : null;
}

function finiteNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
