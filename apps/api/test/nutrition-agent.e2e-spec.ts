import request from 'supertest';
import type { DailyFoodPlan } from '@optime/shared-types';
import { FoodCatalogSource, FoodPreparationLevel } from '@prisma/client';

import { dailyFoodPlanSchema } from '../src/modules/daily-plans/daily-plan-json.schema';
import { CatalogFallbackFoodPlanService } from '../src/modules/nutrition-agent/catalog-fallback-food-plan.service';
import { FoodPlanCatalogFeasibilityService } from '../src/modules/nutrition-agent/food-plan-catalog-feasibility.service';
import { FoodPlanCatalogRebalancerService } from '../src/modules/nutrition-agent/food-plan-catalog-rebalancer.service';
import { normalizeFoodPlanNutrition } from '../src/modules/nutrition-agent/food-plan-nutrition-normalizer';
import {
  calculateFoodPlanPortionScore,
  FoodPlanPortionSolverService
} from '../src/modules/nutrition-agent/food-plan-portion-solver.service';
import { FoodPlanRecipeTemplateService } from '../src/modules/nutrition-agent/food-plan-recipe-template.service';
import { FoodPlanTargetedMealRepairService } from '../src/modules/nutrition-agent/food-plan-targeted-meal-repair.service';
import { FoodPlanValidationService } from '../src/modules/nutrition-agent/food-plan-validation.service';
import { foodPracticalityRoles } from '../src/modules/nutrition-agent/food-adherence-practicality';
import {
  FOOD_CATALOG_SELECTION_ROLES,
  type DailyFoodCatalogSelection,
  type FoodCatalogSelectionRole
} from '../src/modules/food-catalog/food-catalog.types';
import {
  nutritionAgentFoodPlanDraftSchema,
  nutritionAgentFoodPlanOpenAiSchema
} from '../src/modules/nutrition-agent/nutrition-agent.openai-schema';
import type { NutritionAgentInput } from '../src/modules/nutrition-agent/nutrition-agent.types';
import { FoodCatalogService } from '../src/modules/food-catalog/food-catalog.service';
import { FoodCatalogSelectionService } from '../src/modules/food-catalog/food-catalog-selection.service';
import { foodCatalog } from '../prisma/seeds/foods/catalog';
import { SafetyService } from '../src/modules/safety/safety.service';
import { seedFoodCatalog } from '../prisma/seeds/foods/seed';
import { cleanupDatabase } from './helpers/cleanup';
import { authHeader, registerTestUser } from './helpers/auth';
import { createTestApp, TestApp } from './helpers/test-app';

describe('Specialized Nutrition Agent food plans', () => {
  let ctx: TestApp;
  const previousAiProvider = process.env.AI_PROVIDER;

  beforeAll(async () => {
    delete process.env.AI_PROVIDER;
    ctx = await createTestApp();
    await seedFoodCatalog(ctx.prisma);
  });

  beforeEach(async () => {
    await cleanupDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await cleanupDatabase(ctx.prisma);
    await ctx.app.close();
    if (previousAiProvider) {
      process.env.AI_PROVIDER = previousAiProvider;
    } else {
      delete process.env.AI_PROVIDER;
    }
  });

  it('accepts catalog-only AI meal drafts and keeps nutrition fields backend-owned', () => {
    const draft = {
      meals: [{
        id: 'breakfast-1',
        recipeTemplateId: 'omnivore-balanced-breakfast',
        mealType: 'BREAKFAST',
        title: 'Breakfast',
        shortDescription: null,
        prepTimeMinutes: 10,
        servingSummary: 'One serving',
        ingredients: [{
          catalogFoodSlug: 'oats-cooked',
          quantity: 180,
          unit: 'g',
          isOptional: false
        }],
        preparationSteps: ['Prepare simply.'],
        substitutions: [],
        explanation: { reasonCodes: ['TARGET_ALIGNED'], params: {} }
      }]
    };

    expect(nutritionAgentFoodPlanDraftSchema.safeParse(draft).success).toBe(true);
    expect(nutritionAgentFoodPlanDraftSchema.safeParse({
      ...draft,
      totals: { caloriesKcal: 100, proteinGrams: 1, carbsGrams: 1, fatGrams: 1 }
    }).success).toBe(false);
    expect(nutritionAgentFoodPlanDraftSchema.safeParse({
      ...draft,
      meals: [{
        ...draft.meals[0],
        ingredients: [{
          ...draft.meals[0].ingredients[0],
          name: 'Model-provided name'
        }]
      }]
    }).success).toBe(false);

    expect(nutritionAgentFoodPlanOpenAiSchema.required).toEqual(['meals']);
    expect(nutritionAgentFoodPlanOpenAiSchema.properties.meals.items.properties.ingredients.items.required).toEqual([
      'catalogFoodSlug',
      'quantity',
      'unit',
      'isOptional'
    ]);
    expect(nutritionAgentFoodPlanOpenAiSchema.properties.meals.items.required).toContain('recipeTemplateId');
  });

  it('shares diet-aware recipe templates between the AI planning context and deterministic fallback', async () => {
    const recipeTemplates = ctx.app.get(FoodPlanRecipeTemplateService);
    const selectionService = ctx.app.get(FoodCatalogSelectionService);
    const selection = await selectionService.selectForDailyPlan({
      locale: 'en-US',
      dietType: 'VEGAN',
      planLocalDate: '2026-07-16'
    });

    const veganTemplates = recipeTemplates.listAvailableForSelection({
      dietType: 'VEGAN',
      mealsPerDay: 3,
      catalogSelection: selection
    });
    const lowCarbTemplates = recipeTemplates.listForDailyPlan({
      dietType: 'LOW_CARB',
      mealsPerDay: 3
    });

    expect(veganTemplates).toHaveLength(3);
    expect(veganTemplates.map((template) => template.id)).toEqual([
      'vegan-protein-breakfast',
      'vegan-protein-grain-lunch',
      'vegan-balanced-dinner'
    ]);
    expect(lowCarbTemplates.every((template) => (
      !template.ingredients.some((ingredient) => ingredient.role === 'CARBOHYDRATE')
    ))).toBe(true);
    expect(recipeTemplates.toPlanningGuidance(veganTemplates)[0]).toMatchObject({
      id: 'vegan-protein-breakfast',
      mealType: 'BREAKFAST',
      preparationStyle: 'BOWL',
      prepTimeMinutes: 10,
      ingredientRoles: ['BREAKFAST_BASE', 'MAIN_PROTEIN', 'FRUIT']
    });
  });

  it('classifies catalog feasibility conservatively before OpenAI generation', async () => {
    const feasibility = ctx.app.get(FoodPlanCatalogFeasibilityService);
    const selectionService = ctx.app.get(FoodCatalogSelectionService);
    const target = { caloriesKcal: 2200, proteinGrams: 130, carbsGrams: 250, fatGrams: 70 };
    const selection = await selectionService.selectForDailyPlan({
      locale: 'en-US',
      dietType: 'OMNIVORE',
      planLocalDate: '2026-07-16'
    });

    expect(feasibility.assess({ target, catalogSelection: selection }).status).toBe('FEASIBLE');

    const limitedSelection: DailyFoodCatalogSelection = {
      candidates: selection.candidates,
      byRole: {
        ...selection.byRole,
        MAIN_PROTEIN: selection.byRole.MAIN_PROTEIN.slice(0, 1),
        CARBOHYDRATE: selection.byRole.CARBOHYDRATE.slice(0, 1),
        FAT: selection.byRole.FAT.slice(0, 1)
      }
    };
    expect(feasibility.assess({ target, catalogSelection: limitedSelection })).toMatchObject({
      status: 'LIMITED',
      reasonCodes: expect.arrayContaining(['CATALOG_MAIN_PROTEIN_ROLE_LIMITED'])
    });

    const emptyRoles = Object.fromEntries(
      FOOD_CATALOG_SELECTION_ROLES.map((role) => [role, []])
    ) as Record<FoodCatalogSelectionRole, []>;
    expect(feasibility.assess({
      target,
      catalogSelection: { candidates: [], byRole: emptyRoles }
    })).toMatchObject({
      status: 'UNAVAILABLE',
      reasonCodes: expect.arrayContaining(['CATALOG_SAFE_CANDIDATES_UNAVAILABLE'])
    });
  });

  it('adjusts safe catalog quantities closer to the deterministic nutrition target', async () => {
    const foodCatalogService = ctx.app.get(FoodCatalogService);
    const solver = ctx.app.get(FoodPlanPortionSolverService);
    const rebalancer = ctx.app.get(FoodPlanCatalogRebalancerService);
    const targetedRepair = ctx.app.get(FoodPlanTargetedMealRepairService);
    const candidates = await foodCatalogService.listAllowedCandidates({
      locale: 'en-US',
      dietType: 'OMNIVORE'
    });
    const selected = ['chicken-breast-cooked', 'brown-rice-cooked', 'olive-oil'].map((slug) => (
      candidates.find((candidate) => candidate.slug === slug)
    ));
    expect(selected.every(Boolean)).toBe(true);

    const [chicken, rice, oliveOil] = selected as NonNullable<(typeof selected)[number]>[];
    const targetIngredients = [
      makeCatalogIngredient(foodCatalogService, chicken, 240),
      makeCatalogIngredient(foodCatalogService, rice, 300),
      makeCatalogIngredient(foodCatalogService, oliveOil, 20)
    ];
    const initialIngredients = [
      makeCatalogIngredient(foodCatalogService, chicken, 120),
      makeCatalogIngredient(foodCatalogService, rice, 150),
      makeCatalogIngredient(foodCatalogService, oliveOil, 10)
    ];
    const targetTotals = sumFoodTotals(targetIngredients);
    const initialTotals = sumFoodTotals(initialIngredients);
    const inputPlan: DailyFoodPlan = {
      source: 'NUTRITION_AGENT',
      localDate: '2026-07-15',
      locale: 'en-US',
      nutritionTargetSnapshot: {} as DailyFoodPlan['nutritionTargetSnapshot'],
      totals: initialTotals,
      validation: {
        status: 'VALID',
        reasons: [],
        tolerances: { caloriesPercent: 5, proteinGrams: 10, carbsGrams: 15, fatGrams: 10 }
      },
      meals: [{
        id: 'lunch-1',
        mealType: 'LUNCH',
        title: 'Catalog lunch',
        shortDescription: null,
        ...initialTotals,
        prepTimeMinutes: 15,
        servingSummary: 'One serving',
        ingredients: initialIngredients,
        preparationSteps: ['Prepare simply.'],
        substitutions: [],
        explanation: { reasonCodes: ['TARGET_ALIGNED'] }
      }]
    };

    const result = solver.solve({
      foodPlan: inputPlan,
      target: targetTotals,
      catalogCandidates: [chicken, rice, oliveOil]
    });

    expect(result.adjusted).toBe(true);
    expect(result.afterScore).toBeLessThan(result.beforeScore);
    expect(result.foodPlan.meals[0].ingredients.map((ingredient) => ingredient.catalogFoodSlug)).toEqual([
      'chicken-breast-cooked',
      'brown-rice-cooked',
      'olive-oil'
    ]);
    expect(result.foodPlan.totals.caloriesKcal).toBeCloseTo(targetTotals.caloriesKcal, -1);
    expect(result.foodPlan.totals.proteinGrams).toBeCloseTo(targetTotals.proteinGrams, 0);
    expect(result.foodPlan.totals.carbsGrams).toBeCloseTo(targetTotals.carbsGrams, 0);
    expect(result.foodPlan.totals.fatGrams).toBeCloseTo(targetTotals.fatGrams, 0);

    const alreadyAlignedPlan: DailyFoodPlan = {
      ...inputPlan,
      totals: targetTotals,
      meals: [{
        ...inputPlan.meals[0],
        ...targetTotals,
        ingredients: targetIngredients
      }]
    };
    const unchanged = solver.solve({
      foodPlan: alreadyAlignedPlan,
      target: targetTotals,
      catalogCandidates: [chicken, rice, oliveOil]
    });

    expect(unchanged.adjusted).toBe(false);
    expect(unchanged.foodPlan).toEqual(alreadyAlignedPlan);

    const salmon = candidates.find((candidate) => candidate.slug === 'salmon-cooked');
    expect(salmon).toBeDefined();
    if (!salmon) throw new Error('Expected salmon in the curated catalog.');

    const rebalanceIngredients = [
      makeCatalogIngredient(foodCatalogService, chicken, 150),
      makeCatalogIngredient(foodCatalogService, rice, 200)
    ];
    const rebalanceTarget = sumFoodTotals([
      makeCatalogIngredient(foodCatalogService, salmon, 150),
      makeCatalogIngredient(foodCatalogService, rice, 200)
    ]);
    const rebalancePlan: DailyFoodPlan = {
      ...inputPlan,
      totals: sumFoodTotals(rebalanceIngredients),
      meals: [{
        ...inputPlan.meals[0],
        title: 'Balanced lunch',
        ...sumFoodTotals(rebalanceIngredients),
        ingredients: rebalanceIngredients
      }]
    };
    const rebalanced = rebalancer.rebalance({
      foodPlan: rebalancePlan,
      target: rebalanceTarget,
      catalogCandidates: [chicken, salmon, rice]
    });

    expect(rebalanced.rebalanced).toBe(true);
    expect(rebalanced.afterScore).toBeLessThan(rebalanced.beforeScore);
    expect(rebalanced.foodPlan.meals[0].ingredients.map((ingredient) => ingredient.catalogFoodSlug)).toContain('salmon-cooked');

    const protectedCopy = rebalancer.rebalance({
      foodPlan: {
        ...rebalancePlan,
        meals: [{ ...rebalancePlan.meals[0], title: 'Chicken lunch' }]
      },
      target: rebalanceTarget,
      catalogCandidates: [chicken, salmon, rice]
    });
    expect(protectedCopy.rebalanced).toBe(false);

    const snackIngredients = [makeCatalogIngredient(foodCatalogService, oliveOil, 5)];
    const snackTotals = sumFoodTotals(snackIngredients);
    const stableSnack = {
      ...inputPlan.meals[0],
      id: 'snack-1',
      mealType: 'SNACK' as const,
      title: 'Stable snack',
      ...snackTotals,
      prepTimeMinutes: 5,
      ingredients: snackIngredients
    };
    const twoMealPlan: DailyFoodPlan = {
      ...rebalancePlan,
      meals: [rebalancePlan.meals[0], stableSnack],
      totals: sumFoodTotals([rebalancePlan.meals[0], stableSnack])
    };
    const targeted = targetedRepair.repair({
      foodPlan: twoMealPlan,
      target: sumFoodTotals([rebalanceTarget, snackTotals]),
      catalogCandidates: [chicken, salmon, rice, oliveOil]
    });

    expect(targeted.repaired).toBe(true);
    expect(targeted.mealId).toBe('lunch-1');
    expect(targeted.afterScore).toBeLessThan(targeted.beforeScore);
    expect(targeted.foodPlan.meals.find((meal) => meal.id === 'snack-1')).toEqual(stableSnack);
  });

  it('ships an expanded curated catalog and filters tagged foods before planning', async () => {
    expect(foodCatalog).toHaveLength(80);

    const service = ctx.app.get(FoodCatalogService);
    const candidates = await service.listAllowedCandidates({
      locale: 'en-US',
      dietType: 'VEGAN',
      restrictions: {
        allergies: ['soy', 'sesame'],
        excludedFoods: ['couscous']
      }
    });
    const slugs = candidates.map((candidate) => candidate.slug);

    expect(slugs).toContain('black-beans-cooked');
    expect(slugs).toContain('sweet-potato-baked');
    expect(slugs).not.toContain('tempeh');
    expect(slugs).not.toContain('edamame-cooked');
    expect(slugs).not.toContain('unsweetened-soy-milk');
    expect(slugs).not.toContain('tahini');
    expect(slugs).not.toContain('couscous-cooked');
  });

  it('builds a compact, date-stable catalog shortlist that keeps preferences and restrictions safe', async () => {
    const service = ctx.app.get(FoodCatalogSelectionService);
    const input = {
      locale: 'en-US' as const,
      dietType: 'VEGAN' as const,
      planLocalDate: '2026-07-14',
      preferredFoods: ['potato'],
      restrictions: {
        allergies: ['soy', 'sesame'],
        excludedFoods: ['couscous']
      }
    };
    const first = await service.selectForDailyPlan(input);
    const second = await service.selectForDailyPlan(input);

    expect(first.candidates.length).toBeLessThanOrEqual(35);
    expect(first.candidates.map((candidate) => candidate.slug)).toEqual(
      second.candidates.map((candidate) => candidate.slug)
    );
    expect(first.byRole.VEGETABLE.length).toBeGreaterThan(0);
    expect(first.byRole.MAIN_PROTEIN.map((candidate) => candidate.slug)).toEqual(
      expect.not.arrayContaining(['tempeh', 'edamame-cooked'])
    );
    expect(first.candidates.map((candidate) => candidate.slug)).not.toContain('couscous-cooked');
    expect(first.byRole.CARBOHYDRATE[0]?.slug).toBe('baked-potato');
  });

  it('stores a structured foodPlan inside generated DailyPlanJson', async () => {
    const user = await registerTestUser(ctx.app, 'nutrition-agent-plan@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {
      mealsPerDay: 4,
      preferredFoods: ['rice', 'eggs']
    });

    const response = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const foodPlan = response.body.plan.nutrition.foodPlan as DailyFoodPlan;

    expect(dailyFoodPlanSchema.safeParse(foodPlan).success).toBe(true);
    expect(response.body.plan.nutrition.meals).toEqual(foodPlan.meals.map((meal) => ({
      name: meal.title,
      purpose: meal.shortDescription ?? meal.servingSummary,
      foods: meal.ingredients.map((ingredient) => ({
        name: ingredient.name,
        portion: `${ingredient.quantity} ${ingredient.unit}`
      }))
    })));
    expect(foodPlan.source).toBe('NUTRITION_AGENT');
    expect(foodPlan.meals).toHaveLength(4);
    expect(foodPlan.nutritionTargetSnapshot.targetKcal).toBe(
      response.body.plan.nutritionTargetSnapshot.targetKcal
    );
    const targetKcal = response.body.plan.nutritionTargetSnapshot.targetKcal;
    expect(Math.abs(foodPlan.totals.caloriesKcal - targetKcal)).toBeLessThanOrEqual(
      Math.max(100, Math.round(targetKcal * 0.05))
    );
    expect(foodPlan.meals[0].ingredients[0]).toMatchObject({
      unit: 'g',
      isOptional: false
    });
    expect(foodPlan.meals[0].title).not.toBe('Breakfast');
    expect(foodPlan.meals[0].title).toContain(foodPlan.meals[0].ingredients[0].name);
    expect(foodPlan.meals[0].prepTimeMinutes).toBe(10);
    expect(foodPlan.meals[0].preparationSteps).toHaveLength(2);
    expect(foodPlan.meals[0].preparationSteps[0]).toContain(
      foodPlan.meals[0].ingredients[0].name
    );
    expect(foodPlan.meals[0].substitutions[0].reasonCode).toBe('SIMILAR_MACROS');

    const persistedPlan = await ctx.prisma.dailyPlan.findUniqueOrThrow({
      where: { id: response.body.id }
    });
    const persistedFoodPlan = (persistedPlan.planJson as unknown as {
      nutrition: { foodPlan: DailyFoodPlan };
    }).nutrition.foodPlan;

    expect(
      persistedFoodPlan.meals
        .flatMap((meal) => meal.ingredients)
        .every((ingredient) => Boolean(ingredient.catalogFoodSlug))
    ).toBe(true);
  });

  it('builds a complete catalog-backed fallback menu without excluded foods', async () => {
    const service = ctx.app.get(CatalogFallbackFoodPlanService);
    await ctx.prisma.foodCatalogItem.upsert({
      where: { slug: 'usda-fdc-323505' },
      update: { isActive: true },
      create: {
        slug: 'usda-fdc-323505',
        source: FoodCatalogSource.USDA_FDC,
        sourceFoodId: '323505',
        category: 'VEGETABLE',
        caloriesPer100g: 35,
        proteinPer100g: 2.9,
        carbsPer100g: 4.4,
        fatPer100g: 1.5,
        fiberPer100g: 4.1,
        dietTypes: ['OMNIVORE', 'VEGETARIAN', 'VEGAN', 'PESCATARIAN', 'MEDITERRANEAN'],
        restrictionTags: [],
        isActive: true,
        translations: {
          create: { locale: 'EN_US', name: 'Raw kale', aliases: ['kale'] }
        }
      }
    });

    const input = {
      planLocalDate: '2026-07-16',
      locale: 'en-US',
      planQualityMode: 'BASIC',
      appMode: 'NUTRITION_ONLY',
      safeMode: false,
      isMinor: false,
      nutritionTarget: {
        safety: { status: 'OK' },
        calories: { targetKcal: 2200 },
        macros: { proteinGrams: 130, carbsGrams: 250, fatGrams: 70 }
      },
      nutritionTargetSnapshot: {
        engineVersion: 1,
        localDate: '2026-07-16',
        dayType: 'REST_DAY',
        appMode: 'NUTRITION_ONLY',
        primaryGoal: 'HEALTHY_EATING',
        targetKcal: 2200,
        minKcal: 2000,
        maxKcal: 2400,
        maintenanceEstimateKcal: 2200,
        proteinGrams: 130,
        carbsGrams: 250,
        fatGrams: 70,
        safetyStatus: 'OK',
        safetyReasons: [],
        explanation: { titleCode: 'TODAY_TARGET', reasonCodes: [] }
      },
      nutritionPreference: {
        dietType: 'OMNIVORE',
        mealsPerDay: 3,
        notes: null,
        allergies: ['milk', 'fish', 'soy', 'tree nuts'],
        excludedFoods: ['avocado'],
        dislikedFoods: [],
        preferredFoods: ['kale']
      },
      goalSummary: null,
      resolvedTrainingDay: { isTrainingDay: false }
    } as unknown as NutritionAgentInput;
    const fallback = await service.create(input, ['NUTRITION_AGENT_OPENAI_FAILED']);
    const firstCandidate = await service.compose(input, [], 'NUTRITION_AGENT', {
      candidateVariants: 1
    });

    expect(fallback).not.toBeNull();
    if (!fallback) throw new Error('Expected a catalog-backed fallback food plan.');
    expect(firstCandidate).not.toBeNull();
    if (!firstCandidate) throw new Error('Expected an initial catalog food plan candidate.');
    expect(dailyFoodPlanSchema.safeParse(fallback).success).toBe(true);
    expect(fallback.source).toBe('DETERMINISTIC_FALLBACK');
    expect(fallback.meals).toHaveLength(3);
    expect(fallback.meals[0].ingredients).toHaveLength(3);
    expect(fallback.meals.flatMap((meal) => meal.ingredients).every((ingredient) => ingredient.catalogFoodSlug)).toBe(true);
    expect(fallback.meals.flatMap((meal) => meal.ingredients).some((ingredient) => ingredient.catalogFoodSlug === 'avocado')).toBe(false);
    expect(fallback.meals.flatMap((meal) => meal.ingredients).some((ingredient) => (
      ['greek-yogurt-plain', 'salmon-cooked', 'firm-tofu', 'almonds'].includes(ingredient.catalogFoodSlug ?? '')
    ))).toBe(false);
    const allowedCandidates = await ctx.app.get(FoodCatalogService).listAllowedCandidates({
      locale: 'en-US',
      dietType: 'OMNIVORE',
      restrictions: {
        allergies: ['milk', 'fish', 'soy', 'tree nuts'],
        excludedFoods: ['avocado']
      }
    });
    expect(allowedCandidates.some((candidate) => candidate.slug === 'usda-fdc-323505')).toBe(true);

    const ingredientTotals = fallback.meals.flatMap((meal) => meal.ingredients).reduce(
      (totals, ingredient) => ({
        caloriesKcal: totals.caloriesKcal + ingredient.caloriesKcal,
        proteinGrams: totals.proteinGrams + ingredient.proteinGrams,
        carbsGrams: totals.carbsGrams + ingredient.carbsGrams,
        fatGrams: totals.fatGrams + ingredient.fatGrams
      }),
      { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
    );
    expect(fallback.totals.caloriesKcal).toBe(ingredientTotals.caloriesKcal);
    expect(fallback.totals.proteinGrams).toBeCloseTo(ingredientTotals.proteinGrams, 1);
    expect(fallback.totals.carbsGrams).toBeCloseTo(ingredientTotals.carbsGrams, 1);
    expect(fallback.totals.fatGrams).toBeCloseTo(ingredientTotals.fatGrams, 1);
    const target = { caloriesKcal: 2200, proteinGrams: 130, carbsGrams: 250, fatGrams: 70 };
    expect(calculateFoodPlanPortionScore(fallback.totals, target)).toBeLessThanOrEqual(
      calculateFoodPlanPortionScore(firstCandidate.totals, target) + 0.0001
    );
    await ctx.prisma.foodCatalogItem.delete({ where: { slug: 'usda-fdc-323505' } });
  });

  it('uses practical catalog ingredients for a frequently skipped personalized breakfast', async () => {
    const service = ctx.app.get(CatalogFallbackFoodPlanService);
    const input = {
      planLocalDate: '2026-07-17',
      locale: 'en-US',
      planQualityMode: 'PERSONALIZED',
      appMode: 'NUTRITION_ONLY',
      safeMode: false,
      isMinor: false,
      nutritionTarget: {
        safety: { status: 'OK' },
        calories: { targetKcal: 2200 },
        macros: { proteinGrams: 130, carbsGrams: 250, fatGrams: 70 }
      },
      nutritionTargetSnapshot: {
        engineVersion: 1,
        localDate: '2026-07-17',
        dayType: 'REST_DAY',
        appMode: 'NUTRITION_ONLY',
        primaryGoal: 'HEALTHY_EATING',
        targetKcal: 2200,
        minKcal: 2000,
        maxKcal: 2400,
        maintenanceEstimateKcal: 2200,
        proteinGrams: 130,
        carbsGrams: 250,
        fatGrams: 70,
        safetyStatus: 'OK',
        safetyReasons: [],
        explanation: { titleCode: 'TODAY_TARGET', reasonCodes: [] }
      },
      nutritionPreference: {
        dietType: 'OMNIVORE',
        mealsPerDay: 3,
        notes: null,
        allergies: [],
        excludedFoods: [],
        dislikedFoods: [],
        preferredFoods: []
      },
      goalSummary: null,
      resolvedTrainingDay: { isTrainingDay: false },
      foodAdherenceSummary: {
        daysWithTrackedMeals: 3,
        markedMealCount: 6,
        completedMealCount: 3,
        partialMealCount: 1,
        skippedMealCount: 2,
        commonSkippedMealTypes: ['BREAKFAST']
      }
    } as unknown as NutritionAgentInput;
    const plan = await service.compose(input, [], 'NUTRITION_AGENT', { candidateVariants: 1 });
    const levelsBySlug = new Map((await ctx.app.get(FoodCatalogService).listAllowedCandidates({
      locale: 'en-US',
      dietType: 'OMNIVORE'
    })).map((candidate) => [candidate.slug, candidate.preparationLevel]));
    const breakfast = plan?.meals.find((meal) => meal.mealType === 'BREAKFAST');

    expect(breakfast).toBeDefined();
    expect(breakfast?.ingredients).not.toHaveLength(0);
    expect(breakfast?.ingredients.every((ingredient) => (
      levelsBySlug.get(ingredient.catalogFoodSlug ?? '') === FoodPreparationLevel.READY_TO_EAT
    ))).toBe(true);
    expect(breakfast?.prepTimeMinutes).toBe(5);
    expect(breakfast?.preparationSteps[1]).toBe('Combine the ready-to-eat ingredients and serve.');
  });

  it('prioritizes practical catalog roles from an explicit very-quick cooking preference', () => {
    const roles = foodPracticalityRoles({
      planQualityMode: 'BASIC',
      mealPracticalityPreference: { cookingTime: 'VERY_QUICK' }
    } as NutritionAgentInput);

    expect(roles).toEqual(FOOD_CATALOG_SELECTION_ROLES);
  });

  it('keeps standard catalog ranking for flexible cooking-time preferences', () => {
    const roles = foodPracticalityRoles({
      planQualityMode: 'BASIC',
      mealPracticalityPreference: { cookingTime: 'FIFTEEN_TO_THIRTY' }
    } as NutritionAgentInput);

    expect(roles).toEqual([]);
  });

  it('filters catalog candidates by multilingual allergy synonyms before AI generation', async () => {
    const service = ctx.app.get(FoodCatalogService);
    const candidates = await service.listAllowedCandidates({
      locale: 'ru-RU',
      dietType: 'OMNIVORE',
      restrictions: {
        allergies: ['молоко', 'рыба', 'соя', 'орехи'],
        excludedFoods: ['авокадо']
      }
    });
    const slugs = candidates.map((candidate) => candidate.slug);

    expect(slugs).not.toContain('greek-yogurt-plain');
    expect(slugs).not.toContain('salmon-cooked');
    expect(slugs).not.toContain('firm-tofu');
    expect(slugs).not.toContain('almonds');
    expect(slugs).not.toContain('avocado');
    expect(slugs).toContain('chicken-breast-cooked');
    expect(candidates.find((candidate) => candidate.slug === 'chicken-breast-cooked')?.name).toBe('Готовая куриная грудка');
  });

  it('validates foodPlan schema for meal types, ingredient quantities, and negative macros', async () => {
    const user = await registerTestUser(ctx.app, 'nutrition-agent-schema@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);
    const validFoodPlan = generated.body.plan.nutrition.foodPlan as DailyFoodPlan;

    expect(dailyFoodPlanSchema.safeParse(validFoodPlan).success).toBe(true);

    expect(
      dailyFoodPlanSchema.safeParse({
        ...validFoodPlan,
        meals: [{ ...validFoodPlan.meals[0], mealType: 'BRUNCH' }]
      }).success
    ).toBe(false);

    expect(
      dailyFoodPlanSchema.safeParse({
        ...validFoodPlan,
        meals: [
          {
            ...validFoodPlan.meals[0],
            ingredients: [{ ...validFoodPlan.meals[0].ingredients[0], quantity: undefined }]
          }
        ]
      }).success
    ).toBe(false);

    expect(
      dailyFoodPlanSchema.safeParse({
        ...validFoodPlan,
        meals: [{ ...validFoodPlan.meals[0], proteinGrams: -1 }]
      }).success
    ).toBe(false);
  });

  it('keeps old text-only food sections readable while new plans prefer foodPlan', async () => {
    const user = await registerTestUser(ctx.app, 'nutrition-agent-legacy@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const legacyJson = {
      ...generated.body.plan,
      nutrition: {
        ...generated.body.plan.nutrition,
        foodPlan: undefined
      }
    };
    delete legacyJson.nutrition.foodPlan;

    await ctx.prisma.dailyPlan.update({
      where: { id: generated.body.id },
      data: { planJson: legacyJson }
    });

    const today = await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/today')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(today.body.plan.nutrition.foodPlan).toBeUndefined();
    expect(today.body.plan.nutrition.meals.length).toBeGreaterThan(0);
  });

  it('rejects invalid food-plan arithmetic and target mismatch deterministically', async () => {
    const user = await registerTestUser(ctx.app, 'nutrition-agent-validation@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const validator = new FoodPlanValidationService();
    const foodPlan = generated.body.plan.nutrition.foodPlan as DailyFoodPlan;
    const invalidPlan = {
      ...foodPlan,
      totals: {
        ...foodPlan.totals,
        caloriesKcal: foodPlan.totals.caloriesKcal + 900
      }
    };
    const result = validator.validate(invalidPlan, {
      nutritionTarget: await getNutritionTarget(user.accessToken),
      nutritionTargetSnapshot: generated.body.plan.nutritionTargetSnapshot,
      allergies: [],
      excludedFoods: [],
      safeMode: false,
      isMinor: false
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining(['DAILY_TOTALS_DO_NOT_MATCH_MEALS', 'CALORIES_OUTSIDE_TARGET_TOLERANCE'])
    );
  });

  it('normalizes calculated ingredient totals before food-plan validation', async () => {
    const user = await registerTestUser(ctx.app, 'nutrition-agent-totals-normalizer@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);
    const foodPlan = generated.body.plan.nutrition.foodPlan as DailyFoodPlan;
    const inconsistent: DailyFoodPlan = {
      ...foodPlan,
      totals: { caloriesKcal: 1, proteinGrams: 1, carbsGrams: 1, fatGrams: 1 },
      meals: foodPlan.meals.map((meal) => ({
        ...meal,
        caloriesKcal: 1,
        proteinGrams: 1,
        carbsGrams: 1,
        fatGrams: 1
      }))
    };

    const normalized = normalizeFoodPlanNutrition(inconsistent);
    const validator = new FoodPlanValidationService();
    const result = validator.validate(normalized, {
      nutritionTarget: await getNutritionTarget(user.accessToken),
      nutritionTargetSnapshot: generated.body.plan.nutritionTargetSnapshot,
      allergies: [],
      excludedFoods: [],
      safeMode: false,
      isMinor: false
    });

    const ingredientTotals = sumFoodTotals(normalized.meals.flatMap((meal) => meal.ingredients));
    expect(normalized.totals.caloriesKcal).toBe(ingredientTotals.caloriesKcal);
    expect(normalized.totals.proteinGrams).toBeCloseTo(ingredientTotals.proteinGrams, 6);
    expect(normalized.totals.carbsGrams).toBeCloseTo(ingredientTotals.carbsGrams, 6);
    expect(normalized.totals.fatGrams).toBeCloseTo(ingredientTotals.fatGrams, 6);
    expect(result.reasons).not.toEqual(
      expect.arrayContaining([
        'DAILY_TOTALS_DO_NOT_MATCH_MEALS',
        'DAILY_MACROS_DO_NOT_MATCH_MEALS',
        'MEAL_TOTALS_DO_NOT_MATCH_INGREDIENTS',
        'MEAL_MACROS_DO_NOT_MATCH_INGREDIENTS'
      ])
    );
  });

  it('blocks allergy and excluded-food conflicts inside structured foodPlan ingredients', async () => {
    const user = await registerTestUser(ctx.app, 'nutrition-agent-restricted-food@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {
      allergies: ['avocado'],
      excludedFoods: ['pork']
    });

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);
    const plan = generated.body.plan;

    plan.nutrition.foodPlan.meals[0].ingredients[0].name = 'Avocado toast';
    const safety = new SafetyService().validatePlanFoodSafety(plan, {
      allergies: ['avocado'],
      excludedFoods: ['pork']
    });

    expect(safety.passed).toBe(false);
    expect(safety.conflicts[0]).toMatchObject({
      conflictType: 'allergy',
      restrictedFood: 'avocado',
      matchedPath: 'nutrition.foodPlan.meals[0].ingredients[0].name'
    });
  });

  it('does not recreate an excluded fallback placeholder ingredient', async () => {
    const user = await registerTestUser(ctx.app, 'nutrition-agent-excluded-placeholder@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {
      preferredFoods: ['No'],
      excludedFoods: ['Balanced No plate']
    });

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    expect(generated.body.status).toBe('READY');
    const ingredientNames = (generated.body.plan.nutrition.foodPlan as DailyFoodPlan).meals
      .flatMap((meal) => meal.ingredients.map((ingredient) => ingredient.name.toLowerCase()));
    expect(ingredientNames).not.toContain('balanced no plate');
  });

  it('blocks restricted foods in structured foodPlan substitutions and preparation steps', async () => {
    const user = await registerTestUser(ctx.app, 'nutrition-agent-substitution-safety@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {
      allergies: ['avocado'],
      excludedFoods: ['pork']
    });

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);
    const plan = generated.body.plan;

    plan.nutrition.foodPlan.meals[0].substitutions[0].replacementItem = 'Avocado';
    expect(
      new SafetyService().validatePlanFoodSafety(plan, {
        allergies: ['avocado'],
        excludedFoods: ['pork']
      }).passed
    ).toBe(false);

    plan.nutrition.foodPlan.meals[0].substitutions[0].replacementItem = 'Greek yogurt';
    plan.nutrition.foodPlan.meals[0].preparationSteps = ['Serve with pork on the side.'];
    expect(
      new SafetyService().validatePlanFoodSafety(plan, {
        allergies: ['avocado'],
        excludedFoods: ['pork']
      }).passed
    ).toBe(false);
  });

  it('updates excluded and disliked foods through the food preferences endpoint', async () => {
    const user = await registerTestUser(ctx.app, 'food-preferences-update@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const response = await request(ctx.app.getHttpServer())
      .patch('/v1/food-preferences')
      .set(authHeader(user.accessToken))
      .send({
        dietType: 'NONE',
        mealsPerDay: 3,
        noKnownAllergiesConfirmed: true,
        allergies: [],
        excludedFoods: ['walnuts'],
        dislikedFoods: ['mushrooms'],
        preferredFoods: ['rice']
      })
      .expect(200);

    expect(response.body.excludedFoods.map((food: { name: string }) => food.name)).toEqual(['walnuts']);
    expect(response.body.dislikedFoods.map((food: { name: string }) => food.name)).toEqual(['mushrooms']);
  });

  it('adds an excluded ingredient without changing the current food plan', async () => {
    const user = await registerTestUser(ctx.app, 'exclude-ingredient@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);
    const beforeFoodPlan = generated.body.plan.nutrition.foodPlan as DailyFoodPlan;
    const ingredientName = beforeFoodPlan.meals[0].ingredients[0].name;

    const response = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${generated.body.id}/food/exclude-ingredient`)
      .set(authHeader(user.accessToken))
      .send({ ingredientName })
      .expect(201);

    expect(response.body.excludedFoods.map((food: { name: string }) => food.name)).toContain(ingredientName);

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${generated.body.id}/food/exclude-ingredient`)
      .set(authHeader(user.accessToken))
      .send({ ingredientName })
      .expect(201);

    const preferences = await request(ctx.app.getHttpServer())
      .get('/v1/food-preferences')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(
      preferences.body.excludedFoods.filter((food: { name: string }) => food.name === ingredientName)
    ).toHaveLength(1);

    const today = await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/today')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(today.body.plan.nutrition.foodPlan).toEqual(beforeFoodPlan);
  });

  it('regenerates the full food menu while preserving nutrition target and non-food plan sections', async () => {
    const user = await registerTestUser(ctx.app, 'full-menu-regeneration@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);
    const beforePlan = generated.body.plan;
    const beforeTarget = beforePlan.nutrition.foodPlan.nutritionTargetSnapshot;

    const regenerated = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${generated.body.id}/food/regenerate`)
      .set(authHeader(user.accessToken))
      .send({ reason: 'I want a different full menu.' })
      .expect(201);

    const foodPlan = regenerated.body.plan.nutrition.foodPlan as DailyFoodPlan;
    expect(foodPlan.nutritionTargetSnapshot).toEqual(beforeTarget);
    expect(foodPlan.source).toBe('NUTRITION_AGENT');
    expect(foodPlan.validation.status).toBe('VALID');
    expect(
      foodPlan.meals.map((meal) => meal.ingredients.map((ingredient) => ingredient.name))
    ).not.toEqual(
      beforePlan.nutrition.foodPlan.meals.map((meal: DailyFoodPlan['meals'][number]) => (
        meal.ingredients.map((ingredient) => ingredient.name)
      ))
    );
    expect(regenerated.body.plan.training).toEqual(beforePlan.training);
    expect(regenerated.body.plan.recovery).toEqual(beforePlan.recovery);
    expect(regenerated.body.plan.reminders).toEqual(beforePlan.reminders);
  });

  it('regenerates one meal and keeps the stored nutrition target snapshot', async () => {
    const user = await registerTestUser(ctx.app, 'meal-regeneration@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);
    const beforeFoodPlan = generated.body.plan.nutrition.foodPlan as DailyFoodPlan;
    const selectedMealId = beforeFoodPlan.meals[0].id;

    const regenerated = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${generated.body.id}/food/meals/${selectedMealId}/regenerate`)
      .set(authHeader(user.accessToken))
      .send({ reason: 'I do not like this meal.' })
      .expect(201);

    const foodPlan = regenerated.body.plan.nutrition.foodPlan as DailyFoodPlan;
    expect(foodPlan.nutritionTargetSnapshot).toEqual(beforeFoodPlan.nutritionTargetSnapshot);
    expect(foodPlan.meals.find((meal) => meal.id === selectedMealId)?.shortDescription).toContain('Meal refreshed');
    expect(
      foodPlan.meals.find((meal) => meal.id === selectedMealId)?.ingredients.map((ingredient) => ingredient.name)
    ).not.toEqual(
      beforeFoodPlan.meals.find((meal) => meal.id === selectedMealId)?.ingredients.map((ingredient) => ingredient.name)
    );
    expect(foodPlan.meals.slice(1)).toEqual(beforeFoodPlan.meals.slice(1));
  });

  it('rejects invalid meal regeneration and old text-only plans without mutating the plan', async () => {
    const user = await registerTestUser(ctx.app, 'meal-regeneration-invalid@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);
    const beforeFoodPlan = generated.body.plan.nutrition.foodPlan as DailyFoodPlan;

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${generated.body.id}/food/meals/not-a-real-meal/regenerate`)
      .set(authHeader(user.accessToken))
      .send({ reason: 'Try another option.' })
      .expect(400);

    let today = await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/today')
      .set(authHeader(user.accessToken))
      .expect(200);
    expect(today.body.plan.nutrition.foodPlan).toEqual(beforeFoodPlan);

    const legacyJson = {
      ...today.body.plan,
      nutrition: {
        ...today.body.plan.nutrition
      }
    };
    delete legacyJson.nutrition.foodPlan;

    await ctx.prisma.dailyPlan.update({
      where: { id: generated.body.id },
      data: { planJson: legacyJson }
    });

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${generated.body.id}/food/regenerate`)
      .set(authHeader(user.accessToken))
      .send({ reason: 'Try another full menu.' })
      .expect(400);
  });

  async function completeNutritionOnlyOnboarding(
    token: string,
    overrides: {
      mealsPerDay?: number;
      allergies?: string[];
      excludedFoods?: string[];
      dislikedFoods?: string[];
      preferredFoods?: string[];
    }
  ) {
    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(token))
      .send({
        firstName: 'Nutrition',
        gender: 'prefer_not_to_say',
        dateOfBirth: '1990-01-01',
        heightCm: 178,
        weightKg: 78,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    await request(ctx.app.getHttpServer())
      .put('/v1/goals')
      .set(authHeader(token))
      .send({
        primaryGoal: 'HEALTHY_EATING',
        appMode: 'NUTRITION_ONLY'
      })
      .expect(200);

    await request(ctx.app.getHttpServer())
      .put('/v1/nutrition-preferences')
      .set(authHeader(token))
      .send({
        dietType: 'NONE',
        mealsPerDay: overrides.mealsPerDay ?? 3,
        noKnownAllergiesConfirmed: !overrides.allergies?.length,
        allergies: overrides.allergies ?? [],
        excludedFoods: overrides.excludedFoods ?? [],
        dislikedFoods: overrides.dislikedFoods ?? [],
        preferredFoods: overrides.preferredFoods ?? ['oats', 'chicken']
      })
      .expect(200);
  }

  async function getNutritionTarget(token: string) {
    const response = await request(ctx.app.getHttpServer())
      .get('/v1/nutrition-targets/preview')
      .set(authHeader(token))
      .expect(200);

    return response.body;
  }
});

function makeCatalogIngredient(
  foodCatalogService: FoodCatalogService,
  candidate: Awaited<ReturnType<FoodCatalogService['listAllowedCandidates']>>[number],
  quantity: number
) {
  const nutrition = foodCatalogService.calculateNutrition(candidate, quantity);
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
  };
}

function sumFoodTotals(items: Array<Pick<DailyFoodPlan['totals'], 'caloriesKcal' | 'proteinGrams' | 'carbsGrams' | 'fatGrams'>>) {
  return items.reduce(
    (totals, item) => ({
      caloriesKcal: totals.caloriesKcal + item.caloriesKcal,
      proteinGrams: totals.proteinGrams + item.proteinGrams,
      carbsGrams: totals.carbsGrams + item.carbsGrams,
      fatGrams: totals.fatGrams + item.fatGrams
    }),
    { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
  );
}
