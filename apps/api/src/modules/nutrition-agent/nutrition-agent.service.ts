import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DailyFoodPlan } from '@optime/shared-types';

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
import { createDeterministicFoodPlan } from './deterministic-food-plan.factory';
import { FoodPlanValidationService } from './food-plan-validation.service';
import {
  nutritionAgentFoodPlanDraftSchema,
  nutritionAgentFoodPlanOpenAiSchema,
  type NutritionAgentFoodPlanDraft
} from './nutrition-agent.openai-schema';
import type { NutritionAgentInput, NutritionAgentResult } from './nutrition-agent.types';

type NutritionAgentAttemptResult =
  | { ok: true; foodPlan: DailyFoodPlan; validationReasons: string[] }
  | { ok: false; validationReasons: string[]; errorReason: string };

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
    @Inject(OPENAI_CLIENT_FACTORY) private readonly clientFactory: OpenAiClientFactory
  ) {}

  async generateDailyFoodPlan(input: NutritionAgentInput): Promise<NutritionAgentResult> {
    if (this.getProviderName() !== 'openai') {
      return this.generateMockFoodPlan(input);
    }

    const firstAttempt = await this.requestOpenAiFoodPlan(input, []);

    if (firstAttempt.ok) {
      this.logResult(input, firstAttempt.foodPlan, 0, firstAttempt.validationReasons);
      return {
        foodPlan: firstAttempt.foodPlan,
        retryCount: 0,
        fallbackUsed: false,
        validationReasonCodes: firstAttempt.validationReasons
      };
    }

    this.logger.warn(
      `nutrition agent validation failed; retrying=true; reasons=${firstAttempt.validationReasons.join(',') || firstAttempt.errorReason}`
    );
    const retryAttempt = await this.requestOpenAiFoodPlan(input, firstAttempt.validationReasons);

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

  private generateMockFoodPlan(input: NutritionAgentInput): NutritionAgentResult {
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
    previousValidationReasons: string[]
  ): Promise<NutritionAgentAttemptResult> {
    const model = this.getModel();
    const catalogSelection = await this.foodCatalogSelection.selectForDailyPlan({
      locale: input.locale,
      dietType: input.nutritionPreference?.dietType,
      planLocalDate: input.planLocalDate,
      preferredFoods: input.nutritionPreference?.preferredFoods,
      restrictions: {
        allergies: input.nutritionPreference?.allergies,
        excludedFoods: input.nutritionPreference?.excludedFoods,
        dislikedFoods: input.nutritionPreference?.dislikedFoods
      }
    });

    if (catalogSelection.candidates.length < 3) {
      return {
        ok: false,
        validationReasons: ['CATALOG_SAFE_CANDIDATES_UNAVAILABLE'],
        errorReason: 'CATALOG_SAFE_CANDIDATES_UNAVAILABLE'
      };
    }

    try {
      this.logger.log(
        `nutrition agent OpenAI request started; retry=${previousValidationReasons.length > 0}; model=${model}`
      );
      const response = await this.getClient().responses.create(
        {
          model,
          max_output_tokens: this.getMaxOutputTokens(),
          input: [
            {
              role: 'system',
              content: this.buildSystemInstructions(previousValidationReasons)
            },
            {
              role: 'user',
              content: JSON.stringify(this.buildPlanningContext(input, previousValidationReasons, catalogSelection))
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
      );

      this.logger.log('nutrition agent OpenAI response received');
      return this.parseAndValidateResponse(response, input, catalogSelection.candidates);
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

  private parseAndValidateResponse(
    response: OpenAiResponse,
    input: NutritionAgentInput,
    catalogCandidates: FoodCatalogCandidate[]
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

    const normalizedCatalogPlan = this.normalizeCatalogFoodPlan(schemaResult.data, input, catalogCandidates);
    if (!normalizedCatalogPlan) {
      return {
        ok: false,
        validationReasons: ['UNKNOWN_OR_INVALID_CATALOG_FOOD'],
        errorReason: 'UNKNOWN_OR_INVALID_CATALOG_FOOD'
      };
    }

    const validation = this.validator.validate(normalizedCatalogPlan, this.validationContext(input));

    if (!validation.passed) {
      return {
        ok: false,
        validationReasons: validation.reasons,
        errorReason: 'VALIDATION_FAILED'
      };
    }

    return {
      ok: true,
      foodPlan: {
        ...normalizedCatalogPlan,
        validation: {
          ...normalizedCatalogPlan.validation,
          status: 'VALID',
          reasons: []
        }
      },
      validationReasons: []
    };
  }

  private buildSystemInstructions(previousValidationReasons: string[]) {
    return [
      'You are the OptiMe Specialized Nutrition Agent.',
      'Return only structured JSON matching the provided daily food plan content schema.',
      'The deterministic Nutrition Engine is the source of numeric truth.',
      'The calorie and macro targets are fixed backend constraints. Do not change them. Create meals that fit them.',
      'Do not calculate a new daily target. Use the target calories, protein, carbs, and fat from the context.',
      'Use only catalogFoodSlug values supplied in allowedCatalogFoods. Never invent an ingredient or a slug.',
      'Use selectionRoles as meal-building guidance: choose proteins, carbohydrate bases, vegetables, fruit, and fats that fit each meal.',
      'Every ingredient quantity must be in grams. Return only catalogFoodSlug, quantity, unit, and isOptional for ingredients.',
      'Do not return ingredient names, calories, protein, carbs, fat, meal totals, or daily totals. Backend owns and calculates all of those values.',
      'Respect the requested mealsPerDay exactly when provided.',
      'Never include allergies, intolerances, or excluded foods in ingredients, meal titles, substitutions, or preparation steps.',
      'Treat disliked foods as strong avoid preferences unless there is no safe practical alternative.',
      'Use preferred foods when they fit safely.',
      'Keep meal titles localized to the requested locale when possible.',
      'Use supportive, practical, non-shaming language.',
      'Do not include fasting protocols, detox claims, starvation messaging, medical diagnosis, or aggressive weight-loss promises.',
      'For minors, safeMode, pregnancy, postpartum, or breastfeeding context, keep meals balanced and conservative.',
      'For FULL_MENU_REGENERATION, replace the complete menu while preserving the fixed nutrition target.',
      'For MEAL_REGENERATION, regenerate the selected meal and return the complete adjusted food plan. Keep other meals stable unless small macro balancing changes are required.',
      previousValidationReasons.length
        ? `This is a retry. Fix these validation errors: ${previousValidationReasons.join(', ')}. Return a complete corrected food plan, not partial edits.`
        : 'Create one complete daily food plan.'
    ].join('\n');
  }

  private buildPlanningContext(
    input: NutritionAgentInput,
    previousValidationReasons: string[],
    catalogSelection: DailyFoodCatalogSelection
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
      previousValidationReasons
    };
  }

  private normalizeCatalogFoodPlan(
    plan: NutritionAgentFoodPlanDraft,
    input: NutritionAgentInput,
    catalogCandidates: FoodCatalogCandidate[]
  ): DailyFoodPlan | null {
    const bySlug = new Map(catalogCandidates.map((candidate) => [candidate.slug, candidate]));
    const meals: DailyFoodPlan['meals'] = [];

    for (const meal of plan.meals) {
      const ingredients: DailyFoodPlan['meals'][number]['ingredients'] = [];
      for (const ingredient of meal.ingredients) {
        if (!ingredient.catalogFoodSlug || ingredient.unit !== 'g') return null;
        const candidate = bySlug.get(ingredient.catalogFoodSlug);
        if (!candidate) return null;
        const nutrition = this.foodCatalog.calculateNutrition(candidate, ingredient.quantity);
        ingredients.push({
          ...ingredient,
          name: candidate.name,
          caloriesKcal: nutrition.caloriesKcal,
          proteinGrams: nutrition.proteinGrams,
          carbsGrams: nutrition.carbsGrams,
          fatGrams: nutrition.fatGrams
        });
      }
      const totals = sumFoodNutrition(ingredients);
      meals.push({ ...meal, ...totals, ingredients });
    }
    const totals = sumFoodNutrition(meals);
    return {
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
    };
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

  private getModel() {
    const model = this.configService.get<string>('OPENAI_DEFAULT_MODEL');
    if (!model) {
      throw new Error('OPENAI_DEFAULT_MODEL is required when AI_PROVIDER=openai.');
    }
    return model;
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
