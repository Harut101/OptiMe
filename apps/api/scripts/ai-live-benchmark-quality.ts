import type { DailyPlanJson } from '../src/modules/daily-plans/daily-plan-json.schema';

export interface BenchmarkPlanQuality {
  overallScore: number;
  adjustedSections: string[];
  food: {
    score: number;
    source: string | null;
    validationStatus: string | null;
    mealCount: number;
    ingredientCount: number;
    uniqueCatalogFoodCount: number;
    catalogCoveragePercent: number;
    ingredientClarityPercent: number;
    preparationCoveragePercent: number;
    preferredFoodHits: number;
    calorieDeviationPercent: number | null;
    proteinDeviationGrams: number | null;
    carbsDeviationGrams: number | null;
    fatDeviationGrams: number | null;
    usedDeterministicFallback: boolean;
  };
  training: {
    applicable: boolean;
    score: number;
    intensity: string;
    exerciseCount: number;
    requestedExerciseCount: number | null;
    catalogCoveragePercent: number;
    prescriptionCoveragePercent: number;
    targetMuscleCount: number;
    usedAiRetry: boolean;
    usedDeterministicFallback: boolean;
    correctRestDay: boolean;
  };
}

export function evaluateBenchmarkPlanQuality(
  plan: DailyPlanJson,
  input: {
    trainingExpected: boolean;
    preferredFoods: string[];
    expectedMealCount: number;
  }
): BenchmarkPlanQuality {
  const food = evaluateFood(
    plan,
    input.preferredFoods,
    input.expectedMealCount
  );
  const training = evaluateTraining(plan, input.trainingExpected);
  const overallScore = training.applicable
    ? Math.round((food.score + training.score) / 2)
    : food.score;

  return {
    overallScore,
    adjustedSections: plan.debug?.generation?.adjustedSections ?? [],
    food,
    training
  };
}

export function summarizePlanQuality(results: BenchmarkPlanQuality[]) {
  const trainingResults = results.filter(
    (result) => result.training.applicable
  );
  return {
    planCount: results.length,
    averageOverallScore: average(results.map((result) => result.overallScore)),
    food: {
      averageScore: average(results.map((result) => result.food.score)),
      deterministicFallbackCount: results.filter(
        (result) => result.food.usedDeterministicFallback
      ).length,
      averageCalorieDeviationPercent: averageNullable(
        results.map((result) => result.food.calorieDeviationPercent)
      ),
      averageProteinDeviationGrams: averageNullable(
        results.map((result) => result.food.proteinDeviationGrams)
      ),
      averageCatalogCoveragePercent: average(
        results.map((result) => result.food.catalogCoveragePercent)
      ),
      averageIngredientClarityPercent: average(
        results.map((result) => result.food.ingredientClarityPercent)
      ),
      averagePreparationCoveragePercent: average(
        results.map((result) => result.food.preparationCoveragePercent)
      ),
      preferredFoodHitCount: results.reduce(
        (total, result) => total + result.food.preferredFoodHits,
        0
      )
    },
    training: {
      applicablePlanCount: trainingResults.length,
      averageScore: average(
        trainingResults.map((result) => result.training.score)
      ),
      aiRetryCount: trainingResults.filter(
        (result) => result.training.usedAiRetry
      ).length,
      deterministicFallbackCount: trainingResults.filter(
        (result) => result.training.usedDeterministicFallback
      ).length,
      averageExerciseCount: average(
        trainingResults.map((result) => result.training.exerciseCount)
      ),
      averageCatalogCoveragePercent: average(
        trainingResults.map((result) => result.training.catalogCoveragePercent)
      ),
      averagePrescriptionCoveragePercent: average(
        trainingResults.map(
          (result) => result.training.prescriptionCoveragePercent
        )
      )
    }
  };
}

function evaluateFood(
  plan: DailyPlanJson,
  preferredFoods: string[],
  expectedMealCount: number
): BenchmarkPlanQuality['food'] {
  const foodPlan = plan.nutrition.foodPlan;
  if (!foodPlan) {
    return {
      score: 0,
      source: null,
      validationStatus: null,
      mealCount: 0,
      ingredientCount: 0,
      uniqueCatalogFoodCount: 0,
      catalogCoveragePercent: 0,
      ingredientClarityPercent: 0,
      preparationCoveragePercent: 0,
      preferredFoodHits: 0,
      calorieDeviationPercent: null,
      proteinDeviationGrams: null,
      carbsDeviationGrams: null,
      fatDeviationGrams: null,
      usedDeterministicFallback: false
    };
  }

  const ingredients = foodPlan.meals.flatMap((meal) => meal.ingredients);
  const target = foodPlan.nutritionTargetSnapshot;
  const calorieDeviationPercent = percentDeviation(
    foodPlan.totals.caloriesKcal,
    target.targetKcal
  );
  const proteinDeviationGrams = absoluteDeviation(
    foodPlan.totals.proteinGrams,
    target.proteinGrams
  );
  const carbsDeviationGrams = absoluteDeviation(
    foodPlan.totals.carbsGrams,
    target.carbsGrams
  );
  const fatDeviationGrams = absoluteDeviation(
    foodPlan.totals.fatGrams,
    target.fatGrams
  );
  const catalogCoverage = ratio(
    ingredients.filter((ingredient) => Boolean(ingredient.catalogFoodSlug))
      .length,
    ingredients.length
  );
  const ingredientClarity = ratio(
    ingredients.reduce(
      (total, ingredient) =>
        total +
        Number(Boolean(ingredient.role)) +
        Number(Boolean(ingredient.measurementState)) +
        Number(Boolean(ingredient.usage)),
      0
    ),
    ingredients.length * 3
  );
  const preparationCoverage = ratio(
    foodPlan.meals.filter(
      (meal) =>
        meal.preparationSteps.length > 0 &&
        meal.prepTimeMinutes !== null &&
        meal.servingSummary.trim().length > 0
    ).length,
    foodPlan.meals.length
  );
  const preferredFoodHits = countPreferredFoodHits(foodPlan, preferredFoods);
  const tolerance = foodPlan.validation.tolerances;
  const targetScore =
    within(calorieDeviationPercent, tolerance.caloriesPercent) * 12 +
    within(proteinDeviationGrams, tolerance.proteinGrams) * 6 +
    within(carbsDeviationGrams, tolerance.carbsGrams) * 6 +
    within(fatDeviationGrams, tolerance.fatGrams) * 6;
  const score = Math.round(
    targetScore +
      catalogCoverage * 20 +
      ingredientClarity * 15 +
      preparationCoverage * 10 +
      (foodPlan.meals.length === expectedMealCount ? 10 : 0) +
      (preferredFoods.length === 0 || preferredFoodHits > 0 ? 5 : 0) +
      (foodPlan.source === 'NUTRITION_AGENT' ? 10 : 0)
  );

  return {
    score,
    source: foodPlan.source,
    validationStatus: foodPlan.validation.status,
    mealCount: foodPlan.meals.length,
    ingredientCount: ingredients.length,
    uniqueCatalogFoodCount: new Set(
      ingredients.flatMap((ingredient) => ingredient.catalogFoodSlug ?? [])
    ).size,
    catalogCoveragePercent: percent(catalogCoverage),
    ingredientClarityPercent: percent(ingredientClarity),
    preparationCoveragePercent: percent(preparationCoverage),
    preferredFoodHits,
    calorieDeviationPercent: round(calorieDeviationPercent),
    proteinDeviationGrams: round(proteinDeviationGrams),
    carbsDeviationGrams: round(carbsDeviationGrams),
    fatDeviationGrams: round(fatDeviationGrams),
    usedDeterministicFallback: foodPlan.source === 'DETERMINISTIC_FALLBACK'
  };
}

function evaluateTraining(
  plan: DailyPlanJson,
  trainingExpected: boolean
): BenchmarkPlanQuality['training'] {
  const exercises = plan.training.exercises ?? [];
  const selection = plan.debug?.exerciseSelection;
  const correctRestDay =
    !trainingExpected &&
    plan.training.intensity === 'REST' &&
    exercises.length === 0;
  if (!trainingExpected) {
    return {
      applicable: false,
      score: correctRestDay ? 100 : 0,
      intensity: plan.training.intensity,
      exerciseCount: exercises.length,
      requestedExerciseCount: selection?.requestedExerciseCount ?? null,
      catalogCoveragePercent: 0,
      prescriptionCoveragePercent: 0,
      targetMuscleCount: 0,
      usedAiRetry: selection?.usedAiRetry ?? false,
      usedDeterministicFallback: selection?.usedDeterministicFallback ?? false,
      correctRestDay
    };
  }

  const catalogCoverage = ratio(
    exercises.filter(
      (exercise) =>
        Boolean(exercise.exerciseId) &&
        Boolean(exercise.slug) &&
        Boolean(exercise.exerciseSnapshot)
    ).length,
    exercises.length
  );
  const prescriptionCoverage = ratio(
    exercises.filter(hasCompletePrescription).length,
    exercises.length
  );
  const targetMuscleCount = new Set(
    exercises.flatMap(
      (exercise) => exercise.exerciseSnapshot?.targetMuscles ?? []
    )
  ).size;
  const requestedCount = selection?.requestedExerciseCount ?? null;
  const countMatches =
    requestedCount === null
      ? exercises.length > 0
      : exercises.length === requestedCount;
  const usedAiRetry = selection?.usedAiRetry ?? false;
  const usedDeterministicFallback =
    selection?.usedDeterministicFallback ?? false;
  const muscleDiversity = Math.min(1, targetMuscleCount / 3);
  const score = Math.round(
    (!usedDeterministicFallback ? 20 : 0) +
      (!usedAiRetry ? 10 : 0) +
      (countMatches ? 15 : 0) +
      catalogCoverage * 20 +
      prescriptionCoverage * 20 +
      muscleDiversity * 10 +
      (plan.training.intensity !== 'REST' ? 5 : 0)
  );

  return {
    applicable: true,
    score,
    intensity: plan.training.intensity,
    exerciseCount: exercises.length,
    requestedExerciseCount: requestedCount,
    catalogCoveragePercent: percent(catalogCoverage),
    prescriptionCoveragePercent: percent(prescriptionCoverage),
    targetMuscleCount,
    usedAiRetry,
    usedDeterministicFallback,
    correctRestDay: false
  };
}

function hasCompletePrescription(
  exercise: NonNullable<DailyPlanJson['training']['exercises']>[number]
) {
  if (exercise.exerciseSnapshot?.category === 'STRENGTH') {
    return Boolean(exercise.sets && exercise.reps && exercise.rest);
  }
  return Boolean(exercise.duration);
}

function countPreferredFoodHits(
  foodPlan: NonNullable<DailyPlanJson['nutrition']['foodPlan']>,
  preferredFoods: string[]
) {
  const content = foodPlan.meals
    .flatMap((meal) => [
      meal.title,
      ...meal.ingredients.map((ingredient) => ingredient.name)
    ])
    .join(' ')
    .toLowerCase();
  return preferredFoods.filter((food) => content.includes(food.toLowerCase()))
    .length;
}

function within(value: number, tolerance: number) {
  return value <= tolerance ? 1 : 0;
}

function percentDeviation(value: number, target: number) {
  return target > 0 ? (Math.abs(value - target) / target) * 100 : 0;
}

function absoluteDeviation(value: number, target: number) {
  return Math.abs(value - target);
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function percent(value: number) {
  return Math.round(value * 100);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return round(
    values.reduce((total, value) => total + value, 0) / values.length
  );
}

function averageNullable(values: Array<number | null>) {
  return average(values.filter((value): value is number => value !== null));
}
