export const FOOD_PLAN_VALIDATION_TOLERANCES = {
  caloriesPercent: 5,
  caloriesMinimumKcal: 100,
  proteinGrams: 10,
  proteinPercent: 10,
  carbsGrams: 15,
  carbsPercent: 12,
  fatGrams: 10,
  fatPercent: 12,
  mealCaloriesKcal: 35,
  mealMacroGrams: 6,
  dailyMacroCaloriesPercent: 18
} as const;

export const UNSAFE_FOOD_PLAN_PATTERNS = [
  /\b(starv(?:e|ing|ation)|detox|cleanse|crash diet|very low calorie|skip all meals)\b/i,
  /\b(burn off|earn your food|cheat meal punishment|punish(?:ment)? workout)\b/i,
  /\b(guarantee(?:d)? fat loss|melt fat|shred fat fast)\b/i,
  /\b(failed your diet|no excuses|lazy|bad body|problem areas?)\b/i,
  /\bdiagnos(?:e|is|ed)|treat(?:ment)? for\b/i
] as const;
