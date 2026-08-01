import type { DailyPlanJson } from '../src/modules/daily-plans/daily-plan-json.schema';

export interface BenchmarkPlanQuality {
  scoreVersion: 'daily-plan-quality.v2';
  overallScore: number;
  adjustedSections: string[];
  contract: {
    passed: boolean;
    failures: string[];
  };
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
    menuOptionCount: number;
    expectedMenuOptionCount: number;
    distinctMenuOptionCount: number;
    menuOptionContractPassed: boolean;
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
    validationReasonCodes: string[];
    correctRestDay: boolean;
  };
}

export function evaluateBenchmarkPlanQuality(
  plan: DailyPlanJson,
  input: {
    trainingExpected: boolean;
    preferredFoods: string[];
    expectedMealCount: number;
    expectedMenuOptionCount?: number;
  }
): BenchmarkPlanQuality {
  const food = evaluateFood(
    plan,
    input.preferredFoods,
    input.expectedMealCount,
    input.expectedMenuOptionCount ?? 0
  );
  const training = evaluateTraining(plan, input.trainingExpected);
  const overallScore = training.applicable
    ? Math.round((food.score + training.score) / 2)
    : food.score;
  const contractFailures = buildContractFailures(plan, food, training);

  return {
    scoreVersion: 'daily-plan-quality.v2',
    overallScore,
    adjustedSections: plan.debug?.generation?.adjustedSections ?? [],
    contract: {
      passed: contractFailures.length === 0,
      failures: contractFailures
    },
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
    contract: {
      passedPlanCount: results.filter((result) => result.contract.passed)
        .length,
      failedPlanCount: results.filter((result) => !result.contract.passed)
        .length,
      failures: countValues(
        results.flatMap((result) => result.contract.failures)
      )
    },
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
      menuOptionContractPassCount: results.filter(
        (result) => result.food.menuOptionContractPassed
      ).length,
      averageMenuOptionCount: average(
        results.map((result) => result.food.menuOptionCount)
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
  expectedMealCount: number,
  expectedMenuOptionCount: number
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
      menuOptionCount: plan.nutrition.menuOptions?.length ?? 0,
      expectedMenuOptionCount,
      distinctMenuOptionCount: 0,
      menuOptionContractPassed: false,
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
  const menuOptions = plan.nutrition.menuOptions ?? [];
  const menuSignatures = menuOptions.map((option) =>
    option.meals
      .map((meal) =>
        [meal.name, ...meal.foods.map((food) => `${food.name}:${food.portion}`)]
          .join('|')
          .toLowerCase()
      )
      .join('||')
  );
  const distinctMenuOptionCount = new Set(menuSignatures).size;
  const menuOptionContractPassed =
    menuOptions.length === expectedMenuOptionCount &&
    distinctMenuOptionCount === menuOptions.length &&
    menuOptions.every((option) => option.meals.length === expectedMealCount);
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
    menuOptionCount: menuOptions.length,
    expectedMenuOptionCount,
    distinctMenuOptionCount,
    menuOptionContractPassed,
    preferredFoodHits,
    calorieDeviationPercent: round(calorieDeviationPercent),
    proteinDeviationGrams: round(proteinDeviationGrams),
    carbsDeviationGrams: round(carbsDeviationGrams),
    fatDeviationGrams: round(fatDeviationGrams),
    usedDeterministicFallback: foodPlan.source === 'DETERMINISTIC_FALLBACK'
  };
}

function buildContractFailures(
  plan: DailyPlanJson,
  food: BenchmarkPlanQuality['food'],
  training: BenchmarkPlanQuality['training']
) {
  const failures: string[] = [];
  if (plan.debug?.provider === 'fallback') failures.push('CORE_FALLBACK');
  if (plan.debug?.generation?.isComplete !== true) {
    failures.push('GENERATION_INCOMPLETE');
  }
  if (food.source !== 'NUTRITION_AGENT') {
    failures.push('NUTRITION_AGENT_NOT_AUTHORITATIVE');
  }
  if (food.validationStatus !== 'VALID') {
    failures.push('FOOD_PLAN_NOT_VALID');
  }
  if (food.catalogCoveragePercent !== 100) {
    failures.push('FOOD_CATALOG_COVERAGE_INCOMPLETE');
  }
  if (food.ingredientClarityPercent !== 100) {
    failures.push('INGREDIENT_CLARITY_INCOMPLETE');
  }
  if (food.preparationCoveragePercent !== 100) {
    failures.push('PREPARATION_COVERAGE_INCOMPLETE');
  }
  if (!food.menuOptionContractPassed) {
    failures.push('MENU_OPTION_CONTRACT_FAILED');
  }
  if (training.applicable) {
    if (training.exerciseCount === 0)
      failures.push('TRAINING_EXERCISES_MISSING');
    if (training.catalogCoveragePercent !== 100) {
      failures.push('EXERCISE_CATALOG_COVERAGE_INCOMPLETE');
    }
    if (training.prescriptionCoveragePercent !== 100) {
      failures.push('EXERCISE_PRESCRIPTION_INCOMPLETE');
    }
    if (training.usedDeterministicFallback) {
      failures.push('TRAINING_DETERMINISTIC_FALLBACK');
    }
  } else if (!training.correctRestDay) {
    failures.push('REST_DAY_CONTRACT_FAILED');
  }
  return failures;
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
      validationReasonCodes: selection?.validationReasonCodes ?? [],
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
    validationReasonCodes: selection?.validationReasonCodes ?? [],
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
  const normalizedTerms = foodPlan.meals.flatMap((meal) =>
    meal.ingredients.flatMap((ingredient) => [
      normalizeFoodTerm(ingredient.catalogFoodSlug ?? ''),
      normalizeFoodTerm(ingredient.name)
    ])
  );

  return preferredFoods.filter((food) => {
    const preference = normalizeFoodTerm(food);
    return normalizedTerms.some(
      (term) =>
        term.length > 0 &&
        (term.includes(preference) || preference.includes(term))
    );
  }).length;
}

function normalizeFoodTerm(value: string) {
  return value
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\b(cooked|raw|fresh|whole|large|small)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/s$/, '');
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

function countValues(values: string[]) {
  return Object.fromEntries(
    [...new Set(values)]
      .sort()
      .map((value) => [
        value,
        values.filter((candidate) => candidate === value).length
      ])
  );
}
