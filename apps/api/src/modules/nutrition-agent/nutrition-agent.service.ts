import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiRequestAgent,
  AiRequestOperation
} from '@prisma/client';
import type { DailyFoodPlan } from '@optime/shared-types';

import { AiModelRouterService } from '../ai-model-routing/ai-model-router.service';
import { AiRequestTelemetryService } from '../ai-operation-logs/ai-request-telemetry.service';
import {
  OpenAiClientFactory,
  OpenAiResponse,
  OpenAiResponsesClient,
  OPENAI_CLIENT_FACTORY
} from '../ai/open-ai-client.factory';
import { FoodCatalogService } from '../food-catalog/food-catalog.service';
import { FoodCatalogSelectionService } from '../food-catalog/food-catalog-selection.service';
import {
  FOOD_CATALOG_SELECTION_ROLES,
  type DailyFoodCatalogSelection,
  type FoodCatalogCandidate
} from '../food-catalog/food-catalog.types';
import { CatalogFallbackFoodPlanService } from './catalog-fallback-food-plan.service';
import {
  FoodPlanCatalogFeasibilityService,
  type FoodPlanCatalogFeasibilityResult
} from './food-plan-catalog-feasibility.service';
import { FoodPlanCatalogRebalancerService } from './food-plan-catalog-rebalancer.service';
import { createDeterministicFoodPlan } from './deterministic-food-plan.factory';
import { createFoodIngredientClarity } from '../food-catalog/food-ingredient-clarity';
import { normalizeFoodPlanNutrition } from './food-plan-nutrition-normalizer';
import { foodPracticalityRoles } from './food-adherence-practicality';
import { FoodPlanPortionSolverService } from './food-plan-portion-solver.service';
import { FoodPlanRecipeComposerService } from './food-plan-recipe-composer.service';
import {
  FoodPlanRecipeTemplateService,
  type FoodPlanRecipeTemplate
} from './food-plan-recipe-template.service';
import { FoodPlanTargetedMealRepairService } from './food-plan-targeted-meal-repair.service';
import { FoodPlanValidationService } from './food-plan-validation.service';
import { FoodRotationContextService } from './food-rotation-context.service';
import {
  nutritionAgentMealCopyDraftSchema,
  nutritionAgentMealCopyOpenAiSchema,
  type NutritionAgentMealCopyDraft
} from './nutrition-agent-meal-copy.openai-schema';
import {
  nutritionAgentFoodPlanDraftSchema,
  nutritionAgentFoodPlanOpenAiSchema,
  type NutritionAgentFoodPlanDraft
} from './nutrition-agent.openai-schema';
import type {
  FoodPlanRepairFeedback,
  NutritionAgentInput,
  NutritionAgentResult
} from './nutrition-agent.types';

type NutritionAgentAttemptResult =
  | { ok: true; foodPlan: DailyFoodPlan; validationReasons: string[] }
  | {
      ok: false;
      validationReasons: string[];
      errorReason: string;
      repairFeedback?: FoodPlanRepairFeedback;
    };

@Injectable()
export class NutritionAgentService {
  private readonly logger = new Logger(NutritionAgentService.name);
  private client: OpenAiResponsesClient | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly validator: FoodPlanValidationService,
    private readonly foodCatalog: FoodCatalogService,
    private readonly foodCatalogSelection: FoodCatalogSelectionService,
    private readonly catalogFallbackFoodPlan: CatalogFallbackFoodPlanService,
    private readonly catalogFeasibility: FoodPlanCatalogFeasibilityService,
    private readonly catalogRebalancer: FoodPlanCatalogRebalancerService,
    private readonly targetedMealRepair: FoodPlanTargetedMealRepairService,
    private readonly portionSolver: FoodPlanPortionSolverService,
    private readonly recipeComposer: FoodPlanRecipeComposerService,
    private readonly recipeTemplates: FoodPlanRecipeTemplateService,
    private readonly foodRotationContext: FoodRotationContextService,
    private readonly modelRouter: AiModelRouterService,
    private readonly requestTelemetry: AiRequestTelemetryService,
    @Inject(OPENAI_CLIENT_FACTORY) private readonly clientFactory: OpenAiClientFactory
  ) {}

  async generateDailyFoodPlan(input: NutritionAgentInput): Promise<NutritionAgentResult> {
    input = {
      ...input,
      foodRotationContext:
        input.foodRotationContext ??
        (await this.foodRotationContext.getContext(
          input.userId,
          input.planLocalDate
        ))
    };

    if (input.regeneration?.mode === 'MEAL_REGENERATION') {
      const regeneratedMealPlan = await this.composeSingleMealRegeneration(input);
      if (regeneratedMealPlan) {
        const selectedMealId = input.regeneration.selectedMealId;
        const foodPlan = this.getProviderName() === 'openai' && selectedMealId
          ? await this.requestOpenAiSingleMealCopy(
              input,
              regeneratedMealPlan,
              selectedMealId
            )
          : regeneratedMealPlan;
        this.logResult(input, foodPlan, 0, []);
        return {
          foodPlan,
          retryCount: 0,
          fallbackUsed: false,
          validationReasonCodes: []
        };
      }
      const fallbackReasons = ['MEAL_REGENERATION_UNAVAILABLE'];
      const fallback = await this.createFallbackFoodPlan(input, fallbackReasons);
      this.logger.warn('nutrition agent deterministic meal composition unavailable; current plan will be kept');
      this.logResult(input, fallback, 0, fallbackReasons);
      return {
        foodPlan: fallback,
        retryCount: 0,
        fallbackUsed: true,
        validationReasonCodes: fallbackReasons
      };
    }

    if (this.getProviderName() !== 'openai') {
      return this.generateMockFoodPlan(input);
    }

    const firstAttempt = await this.requestOpenAiFoodPlan(input);

    if (firstAttempt.ok) {
      this.logResult(input, firstAttempt.foodPlan, 0, firstAttempt.validationReasons);
      return {
        foodPlan: firstAttempt.foodPlan,
        retryCount: 0,
        fallbackUsed: false,
        validationReasonCodes: firstAttempt.validationReasons
      };
    }

    if (isCatalogAvailabilityError(firstAttempt.errorReason)) {
      const fallbackReasons = firstAttempt.validationReasons.length
        ? firstAttempt.validationReasons
        : [firstAttempt.errorReason];
      const fallback = await this.createFallbackFoodPlan(input, fallbackReasons);
      this.logResult(input, fallback, 0, fallbackReasons);
      return {
        foodPlan: fallback,
        retryCount: 0,
        fallbackUsed: true,
        validationReasonCodes: fallbackReasons
      };
    }

    this.logger.warn(
      `nutrition agent validation failed; retrying=true; reasons=${firstAttempt.validationReasons.join(',') || firstAttempt.errorReason}; affectedMealCount=${firstAttempt.repairFeedback?.affectedMealIds.length ?? 0}; hasCalculatedDelta=${Boolean(firstAttempt.repairFeedback?.deltaFromTarget)}`
    );
    const retryAttempt = await this.requestOpenAiFoodPlan(input, firstAttempt.repairFeedback);

    if (retryAttempt.ok) {
      this.logResult(input, retryAttempt.foodPlan, 1, retryAttempt.validationReasons);
      return {
        foodPlan: retryAttempt.foodPlan,
        retryCount: 1,
        fallbackUsed: false,
        validationReasonCodes: retryAttempt.validationReasons
      };
    }

    const fallbackReasons = retryAttempt.validationReasons.length
      ? retryAttempt.validationReasons
      : [retryAttempt.errorReason];
    const fallback = await this.createFallbackFoodPlan(input, fallbackReasons);
    this.logResult(input, fallback, 1, fallbackReasons);

    return {
      foodPlan: fallback,
      retryCount: 1,
      fallbackUsed: true,
      validationReasonCodes: fallbackReasons
    };
  }

  private async generateMockFoodPlan(input: NutritionAgentInput): Promise<NutritionAgentResult> {
    const selectionSeed = input.regeneration?.mode === 'FULL_MENU_REGENERATION'
      ? this.fullMenuRegenerationSelectionSeed(input)
      : undefined;
    const catalogSelection = await this.selectCatalogForComposition(input, selectionSeed);
    const composedPlan = await this.recipeComposer.compose(input, { selectionSeed });
    if (composedPlan) {
      const { foodPlan, validation } = this.resolveComposedPlan(
        composedPlan,
        input,
        catalogSelection.candidates
      );
      if (validation.passed) {
        this.logger.log(
          `nutrition agent mock deterministic composition passed; mode=${input.regeneration?.mode ?? 'INITIAL'}`
        );
        this.logResult(input, foodPlan, 0, []);
        return {
          foodPlan,
          retryCount: 0,
          fallbackUsed: false,
          validationReasonCodes: []
        };
      }
      this.logger.warn(
        `nutrition agent mock deterministic composition did not meet target; using legacy mock plan; reasons=${validation.reasons.join(',')}`
      );
    }

    const foodPlan = createDeterministicFoodPlan(input, 'NUTRITION_AGENT');
    const validation = this.validator.validate(foodPlan, this.validationContext(input));

    if (validation.passed) {
      this.logResult(input, foodPlan, 0, []);
      return {
        foodPlan,
        retryCount: 0,
        fallbackUsed: false,
        validationReasonCodes: []
      };
    }

    const fallback = createDeterministicFoodPlan(input, 'DETERMINISTIC_FALLBACK', validation.reasons);
    this.logResult(input, fallback, 0, validation.reasons);
    return {
      foodPlan: fallback,
      retryCount: 0,
      fallbackUsed: true,
      validationReasonCodes: validation.reasons
    };
  }

  private async requestOpenAiFoodPlan(
    input: NutritionAgentInput,
    previousRepairFeedback?: FoodPlanRepairFeedback
  ): Promise<NutritionAgentAttemptResult> {
    const previousValidationReasons = previousRepairFeedback?.reasonCodes ?? [];
    const selection = this.modelRouter.resolve({
      agent: AiRequestAgent.NUTRITION,
      planQualityMode: input.planQualityMode
    });
    const model = selection.model;
    const selectionSeed = input.regeneration?.mode === 'FULL_MENU_REGENERATION'
      ? this.fullMenuRegenerationSelectionSeed(input)
      : undefined;
    const catalogSelection = await this.selectCatalogForComposition(input, selectionSeed);

    const catalogFeasibility = this.catalogFeasibility.assess({
      catalogSelection,
      target: this.portionSolverTarget(input)
    });
    this.logger.log(
      `nutrition agent catalog feasibility; status=${catalogFeasibility.status}; safeCandidateCount=${catalogFeasibility.safeCandidateCount}; reasonCodes=${catalogFeasibility.reasonCodes.join(',') || 'none'}`
    );

    if (catalogFeasibility.status === 'UNAVAILABLE') {
      return {
        ok: false,
        validationReasons: catalogFeasibility.reasonCodes,
        errorReason: 'CATALOG_TARGET_UNAVAILABLE'
      };
    }

    const recipeTemplates = this.recipeTemplates.listAvailableForSelection({
      dietType: input.nutritionPreference?.dietType,
      mealsPerDay: input.nutritionPreference?.mealsPerDay,
      catalogSelection
    });
    this.logger.log(`nutrition agent recipe templates available=${recipeTemplates.length}`);
    if (!recipeTemplates.length) {
      return {
        ok: false,
        validationReasons: ['CATALOG_RECIPE_TEMPLATES_UNAVAILABLE'],
        errorReason: 'CATALOG_RECIPE_TEMPLATES_UNAVAILABLE'
      };
    }

    // In OpenAI mode, AI proposes the complete catalog-bounded menu. The backend still
    // resolves catalog nutrition, solves portions, validates it, and owns fallback.
    this.logger.log(
      `nutrition agent planning path=AI_PROPOSAL_FIRST; mode=${input.regeneration?.mode ?? 'INITIAL'}`
    );

    try {
      this.logger.log(
        `nutrition agent OpenAI request started; retry=${previousValidationReasons.length > 0}; model=${model}`
      );
      const response = await this.requestTelemetry.execute({
        userId: input.userId,
        operation: this.getRequestOperation(input),
        selection,
        retryAttempt: previousValidationReasons.length > 0,
        request: () =>
          this.getClient().responses.create(
            {
              model,
              max_output_tokens: this.getMaxOutputTokens(),
              input: [
                {
                  role: 'system',
                  content: this.buildSystemInstructions(
                    previousRepairFeedback,
                    input.safetyFeedback
                  )
                },
                {
                  role: 'user',
                  content: JSON.stringify(
                    this.buildPlanningContext(
                      input,
                      previousRepairFeedback,
                      catalogSelection,
                      catalogFeasibility,
                      recipeTemplates
                    )
                  )
                }
              ],
              text: {
                format: {
                  type: 'json_schema',
                  name: 'daily_food_plan_content',
                  strict: true,
                  schema: nutritionAgentFoodPlanOpenAiSchema
                }
              }
            },
            { timeout: this.getRequestTimeoutMs() }
          )
      });

      this.logger.log('nutrition agent OpenAI response received');
      return this.parseAndValidateResponse(
        response,
        input,
        catalogSelection.candidates,
        recipeTemplates
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'nutrition_agent_openai_error';
      this.logger.warn(`nutrition agent OpenAI request failed; reason=${message.slice(0, 120)}`);

      return {
        ok: false,
        validationReasons: [],
        errorReason: 'NUTRITION_AGENT_OPENAI_FAILED'
      };
    }
  }

  private async createFallbackFoodPlan(input: NutritionAgentInput, reasons: string[]) {
    return (await this.catalogFallbackFoodPlan.create(input, reasons))
      ?? createDeterministicFoodPlan(input, 'DETERMINISTIC_FALLBACK', reasons);
  }

  private fullMenuRegenerationSelectionSeed(input: NutritionAgentInput) {
    const currentPlan = input.regeneration?.existingFoodPlan;
    if (!currentPlan || input.regeneration?.mode !== 'FULL_MENU_REGENERATION') return undefined;

    // Saved menu content is a stable basis for choosing the next safe variant.
    const fingerprint = currentPlan.meals
      .map((meal) => `${meal.id}:${meal.ingredients.map((ingredient) => ingredient.catalogFoodSlug).join(',')}`)
      .join('|');
    return `menu-refresh-${stableHash(fingerprint).toString(36)}`;
  }

  private async composeSingleMealRegeneration(
    input: NutritionAgentInput
  ): Promise<DailyFoodPlan | null> {
    const currentPlan = input.regeneration?.existingFoodPlan;
    const selectedMealId = input.regeneration?.selectedMealId;
    if (!currentPlan || !selectedMealId) return null;

    const currentMeal = currentPlan.meals.find((meal) => meal.id === selectedMealId);
    if (!currentMeal) return null;

    const selectionSeed = this.mealRegenerationSelectionSeed(currentMeal);
    let catalogSelection = await this.selectCatalogForComposition(input, selectionSeed);
    let composedCandidate = await this.recipeComposer.compose(input, { selectionSeed });
    let replacement = composedCandidate?.meals.find((meal) => (
      meal.id === selectedMealId || meal.mealType === currentMeal.mealType
    ));

    // An AI-proposed plan can legitimately use the same core ingredients in
    // multiple meals. Try one stable alternate catalog ranking before declining
    // a focused replacement that would otherwise be identical.
    if (!replacement || sameMealIngredients(currentMeal, replacement)) {
      const alternateSeed = `${selectionSeed}:alternate`;
      catalogSelection = await this.selectCatalogForComposition(input, alternateSeed);
      composedCandidate = await this.recipeComposer.compose(input, { selectionSeed: alternateSeed });
      replacement = composedCandidate?.meals.find((meal) => (
        meal.id === selectedMealId || meal.mealType === currentMeal.mealType
      ));
    }
    if (!composedCandidate || !replacement || sameMealIngredients(currentMeal, replacement)) {
      this.logger.warn(
        [
          'nutrition agent deterministic meal composition unavailable',
          `mealId=${selectedMealId}`,
          `composed=${Boolean(composedCandidate)}`,
          `replacement=${Boolean(replacement)}`,
          `sameIngredients=${Boolean(replacement && sameMealIngredients(currentMeal, replacement))}`
        ].join('; ')
      );
      return null;
    }

    const replacementWithStableIdentity = {
      ...replacement,
      id: selectedMealId,
      mealType: currentMeal.mealType
    };
    const targetedReplacementPlan = this.portionSolver.solve({
      foodPlan: {
        ...composedCandidate,
        meals: [replacementWithStableIdentity],
        totals: sumFoodNutrition([replacementWithStableIdentity])
      },
      target: {
        caloriesKcal: currentMeal.caloriesKcal,
        proteinGrams: currentMeal.proteinGrams,
        carbsGrams: currentMeal.carbsGrams,
        fatGrams: currentMeal.fatGrams
      },
      catalogCandidates: catalogSelection.candidates,
      allowedMealIds: [selectedMealId]
    });
    const targetedReplacement =
      targetedReplacementPlan.foodPlan.meals[0] ?? replacementWithStableIdentity;
    const mergedPlan: DailyFoodPlan = {
      ...currentPlan,
      source: 'NUTRITION_AGENT',
      localDate: input.planLocalDate,
      locale: input.locale,
      nutritionTargetSnapshot: input.nutritionTargetSnapshot,
      validation: {
        ...composedCandidate.validation,
        status: 'VALID',
        reasons: []
      },
      meals: currentPlan.meals.map((meal) => (
        meal.id === selectedMealId
          ? targetedReplacement
          : meal
      )),
      totals: sumFoodNutrition(currentPlan.meals.map((meal) => (
        meal.id === selectedMealId ? targetedReplacement : meal
      )))
    };

    const solved = this.portionSolver.solve({
      foodPlan: mergedPlan,
      target: this.portionSolverTarget(input),
      catalogCandidates: catalogSelection.candidates,
      allowedMealIds: [selectedMealId]
    });
    let foodPlan = normalizeFoodPlanNutrition(solved.foodPlan);
    let validation = this.validator.validate(foodPlan, this.validationContext(input));
    if (!validation.passed && canAttemptCatalogRebalance(validation.reasons)) {
      const rebalanced = this.catalogRebalancer.rebalance({
        foodPlan,
        target: this.portionSolverTarget(input),
        catalogCandidates: catalogSelection.candidates,
        allowedMealIds: [selectedMealId]
      });
      const rebalancedFoodPlan = normalizeFoodPlanNutrition(rebalanced.foodPlan);
      const rebalancedValidation = this.validator.validate(
        rebalancedFoodPlan,
        this.validationContext(input)
      );
      if (rebalanced.rebalanced && rebalancedValidation.passed) {
        foodPlan = rebalancedFoodPlan;
        validation = rebalancedValidation;
        this.logger.log(
          `nutrition agent deterministic meal rebalanced; mealId=${selectedMealId}; beforeScore=${rebalanced.beforeScore.toFixed(3)}; afterScore=${rebalanced.afterScore.toFixed(3)}`
        );
      }
    }
    if (!validation.passed) {
      this.logger.warn(
        [
          'nutrition agent deterministic meal composition invalid',
          `mealId=${selectedMealId}`,
          `reasons=${validation.reasons.join(',')}`,
          `totalKcalDelta=${validation.totalKcalDelta}`,
          `portionAdjusted=${solved.adjusted}`
        ].join('; ')
      );
      return null;
    }

    this.logger.log(
      `nutrition agent deterministic meal composition passed; mealId=${selectedMealId}; portionAdjusted=${solved.adjusted}`
    );
    return {
      ...foodPlan,
      validation: {
        ...foodPlan.validation,
        status: 'VALID',
        reasons: []
      }
    };
  }

  private mealRegenerationSelectionSeed(meal: DailyFoodPlan['meals'][number]) {
    const fingerprint = `${meal.id}:${meal.ingredients
      .map((ingredient) => ingredient.catalogFoodSlug ?? ingredient.name)
      .join(',')}`;
    return `meal-refresh-${stableHash(fingerprint).toString(36)}`;
  }

  private async selectCatalogForComposition(input: NutritionAgentInput, selectionSeed?: string) {
    return this.foodCatalogSelection.selectForDailyPlan({
      locale: input.locale,
      dietType: input.nutritionPreference?.dietType,
      planLocalDate: selectionSeed
        ? `${input.planLocalDate}:${selectionSeed}`
        : input.planLocalDate,
      availableFoodSlugs: input.availableFoodSlugs,
      preferredFoods: input.nutritionPreference?.preferredFoods,
      recentFoodUsage: input.foodRotationContext?.usage,
      prioritizePreparationForRoles: foodPracticalityRoles(input),
      maxPerRole: 8,
      restrictions: {
        allergies: input.nutritionPreference?.allergies,
        excludedFoods: input.nutritionPreference?.excludedFoods,
        dislikedFoods: input.nutritionPreference?.dislikedFoods
      }
    });
  }

  private resolveComposedPlan(
    composedPlan: DailyFoodPlan,
    input: NutritionAgentInput,
    catalogCandidates: FoodCatalogCandidate[]
  ) {
    let foodPlan = normalizeFoodPlanNutrition(composedPlan);
    let validation = this.validator.validate(foodPlan, this.validationContext(input));

    if (!validation.passed && canAttemptCatalogRebalance(validation.reasons)) {
      const repaired = this.targetedMealRepair.repair({
        foodPlan,
        target: this.portionSolverTarget(input),
        catalogCandidates
      });
      if (repaired.repaired) {
        const repairedFoodPlan = normalizeFoodPlanNutrition(repaired.foodPlan);
        const repairedValidation = this.validator.validate(repairedFoodPlan, this.validationContext(input));
        if (repairedValidation.passed) {
          foodPlan = repairedFoodPlan;
          validation = repairedValidation;
          this.logger.log(
            `nutrition agent targeted meal repair applied; mealId=${repaired.mealId}; beforeScore=${repaired.beforeScore.toFixed(3)}; afterScore=${repaired.afterScore.toFixed(3)}`
          );
        }
      }
    }

    if (!validation.passed && canAttemptCatalogRebalance(validation.reasons)) {
      const rebalanced = this.catalogRebalancer.rebalance({
        foodPlan,
        target: this.portionSolverTarget(input),
        catalogCandidates
      });
      if (rebalanced.rebalanced) {
        const rebalancedFoodPlan = normalizeFoodPlanNutrition(rebalanced.foodPlan);
        const rebalancedValidation = this.validator.validate(
          rebalancedFoodPlan,
          this.validationContext(input)
        );
        if (rebalancedValidation.passed) {
          foodPlan = rebalancedFoodPlan;
          validation = rebalancedValidation;
          this.logger.log(
            `nutrition agent deterministic menu rebalanced; beforeScore=${rebalanced.beforeScore.toFixed(3)}; afterScore=${rebalanced.afterScore.toFixed(3)}`
          );
        }
      }
    }

    return { foodPlan, validation };
  }

  private async requestOpenAiMealCopy(
    input: NutritionAgentInput,
    composedPlan: DailyFoodPlan
  ): Promise<NutritionAgentAttemptResult> {
    const selection = this.modelRouter.resolve({
      agent: AiRequestAgent.NUTRITION,
      planQualityMode: input.planQualityMode
    });
    const model = selection.model;

    try {
      this.logger.log(`nutrition agent OpenAI meal-copy request started; model=${model}`);
      const response = await this.requestTelemetry.execute({
        userId: input.userId,
        operation: this.getRequestOperation(input),
        selection,
        retryAttempt: false,
        request: () =>
          this.getClient().responses.create(
            {
              model,
              max_output_tokens: this.getMaxOutputTokens(),
              input: [
                {
                  role: 'system',
                  content: this.buildMealCopySystemInstructions()
                },
                {
                  role: 'user',
                  content: JSON.stringify(
                    this.buildMealCopyPlanningContext(
                      input,
                      composedPlan
                    )
                  )
                }
              ],
              text: {
                format: {
                  type: 'json_schema',
                  name: 'daily_food_plan_copy',
                  strict: true,
                  schema: nutritionAgentMealCopyOpenAiSchema
                }
              }
            },
            { timeout: this.getRequestTimeoutMs() }
          )
      });

      const foodPlan = this.applyMealCopy(response, input, composedPlan);
      if (foodPlan) {
        this.logger.log('nutrition agent OpenAI meal copy applied');
        return { ok: true, foodPlan, validationReasons: [] };
      }
      this.logger.warn('nutrition agent meal copy was invalid or unsafe; using deterministic recipe plan');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'nutrition_agent_meal_copy_failed';
      this.logger.warn(`nutrition agent meal-copy request failed; reason=${message.slice(0, 120)}; using deterministic recipe plan`);
    }

    return {
      ok: true,
      foodPlan: composedPlan,
      validationReasons: ['AI_MEAL_COPY_UNAVAILABLE']
    };
  }

  private async requestOpenAiSingleMealCopy(
    input: NutritionAgentInput,
    foodPlan: DailyFoodPlan,
    selectedMealId: string
  ): Promise<DailyFoodPlan> {
    const selectedMeal = foodPlan.meals.find((meal) => meal.id === selectedMealId);
    if (!selectedMeal) return foodPlan;
    const selection = this.modelRouter.resolve({
      agent: AiRequestAgent.NUTRITION,
      planQualityMode: input.planQualityMode
    });
    const model = selection.model;

    try {
      this.logger.log(`nutrition agent OpenAI single-meal copy request started; mealId=${selectedMealId}; model=${model}`);
      const response = await this.requestTelemetry.execute({
        userId: input.userId,
        operation: AiRequestOperation.MEAL_REGENERATION,
        selection,
        retryAttempt: false,
        request: () =>
          this.getClient().responses.create(
            {
              model,
              max_output_tokens: this.getMaxOutputTokens(),
              input: [
                {
                  role: 'system',
                  content: this.buildMealCopySystemInstructions()
                },
                {
                  role: 'user',
                  content: JSON.stringify(
                    this.buildMealCopyPlanningContext(input, {
                      ...foodPlan,
                      meals: [selectedMeal],
                      totals: mealTotals(selectedMeal)
                    })
                  )
                }
              ],
              text: {
                format: {
                  type: 'json_schema',
                  name: 'daily_food_plan_copy',
                  strict: true,
                  schema: nutritionAgentMealCopyOpenAiSchema
                }
              }
            },
            { timeout: this.getRequestTimeoutMs() }
          )
      });

      const copiedMealPlan = this.applyMealCopy(
        response,
        input,
        {
          ...foodPlan,
          meals: [selectedMeal],
          totals: mealTotals(selectedMeal)
        },
        false
      );
      const copiedMeal = copiedMealPlan?.meals[0];
      if (!copiedMeal) return foodPlan;

      const mergedPlan = {
        ...foodPlan,
        meals: foodPlan.meals.map((meal) => meal.id === selectedMealId ? copiedMeal : meal)
      };
      if (!this.validator.validate(mergedPlan, this.validationContext(input)).passed) {
        return foodPlan;
      }

      this.logger.log(`nutrition agent OpenAI single-meal copy applied; mealId=${selectedMealId}`);
      return mergedPlan;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'nutrition_agent_single_meal_copy_failed';
      this.logger.warn(
        `nutrition agent single-meal copy request failed; reason=${message.slice(0, 120)}; using deterministic meal`
      );
      return foodPlan;
    }
  }

  private applyMealCopy(
    response: OpenAiResponse,
    input: NutritionAgentInput,
    composedPlan: DailyFoodPlan,
    validateTarget = true
  ): DailyFoodPlan | null {
    const outputText = this.extractOutputText(response);
    if (!outputText) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return null;
    }

    const schemaResult = nutritionAgentMealCopyDraftSchema.safeParse(parsed);
    if (!schemaResult.success) return null;

    const copiedPlan = mergeMealCopy(composedPlan, schemaResult.data);
    if (!copiedPlan) return null;
    return !validateTarget || this.validator.validate(copiedPlan, this.validationContext(input)).passed
      ? copiedPlan
      : null;
  }

  private parseAndValidateResponse(
    response: OpenAiResponse,
    input: NutritionAgentInput,
    catalogCandidates: FoodCatalogCandidate[],
    recipeTemplates: FoodPlanRecipeTemplate[]
  ): NutritionAgentAttemptResult {
    const outputText = this.extractOutputText(response);

    if (!outputText) {
      return {
        ok: false,
        validationReasons: [],
        errorReason: 'NUTRITION_AGENT_MISSING_OUTPUT'
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return {
        ok: false,
        validationReasons: ['JSON_PARSE_FAILED'],
        errorReason: 'JSON_PARSE_FAILED'
      };
    }

    const schemaResult = nutritionAgentFoodPlanDraftSchema.safeParse(parsed);

    if (!schemaResult.success) {
      return {
        ok: false,
        validationReasons: ['SCHEMA_INVALID'],
        errorReason: 'SCHEMA_INVALID'
      };
    }

    const normalizedCatalogPlan = this.normalizeCatalogFoodPlan(
      schemaResult.data,
      input,
      catalogCandidates,
      recipeTemplates
    );
    if (!normalizedCatalogPlan) {
      return {
        ok: false,
        validationReasons: ['UNKNOWN_OR_INVALID_CATALOG_FOOD_OR_TEMPLATE'],
        errorReason: 'UNKNOWN_OR_INVALID_CATALOG_FOOD_OR_TEMPLATE'
      };
    }

    const portionSolveResult = input.nutritionTarget.safety.status === 'NEEDS_MORE_INFO'
      ? { foodPlan: normalizedCatalogPlan, adjusted: false, beforeScore: 0, afterScore: 0 }
      : this.portionSolver.solve({
          foodPlan: normalizedCatalogPlan,
          target: this.portionSolverTarget(input),
          catalogCandidates
        });
    if (portionSolveResult.adjusted) {
      this.logger.log(
        `nutrition agent portion solver adjusted quantities; beforeScore=${portionSolveResult.beforeScore.toFixed(3)}; afterScore=${portionSolveResult.afterScore.toFixed(3)}`
      );
    }

    let resolvedFoodPlan = normalizeFoodPlanNutrition(portionSolveResult.foodPlan);
    let validation = this.validator.validate(resolvedFoodPlan, this.validationContext(input));

    if (!validation.passed && canAttemptCatalogRebalance(validation.reasons)) {
      const repaired = this.targetedMealRepair.repair({
        foodPlan: resolvedFoodPlan,
        target: this.portionSolverTarget(input),
        catalogCandidates
      });
      if (repaired.repaired) {
        const repairedFoodPlan = normalizeFoodPlanNutrition(repaired.foodPlan);
        const repairedValidation = this.validator.validate(repairedFoodPlan, this.validationContext(input));
        if (repairedValidation.passed) {
          resolvedFoodPlan = repairedFoodPlan;
          validation = repairedValidation;
          this.logger.log(
            `nutrition agent targeted meal repair applied; mealId=${repaired.mealId}; beforeScore=${repaired.beforeScore.toFixed(3)}; afterScore=${repaired.afterScore.toFixed(3)}`
          );
        }
      }
    }

    if (!validation.passed && canAttemptCatalogRebalance(validation.reasons)) {
      const rebalanced = this.catalogRebalancer.rebalance({
        foodPlan: resolvedFoodPlan,
        target: this.portionSolverTarget(input),
        catalogCandidates
      });
      if (rebalanced.rebalanced) {
        const rebalancedFoodPlan = normalizeFoodPlanNutrition(rebalanced.foodPlan);
        const rebalancedValidation = this.validator.validate(rebalancedFoodPlan, this.validationContext(input));
        if (rebalancedValidation.passed) {
          resolvedFoodPlan = rebalancedFoodPlan;
          validation = rebalancedValidation;
          this.logger.log(
            `nutrition agent catalog rebalancer applied one safe substitution; beforeScore=${rebalanced.beforeScore.toFixed(3)}; afterScore=${rebalanced.afterScore.toFixed(3)}`
          );
        }
      }
    }

    if (!validation.passed) {
      return {
        ok: false,
        validationReasons: validation.reasons,
        errorReason: 'VALIDATION_FAILED',
        repairFeedback: validation.repairFeedback
      };
    }

    return {
      ok: true,
      foodPlan: {
        ...resolvedFoodPlan,
        validation: {
          ...resolvedFoodPlan.validation,
          status: 'VALID',
          reasons: []
        }
      },
      validationReasons: []
    };
  }

  private buildSystemInstructions(
    previousRepairFeedback?: FoodPlanRepairFeedback,
    safetyFeedback?: NutritionAgentInput['safetyFeedback']
  ) {
    return [
      'You are the OptiMe Specialized Nutrition Agent.',
      'Return only structured JSON matching the provided daily food plan content schema.',
      'The deterministic Nutrition Engine is the source of numeric truth.',
      'The calorie and macro targets are fixed backend constraints. Do not change them. Create meals that fit them.',
      'Do not calculate a new daily target. Use the target calories, protein, carbs, and fat from the context.',
      'Use only catalogFoodSlug values supplied in allowedCatalogFoods. Never invent an ingredient or a slug.',
      'Every meal must use exactly one recipeTemplateId from recipeTemplates. Keep its meal type and ingredient role structure.',
      'Use selectionRoles as meal-building guidance: choose proteins, carbohydrate bases, vegetables, fruit, and fats that fit each meal.',
      'Every ingredient quantity must be in grams. Return only catalogFoodSlug, quantity, unit, and isOptional for ingredients.',
      'Do not return ingredient names, calories, protein, carbs, fat, meal totals, or daily totals. Backend owns and calculates all of those values.',
      'Respect the requested mealsPerDay exactly when provided.',
      'Never include allergies, intolerances, or excluded foods in ingredients, meal titles, substitutions, or preparation steps.',
      'Treat disliked foods as strong avoid preferences unless there is no safe practical alternative.',
      'Preferred foods are ranking hints, not daily requirements. Use them when they fit safely without making the menu repetitive.',
      'Respect recentFoodUsage: avoid recently repeated main proteins and meal bases when another safe catalog option fits the fixed target.',
      'Keep meal titles localized to the requested locale when possible.',
      'Use supportive, practical, non-shaming language.',
      'Do not include fasting protocols, detox claims, starvation messaging, medical diagnosis, or aggressive weight-loss promises.',
      'For minors, safeMode, pregnancy, postpartum, or breastfeeding context, keep meals balanced and conservative.',
      'For FULL_MENU_REGENERATION, replace the complete menu while preserving the fixed nutrition target.',
      'For MEAL_REGENERATION, regenerate the selected meal and return the complete adjusted food plan. Keep other meals stable unless small macro balancing changes are required.',
      previousRepairFeedback
        ? [
            'This is a correction attempt. Return a complete corrected food plan, not partial edits.',
            `Validator reason codes: ${previousRepairFeedback.reasonCodes.join(', ')}.`,
            ...previousRepairFeedback.instructions
          ].join(' ')
        : 'Create one complete daily food plan.',
      safetyFeedback
        ? [
            'This is a targeted safety correction. Regenerate the complete food plan while correcting only the identified nutrition safety issues.',
            `Safety risk level: ${safetyFeedback.riskLevel}.`,
            `Safety reasons: ${safetyFeedback.reasons.join(' | ')}.`,
            `Required changes: ${safetyFeedback.requiredChanges.join(' | ')}.`
          ].join(' ')
        : ''
    ].join('\n');
  }

  private buildMealCopySystemInstructions() {
    return [
      'You are the OptiMe Specialized Nutrition Agent.',
      'Return only structured JSON matching the provided daily food plan copy schema.',
      'The meals, ingredients, portions, calories, and macros are already fixed by the backend. Do not change or repeat them.',
      'Return exactly one copy object for every supplied composed meal ID. Keep every ID unchanged.',
      'Use only ingredient names supplied for that meal. Do not introduce any other food in titles, summaries, or preparation steps.',
      'Never mention allergies, excluded foods, or disliked foods unless the supplied meal ingredients already contain them.',
      'Keep copy localized to the requested locale, practical, supportive, concise, and non-shaming.',
      'Do not include medical advice, detox claims, fasting protocols, starvation messaging, or aggressive weight-loss language.',
      'For minors, safeMode, pregnancy, postpartum, or breastfeeding context, use balanced and conservative wording.'
    ].join('\n');
  }

  private buildMealCopyPlanningContext(input: NutritionAgentInput, composedPlan: DailyFoodPlan) {
    return {
      locale: input.locale,
      safetyContext: {
        safeMode: input.safeMode,
        isMinor: input.isMinor,
        pregnancyStatus: input.pregnancyStatus ?? 'UNKNOWN'
      },
      composedMeals: composedPlan.meals.map((meal) => ({
        id: meal.id,
        mealType: meal.mealType,
        ingredientNames: meal.ingredients.map((ingredient) => ingredient.name)
      }))
    };
  }

  private buildPlanningContext(
    input: NutritionAgentInput,
    previousRepairFeedback: FoodPlanRepairFeedback | undefined,
    catalogSelection: DailyFoodCatalogSelection,
    catalogFeasibility: FoodPlanCatalogFeasibilityResult,
    recipeTemplates: FoodPlanRecipeTemplate[]
  ) {
    return {
      localDate: input.planLocalDate,
      locale: input.locale,
      planQualityMode: input.planQualityMode,
      appMode: input.appMode,
      dayType: input.nutritionTarget.dayType,
      fixedNutritionTarget: {
        targetKcal: input.nutritionTarget.calories.targetKcal,
        minKcal: input.nutritionTarget.calories.minKcal,
        maxKcal: input.nutritionTarget.calories.maxKcal,
        proteinGrams: input.nutritionTarget.macros.proteinGrams,
        carbsGrams: input.nutritionTarget.macros.carbsGrams,
        fatGrams: input.nutritionTarget.macros.fatGrams,
        safetyStatus: input.nutritionTarget.safety.status,
        safetyReasons: input.nutritionTarget.safety.reasons
      },
      requestedMealsPerDay: input.nutritionPreference?.mealsPerDay ?? 3,
      nutritionPreferences: input.nutritionPreference
        ? {
            dietType: input.nutritionPreference.dietType,
            notes: input.nutritionPreference.notes,
            preferredFoods: input.nutritionPreference.preferredFoods,
            allergies: input.nutritionPreference.allergies,
            excludedFoods: input.nutritionPreference.excludedFoods,
            dislikedFoods: input.nutritionPreference.dislikedFoods
          }
        : null,
      goalSummary: input.goalSummary,
      recentFoodUsage: {
        lookbackDays:
          input.foodRotationContext?.lookbackDays ?? 0,
        foods:
          input.foodRotationContext?.usage.map((usage) => ({
            catalogFoodSlug: usage.catalogFoodSlug,
            daysUsed: usage.daysUsed,
            daysSinceLastUse: usage.daysSinceLastUse
          })) ?? []
      },
      trainingContext: {
        isTrainingDay: input.resolvedTrainingDay.isTrainingDay,
        durationMinutes: input.resolvedTrainingDay.durationMinutes,
        targetMuscles: input.resolvedTrainingDay.targetMuscles,
        environment: input.resolvedTrainingDay.environment
      },
      safetyContext: {
        safeMode: input.safeMode,
        isMinor: input.isMinor,
        pregnancyStatus: input.pregnancyStatus ?? 'UNKNOWN'
      },
      catalogFeasibility: {
        status: catalogFeasibility.status,
        reasonCodes: catalogFeasibility.reasonCodes
      },
      recipeTemplates: this.recipeTemplates.toPlanningGuidance(recipeTemplates),
      allowedCatalogFoods: catalogSelection.candidates.map((candidate) => ({
        slug: candidate.slug,
        name: candidate.name,
        category: candidate.category,
        selectionRoles: FOOD_CATALOG_SELECTION_ROLES.filter((role) => (
          catalogSelection.byRole[role].some((roleCandidate) => roleCandidate.slug === candidate.slug)
        )),
        caloriesPer100g: candidate.caloriesPer100g,
        proteinPer100g: candidate.proteinPer100g,
        carbsPer100g: candidate.carbsPer100g,
        fatPer100g: candidate.fatPer100g
      })),
      regeneration: input.regeneration
        ? {
            mode: input.regeneration.mode,
            reason: input.regeneration.reason ?? null,
            selectedMealId: input.regeneration.selectedMealId ?? null,
            existingFoodPlan: input.regeneration.existingFoodPlan
          }
        : null,
      safetyCorrectionFeedback: input.safetyFeedback
        ? {
            riskLevel: input.safetyFeedback.riskLevel,
            reasons: input.safetyFeedback.reasons,
            requiredChanges: input.safetyFeedback.requiredChanges
          }
        : null,
      repairFeedback: previousRepairFeedback ?? null
    };
  }

  private normalizeCatalogFoodPlan(
    plan: NutritionAgentFoodPlanDraft,
    input: NutritionAgentInput,
    catalogCandidates: FoodCatalogCandidate[],
    recipeTemplates: FoodPlanRecipeTemplate[]
  ): DailyFoodPlan | null {
    const bySlug = new Map(catalogCandidates.map((candidate) => [candidate.slug, candidate]));
    const templatesById = new Map(recipeTemplates.map((template) => [template.id, template]));
    const meals: DailyFoodPlan['meals'] = [];

    for (const meal of plan.meals) {
      const template = templatesById.get(meal.recipeTemplateId);
      if (!template || template.mealType !== meal.mealType) return null;
      const ingredients: DailyFoodPlan['meals'][number]['ingredients'] = [];
      for (const [ingredientIndex, ingredient] of meal.ingredients.entries()) {
        if (!ingredient.catalogFoodSlug || ingredient.unit !== 'g') return null;
        const candidate = bySlug.get(ingredient.catalogFoodSlug);
        if (!candidate) return null;
        const templateIngredient =
          template.ingredients[ingredientIndex];
        if (!templateIngredient) return null;
        const nutrition = this.foodCatalog.calculateNutrition(candidate, ingredient.quantity);
        ingredients.push({
          ...ingredient,
          name: candidate.name,
          caloriesKcal: nutrition.caloriesKcal,
          proteinGrams: nutrition.proteinGrams,
          carbsGrams: nutrition.carbsGrams,
          fatGrams: nutrition.fatGrams,
          ...createFoodIngredientClarity({
            candidate,
            selectionRole: templateIngredient.role,
            locale: input.locale
          })
        });
      }
      const totals = sumFoodNutrition(ingredients);
      const { recipeTemplateId: _recipeTemplateId, ...normalizedMeal } = meal;
      meals.push({ ...normalizedMeal, ...totals, ingredients });
    }
    const totals = sumFoodNutrition(meals);
    return normalizeFoodPlanNutrition({
      source: 'NUTRITION_AGENT',
      localDate: input.planLocalDate,
      locale: input.locale,
      nutritionTargetSnapshot: input.nutritionTargetSnapshot,
      totals,
      validation: {
        status: 'VALID',
        reasons: [],
        tolerances: {
          caloriesPercent: 5,
          proteinGrams: 10,
          carbsGrams: 15,
          fatGrams: 10
        }
      },
      meals
    });
  }

  private validationContext(input: NutritionAgentInput) {
    return {
      nutritionTarget: input.nutritionTarget,
      nutritionTargetSnapshot: input.nutritionTargetSnapshot,
      allergies: input.nutritionPreference?.allergies ?? [],
      excludedFoods: input.nutritionPreference?.excludedFoods ?? [],
      dislikedFoods: input.nutritionPreference?.dislikedFoods ?? [],
      safeMode: input.safeMode,
      isMinor: input.isMinor,
      pregnancyStatus: input.pregnancyStatus
    };
  }

  private portionSolverTarget(input: NutritionAgentInput) {
    return {
      caloriesKcal: input.nutritionTarget.calories.targetKcal,
      proteinGrams: input.nutritionTarget.macros.proteinGrams,
      carbsGrams: input.nutritionTarget.macros.carbsGrams,
      fatGrams: input.nutritionTarget.macros.fatGrams
    };
  }

  private logResult(
    input: NutritionAgentInput,
    foodPlan: DailyFoodPlan,
    retryCount: number,
    validationReasons: string[]
  ) {
    this.logger.log([
      `nutrition agent completed; source=${foodPlan.source}`,
      `validationStatus=${foodPlan.validation.status}`,
      `retryCount=${retryCount}`,
      `dayType=${input.nutritionTarget.dayType}`,
      `appMode=${input.appMode}`,
      `mealCount=${foodPlan.meals.length}`,
      `kcalDelta=${Math.abs(foodPlan.totals.caloriesKcal - input.nutritionTarget.calories.targetKcal)}`,
      `reasonCodes=${validationReasons.join(',') || 'none'}`
    ].join('; '));
  }

  private extractOutputText(response: OpenAiResponse) {
    if (typeof response.output_text === 'string') {
      return response.output_text;
    }

    return (
      response.output
        ?.flatMap((item) => item.content ?? [])
        .find((content) => content.type === 'output_text' && typeof content.text === 'string')
        ?.text ?? null
    );
  }

  private getProviderName() {
    return this.configService.get<string>('AI_PROVIDER') === 'openai' ? 'openai' : 'mock';
  }

  private getClient() {
    if (!this.client) {
      this.client = this.clientFactory(this.getApiKey());
    }

    return this.client;
  }

  private getApiKey() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai.');
    }
    return apiKey;
  }

  private getRequestOperation(input: NutritionAgentInput) {
    switch (input.regeneration?.mode) {
      case 'FULL_MENU_REGENERATION':
        return AiRequestOperation.MENU_REGENERATION;
      case 'MEAL_REGENERATION':
        return AiRequestOperation.MEAL_REGENERATION;
      default:
        return AiRequestOperation.NUTRITION_GENERATION;
    }
  }

  private getRequestTimeoutMs() {
    return this.getPositiveIntConfig('OPENAI_REQUEST_TIMEOUT_MS', 45_000);
  }

  private getMaxOutputTokens() {
    return this.getPositiveIntConfig('OPENAI_MAX_OUTPUT_TOKENS', 4_000);
  }

  private getPositiveIntConfig(key: string, fallback: number) {
    const value = Number(this.configService.get<string>(key));
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
  }
}

const CATALOG_REBALANCEABLE_VALIDATION_REASONS = new Set([
  'CALORIES_OUTSIDE_TARGET_TOLERANCE',
  'PROTEIN_OUTSIDE_TARGET_TOLERANCE',
  'CARBS_OUTSIDE_TARGET_TOLERANCE',
  'FAT_OUTSIDE_TARGET_TOLERANCE'
]);

function canAttemptCatalogRebalance(reasons: string[]) {
  return reasons.length > 0 && reasons.every((reason) => CATALOG_REBALANCEABLE_VALIDATION_REASONS.has(reason));
}

function isCatalogAvailabilityError(errorReason: string) {
  return errorReason === 'CATALOG_TARGET_UNAVAILABLE'
    || errorReason === 'CATALOG_RECIPE_TEMPLATES_UNAVAILABLE';
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sameMealIngredients(
  left: DailyFoodPlan['meals'][number],
  right: DailyFoodPlan['meals'][number]
) {
  const leftIngredients = left.ingredients.map((ingredient) => ingredient.catalogFoodSlug ?? ingredient.name);
  const rightIngredients = right.ingredients.map((ingredient) => ingredient.catalogFoodSlug ?? ingredient.name);
  return leftIngredients.length === rightIngredients.length
    && leftIngredients.every((ingredient, index) => ingredient === rightIngredients[index]);
}

function mealTotals(meal: DailyFoodPlan['meals'][number]) {
  return {
    caloriesKcal: meal.caloriesKcal,
    proteinGrams: meal.proteinGrams,
    carbsGrams: meal.carbsGrams,
    fatGrams: meal.fatGrams
  };
}

function mergeMealCopy(
  composedPlan: DailyFoodPlan,
  copy: NutritionAgentMealCopyDraft
): DailyFoodPlan | null {
  if (copy.meals.length !== composedPlan.meals.length) return null;
  const copyById = new Map(copy.meals.map((meal) => [meal.id, meal]));
  if (copyById.size !== composedPlan.meals.length) return null;

  const meals = composedPlan.meals.map((meal) => {
    const mealCopy = copyById.get(meal.id);
    if (!mealCopy) return null;
    return {
      ...meal,
      title: mealCopy.title,
      shortDescription: mealCopy.shortDescription,
      prepTimeMinutes: mealCopy.prepTimeMinutes,
      servingSummary: mealCopy.servingSummary,
      preparationSteps: mealCopy.preparationSteps
    };
  });
  if (meals.some((meal) => meal === null)) return null;

  return { ...composedPlan, meals: meals as DailyFoodPlan['meals'] };
}

function sumFoodNutrition(items: Array<Pick<DailyFoodPlan['totals'], 'caloriesKcal' | 'proteinGrams' | 'carbsGrams' | 'fatGrams'>>) {
  return items.reduce<DailyFoodPlan['totals']>(
    (totals, item) => ({
      caloriesKcal: totals.caloriesKcal + item.caloriesKcal,
      proteinGrams: totals.proteinGrams + item.proteinGrams,
      carbsGrams: totals.carbsGrams + item.carbsGrams,
      fatGrams: totals.fatGrams + item.fatGrams
    }),
    { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
  );
}
