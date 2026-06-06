import { DailyPlanJson } from './daily-plan-json.schema';

interface FoodRestrictionInput {
  allergies: string[];
  excludedFoods: string[];
}

export interface FoodNameNormalizationResult {
  planJson: DailyPlanJson;
  normalizedPaths: string[];
}

export function normalizeDailyPlanFoodNames(
  planJson: DailyPlanJson,
  restrictions: FoodRestrictionInput
): FoodNameNormalizationResult {
  const restrictedFoods = [...restrictions.allergies, ...restrictions.excludedFoods]
    .map((food) => food.trim())
    .filter(Boolean);

  if (restrictedFoods.length === 0) {
    return { planJson, normalizedPaths: [] };
  }

  const normalizedPaths: string[] = [];
  const meals = normalizeMeals(planJson.nutrition.meals, 'nutrition.meals', restrictedFoods, normalizedPaths);
  const menuOptions = planJson.nutrition.menuOptions?.map((option, optionIndex) => ({
    ...option,
    meals: normalizeMeals(
      option.meals,
      `nutrition.menuOptions[${optionIndex}].meals`,
      restrictedFoods,
      normalizedPaths
    )
  }));

  return {
    planJson: {
      ...planJson,
      nutrition: {
        ...planJson.nutrition,
        meals,
        ...(menuOptions ? { menuOptions } : {})
      }
    },
    normalizedPaths
  };
}

function normalizeMeals(
  meals: DailyPlanJson['nutrition']['meals'],
  pathPrefix: string,
  restrictedFoods: string[],
  normalizedPaths: string[]
) {
  return meals.map((meal, mealIndex) => ({
    ...meal,
    foods: meal.foods.map((food, foodIndex) => {
      const normalized = normalizeFoodName(food.name, restrictedFoods);

      if (!normalized) {
        return food;
      }

      normalizedPaths.push(`${pathPrefix}[${mealIndex}].foods[${foodIndex}].name`);

      return {
        ...food,
        name: normalized.name,
        notes: appendAvoidanceNote(food.notes, normalized.avoidedFoods)
      };
    })
  }));
}

function normalizeFoodName(name: string, restrictedFoods: string[]) {
  let nextName = name;
  const avoidedFoods = new Set<string>();

  for (const restrictedFood of restrictedFoods) {
    const escapedFood = escapeRegExp(restrictedFood);

    nextName = nextName.replace(/\(([^)]*)\)/g, (match, content: string) => {
      if (!mentionsFood(content, restrictedFood)) {
        return match;
      }

      if (!isSafeAvoidanceQualifier(content, restrictedFood)) {
        return match;
      }

      addMentionedRestrictedFoods(content, restrictedFoods, avoidedFoods);
      return '';
    });

    const avoidancePatterns = [
      new RegExp(`\\bwithout\\s+${escapedFood}\\b`, 'gi'),
      new RegExp(`\\bno[-\\s]+${escapedFood}\\b`, 'gi'),
      new RegExp(`\\b${escapedFood}[-\\s]+free\\b`, 'gi')
    ];

    for (const pattern of avoidancePatterns) {
      if (pattern.test(nextName)) {
        avoidedFoods.add(restrictedFood);
        nextName = nextName.replace(pattern, '');
      }
    }
  }

  const cleanedName = cleanFoodName(nextName);

  if (avoidedFoods.size === 0 || !cleanedName || cleanedName === name.trim()) {
    return null;
  }

  return {
    name: cleanedName,
    avoidedFoods: Array.from(avoidedFoods)
  };
}

function isSafeAvoidanceQualifier(text: string, restrictedFood: string) {
  const escapedFood = escapeRegExp(restrictedFood);
  const safePatterns = [
    new RegExp(`\\bno\\s+${escapedFood}\\b`, 'i'),
    new RegExp(`\\bwithout\\s+${escapedFood}\\b`, 'i'),
    new RegExp(`\\bavoid(?:s|ing|ed)?\\s+${escapedFood}\\b`, 'i'),
    new RegExp(`\\b${escapedFood}[-\\s]+free\\b`, 'i')
  ];

  return safePatterns.some((pattern) => pattern.test(text));
}

function addMentionedRestrictedFoods(
  text: string,
  restrictedFoods: string[],
  avoidedFoods: Set<string>
) {
  restrictedFoods.forEach((restrictedFood) => {
    if (mentionsFood(text, restrictedFood) && isSafeAvoidanceQualifier(text, restrictedFood)) {
      avoidedFoods.add(restrictedFood);
    }
  });
}

function appendAvoidanceNote(existingNotes: string | undefined, avoidedFoods: string[]) {
  const uniqueFoods = [...new Set(avoidedFoods.map((food) => food.trim()).filter(Boolean))];

  if (uniqueFoods.length === 0) {
    return existingNotes;
  }

  const avoidanceNote = `Prepared without ${formatFoodList(uniqueFoods)}.`;

  if (!existingNotes?.trim()) {
    return avoidanceNote;
  }

  if (existingNotes.includes(avoidanceNote)) {
    return existingNotes;
  }

  return `${existingNotes.trim()} ${avoidanceNote}`;
}

function formatFoodList(foods: string[]) {
  if (foods.length === 1) {
    return foods[0];
  }

  return `${foods.slice(0, -1).join(', ')} and ${foods.at(-1)}`;
}

function mentionsFood(text: string, restrictedFood: string) {
  return new RegExp(`(^|\\b)${escapeRegExp(restrictedFood)}(\\b|$)`, 'i').test(text);
}

function cleanFoodName(name: string) {
  const cleaned = name
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;:])/g, '$1')
    .replace(/^[\s,;:()/-]+|[\s,;:()/-]+$/g, '')
    .trim();

  if (!cleaned) {
    return '';
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
