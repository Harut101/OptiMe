import { Injectable } from '@nestjs/common';
import { Prisma, UsageFeature } from '@prisma/client';
import type {
  EvaluatePlanImpactResponse,
  PlanImpactChangeType,
  PlanImpactSection,
  PlanImpactSeverity,
  PlanRegenerationPrompt
} from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { EvaluatePlanImpactDto } from './dto/evaluate-plan-impact.dto';

type ChangeRule = {
  affectedSections: PlanImpactSection[];
  severity: PlanImpactSeverity;
  reasonCodes: string[];
  deterministicUpdateAvailable: boolean;
  aiRegenerationRecommended: boolean;
  promptTitle: NonNullable<PlanRegenerationPrompt>['titleCode'];
  promptMessage: NonNullable<PlanRegenerationPrompt>['messageCode'];
  primaryAction: NonNullable<PlanRegenerationPrompt>['primaryAction'];
};

const SEVERITY_ORDER: Record<PlanImpactSeverity, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  SAFETY_CRITICAL: 4
};

const CHANGE_RULES: Record<PlanImpactChangeType, ChangeRule> = {
  PROFILE_WEIGHT_CHANGED: {
    affectedSections: ['NUTRITION_TARGET', 'FOOD_PLAN'],
    severity: 'MEDIUM',
    reasonCodes: ['WEIGHT_CAN_AFFECT_NUTRITION'],
    deterministicUpdateAvailable: true,
    aiRegenerationRecommended: true,
    promptTitle: 'UPDATE_TODAY_NUTRITION',
    promptMessage: 'WEIGHT_CAN_AFFECT_NUTRITION',
    primaryAction: 'UPDATE_TODAY_PLAN'
  },
  PROFILE_HEIGHT_CHANGED: {
    affectedSections: ['NUTRITION_TARGET', 'FOOD_PLAN'],
    severity: 'MEDIUM',
    reasonCodes: ['BODY_METRIC_CAN_AFFECT_TARGETS'],
    deterministicUpdateAvailable: true,
    aiRegenerationRecommended: true,
    promptTitle: 'UPDATE_TODAY_NUTRITION',
    promptMessage: 'CHANGE_CAN_AFFECT_TODAY_PLAN',
    primaryAction: 'UPDATE_TODAY_PLAN'
  },
  ACTIVITY_LEVEL_CHANGED: {
    affectedSections: ['NUTRITION_TARGET', 'FOOD_PLAN', 'TRAINING_PLAN'],
    severity: 'MEDIUM',
    reasonCodes: ['ACTIVITY_LEVEL_CAN_AFFECT_TARGETS'],
    deterministicUpdateAvailable: true,
    aiRegenerationRecommended: true,
    promptTitle: 'UPDATE_TODAY_PLAN',
    promptMessage: 'CHANGE_CAN_AFFECT_TODAY_PLAN',
    primaryAction: 'UPDATE_TODAY_PLAN'
  },
  PRIMARY_GOAL_CHANGED: {
    affectedSections: ['NUTRITION_TARGET', 'FOOD_PLAN', 'TRAINING_PLAN', 'RECOVERY'],
    severity: 'HIGH',
    reasonCodes: ['GOAL_CHANGED'],
    deterministicUpdateAvailable: false,
    aiRegenerationRecommended: true,
    promptTitle: 'REVIEW_TODAY_PLAN',
    promptMessage: 'GOAL_CHANGED',
    primaryAction: 'UPDATE_TODAY_PLAN'
  },
  APP_MODE_CHANGED: {
    affectedSections: ['NUTRITION_TARGET', 'FOOD_PLAN', 'TRAINING_PLAN', 'RECOVERY'],
    severity: 'HIGH',
    reasonCodes: ['APP_MODE_CHANGED'],
    deterministicUpdateAvailable: true,
    aiRegenerationRecommended: true,
    promptTitle: 'REVIEW_TODAY_PLAN',
    promptMessage: 'GOAL_CHANGED',
    primaryAction: 'UPDATE_TODAY_PLAN'
  },
  FOOD_PREFERENCES_CHANGED: {
    affectedSections: ['FOOD_PLAN'],
    severity: 'MEDIUM',
    reasonCodes: ['FOOD_PREFERENCES_CHANGED'],
    deterministicUpdateAvailable: false,
    aiRegenerationRecommended: true,
    promptTitle: 'UPDATE_TODAY_MEALS',
    promptMessage: 'FOOD_MAY_APPEAR',
    primaryAction: 'UPDATE_TODAY_MEALS'
  },
  ALLERGY_CHANGED: {
    affectedSections: ['FOOD_PLAN', 'SAFETY'],
    severity: 'HIGH',
    reasonCodes: ['ALLERGY_CHANGED'],
    deterministicUpdateAvailable: true,
    aiRegenerationRecommended: true,
    promptTitle: 'REVIEW_TODAY_PLAN',
    promptMessage: 'FOOD_MAY_APPEAR',
    primaryAction: 'REVIEW_SAFETY'
  },
  EXCLUDED_FOOD_CHANGED: {
    affectedSections: ['FOOD_PLAN', 'SAFETY'],
    severity: 'HIGH',
    reasonCodes: ['EXCLUDED_FOOD_CHANGED'],
    deterministicUpdateAvailable: true,
    aiRegenerationRecommended: true,
    promptTitle: 'REVIEW_TODAY_PLAN',
    promptMessage: 'FOOD_MAY_APPEAR',
    primaryAction: 'REVIEW_SAFETY'
  },
  DISLIKED_FOOD_CHANGED: {
    affectedSections: ['FOOD_PLAN'],
    severity: 'LOW',
    reasonCodes: ['DISLIKED_FOOD_CHANGED'],
    deterministicUpdateAvailable: false,
    aiRegenerationRecommended: true,
    promptTitle: 'UPDATE_TODAY_MEALS',
    promptMessage: 'FOOD_MAY_APPEAR',
    primaryAction: 'UPDATE_TODAY_MEALS'
  },
  MEAL_COUNT_CHANGED: {
    affectedSections: ['FOOD_PLAN'],
    severity: 'MEDIUM',
    reasonCodes: ['MEAL_COUNT_CHANGED'],
    deterministicUpdateAvailable: false,
    aiRegenerationRecommended: true,
    promptTitle: 'UPDATE_TODAY_MEALS',
    promptMessage: 'CHANGE_CAN_AFFECT_TODAY_PLAN',
    primaryAction: 'UPDATE_TODAY_MEALS'
  },
  TRAINING_ROUTINE_CHANGED: {
    affectedSections: ['TRAINING_PLAN', 'NUTRITION_TARGET', 'FOOD_PLAN', 'RECOVERY'],
    severity: 'HIGH',
    reasonCodes: ['TRAINING_ROUTINE_CHANGED'],
    deterministicUpdateAvailable: true,
    aiRegenerationRecommended: true,
    promptTitle: 'UPDATE_TODAY_WORKOUT',
    promptMessage: 'TRAINING_ROUTINE_CHANGED',
    primaryAction: 'UPDATE_TODAY_TRAINING'
  },
  DAILY_TRAINING_OVERRIDE_CHANGED: {
    affectedSections: ['TRAINING_PLAN', 'NUTRITION_TARGET', 'FOOD_PLAN', 'RECOVERY'],
    severity: 'HIGH',
    reasonCodes: ['DAILY_TRAINING_OVERRIDE_CHANGED'],
    deterministicUpdateAvailable: true,
    aiRegenerationRecommended: true,
    promptTitle: 'UPDATE_TODAY_WORKOUT',
    promptMessage: 'TRAINING_ROUTINE_CHANGED',
    primaryAction: 'UPDATE_TODAY_TRAINING'
  },
  TRAINING_DURATION_CHANGED: {
    affectedSections: ['TRAINING_PLAN', 'NUTRITION_TARGET', 'FOOD_PLAN'],
    severity: 'MEDIUM',
    reasonCodes: ['TRAINING_DURATION_CHANGED'],
    deterministicUpdateAvailable: true,
    aiRegenerationRecommended: true,
    promptTitle: 'UPDATE_TODAY_WORKOUT',
    promptMessage: 'TRAINING_ROUTINE_CHANGED',
    primaryAction: 'UPDATE_TODAY_TRAINING'
  },
  TRAINING_EQUIPMENT_CHANGED: {
    affectedSections: ['TRAINING_PLAN'],
    severity: 'MEDIUM',
    reasonCodes: ['TRAINING_EQUIPMENT_CHANGED'],
    deterministicUpdateAvailable: false,
    aiRegenerationRecommended: true,
    promptTitle: 'UPDATE_TODAY_WORKOUT',
    promptMessage: 'TRAINING_ROUTINE_CHANGED',
    primaryAction: 'UPDATE_TODAY_TRAINING'
  },
  TRAINING_MUSCLES_CHANGED: {
    affectedSections: ['TRAINING_PLAN'],
    severity: 'MEDIUM',
    reasonCodes: ['TRAINING_MUSCLES_CHANGED'],
    deterministicUpdateAvailable: false,
    aiRegenerationRecommended: true,
    promptTitle: 'UPDATE_TODAY_WORKOUT',
    promptMessage: 'TRAINING_ROUTINE_CHANGED',
    primaryAction: 'UPDATE_TODAY_TRAINING'
  },
  APPLE_HEALTH_SYNCED: {
    affectedSections: ['WEARABLE_CONTEXT', 'NUTRITION_TARGET', 'TRAINING_PLAN', 'RECOVERY'],
    severity: 'LOW',
    reasonCodes: ['APPLE_HEALTH_SYNCED'],
    deterministicUpdateAvailable: true,
    aiRegenerationRecommended: true,
    promptTitle: 'UPDATE_TODAY_PLAN',
    promptMessage: 'USE_LATEST_HEALTH_DATA',
    primaryAction: 'UPDATE_TODAY_PLAN'
  },
  WEARABLE_SNAPSHOT_CHANGED: {
    affectedSections: ['WEARABLE_CONTEXT', 'NUTRITION_TARGET', 'TRAINING_PLAN', 'RECOVERY'],
    severity: 'LOW',
    reasonCodes: ['WEARABLE_SNAPSHOT_CHANGED'],
    deterministicUpdateAvailable: true,
    aiRegenerationRecommended: true,
    promptTitle: 'UPDATE_TODAY_PLAN',
    promptMessage: 'USE_LATEST_HEALTH_DATA',
    primaryAction: 'UPDATE_TODAY_PLAN'
  },
  PRE_WORKOUT_PAIN_LIMITATION: {
    affectedSections: ['TRAINING_PLAN', 'SAFETY'],
    severity: 'SAFETY_CRITICAL',
    reasonCodes: ['PRE_WORKOUT_PAIN_LIMITATION'],
    deterministicUpdateAvailable: true,
    aiRegenerationRecommended: false,
    promptTitle: 'SAFETY_REVIEW_RECOMMENDED',
    promptMessage: 'PAIN_LIMITATION_REVIEW',
    primaryAction: 'REVIEW_SAFETY'
  },
  PAIN_AWARE_REPLACEMENT_APPLIED: {
    affectedSections: ['TRAINING_PLAN', 'SAFETY'],
    severity: 'HIGH',
    reasonCodes: ['PAIN_AWARE_REPLACEMENT_APPLIED'],
    deterministicUpdateAvailable: true,
    aiRegenerationRecommended: false,
    promptTitle: 'UPDATE_TODAY_WORKOUT',
    promptMessage: 'PAIN_LIMITATION_REVIEW',
    primaryAction: 'REVIEW_SAFETY'
  }
};

@Injectable()
export class PlanImpactService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(userId: string, dto: EvaluatePlanImpactDto): Promise<EvaluatePlanImpactResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true }
    });
    const localDate = dto.localDate ?? this.getLocalDate(user.timezone);
    const plan = await this.prisma.dailyPlan.findFirst({
      where: {
        userId,
        planLocalDate: localDate
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (!plan) {
      return this.createNoCurrentPlanResponse(dto.changeTypes, localDate);
    }

    const rules = dto.changeTypes.map((changeType) => CHANGE_RULES[changeType]);
    const conflict = this.findRestrictedFoodConflict(plan.planJson, dto);
    const safetyCritical =
      conflict.found || dto.changeTypes.includes('PRE_WORKOUT_PAIN_LIMITATION');
    const severity = safetyCritical
      ? 'SAFETY_CRITICAL'
      : this.maxSeverity(rules.map((rule) => rule.severity));
    const affectedSections = this.unique(
      rules.flatMap((rule) => rule.affectedSections).concat(safetyCritical ? ['SAFETY'] : [])
    );
    const reasonCodes = this.unique(
      rules.flatMap((rule) => rule.reasonCodes).concat(conflict.reasonCodes)
    );
    const aiRegenerationRecommended = rules.some((rule) => rule.aiRegenerationRecommended);
    const promptRule = this.pickPromptRule(rules);
    const prompt = aiRegenerationRecommended || safetyCritical
      ? this.createPrompt(promptRule, {
          requiresAiGeneration: aiRegenerationRecommended,
          usageCost: aiRegenerationRecommended ? 1 : null,
          safetyCritical
        })
      : null;

    return {
      affectsCurrentPlan: true,
      affectedSections,
      severity,
      changeTypes: dto.changeTypes,
      currentDailyPlanId: plan.id,
      currentPlanLocalDate: plan.planLocalDate,
      deterministicUpdateAvailable: rules.some((rule) => rule.deterministicUpdateAvailable) || safetyCritical,
      aiRegenerationRecommended,
      aiRegenerationRequiredForFullUpdate: aiRegenerationRecommended,
      safetyCritical,
      safetyActionsRequired: safetyCritical
        ? this.unique(['REVIEW_CURRENT_PLAN', ...conflict.safetyActions])
        : [],
      entitlementFeatureKey: aiRegenerationRecommended ? UsageFeature.DAILY_PLAN_REFRESH : null,
      usageCost: aiRegenerationRecommended ? 1 : null,
      reasonCodes,
      prompt
    };
  }

  private createNoCurrentPlanResponse(
    changeTypes: PlanImpactChangeType[],
    localDate: string
  ): EvaluatePlanImpactResponse {
    return {
      affectsCurrentPlan: false,
      affectedSections: [],
      severity: 'NONE',
      changeTypes,
      currentDailyPlanId: null,
      currentPlanLocalDate: localDate,
      deterministicUpdateAvailable: false,
      aiRegenerationRecommended: false,
      aiRegenerationRequiredForFullUpdate: false,
      safetyCritical: false,
      safetyActionsRequired: [],
      entitlementFeatureKey: null,
      usageCost: null,
      reasonCodes: ['NO_CURRENT_PLAN'],
      prompt: null
    };
  }

  private createPrompt(
    rule: ChangeRule,
    options: {
      requiresAiGeneration: boolean;
      usageCost: number | null;
      safetyCritical: boolean;
    }
  ): PlanRegenerationPrompt {
    return {
      titleCode: options.safetyCritical ? 'SAFETY_REVIEW_RECOMMENDED' : rule.promptTitle,
      messageCode: options.safetyCritical ? 'PAIN_LIMITATION_REVIEW' : rule.promptMessage,
      primaryAction: options.safetyCritical ? 'REVIEW_SAFETY' : rule.primaryAction,
      secondaryAction: 'APPLY_TO_FUTURE_ONLY',
      requiresAiGeneration: options.requiresAiGeneration,
      usageCost: options.usageCost,
      safetyCritical: options.safetyCritical
    };
  }

  private pickPromptRule(rules: ChangeRule[]) {
    return [...rules].sort(
      (a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]
    )[0] ?? CHANGE_RULES.FOOD_PREFERENCES_CHANGED;
  }

  private maxSeverity(severities: PlanImpactSeverity[]) {
    return [...severities].sort((a, b) => SEVERITY_ORDER[b] - SEVERITY_ORDER[a])[0] ?? 'NONE';
  }

  private findRestrictedFoodConflict(planJson: Prisma.JsonValue, dto: EvaluatePlanImpactDto) {
    const restrictedFoods = this.extractRestrictedFoods(dto);
    if (restrictedFoods.length === 0) {
      return { found: false, reasonCodes: [] as string[], safetyActions: [] as string[] };
    }

    const names = this.extractPlanFoodNames(planJson);
    const conflict = restrictedFoods.find((restrictedFood) =>
      names.some((foodName) => this.includesFoodName(foodName, restrictedFood))
    );

    if (!conflict) {
      return { found: false, reasonCodes: [] as string[], safetyActions: [] as string[] };
    }

    return {
      found: true,
      reasonCodes: ['RESTRICTED_FOOD_IN_CURRENT_PLAN'],
      safetyActions: ['REVIEW_AFFECTED_MEALS']
    };
  }

  private extractRestrictedFoods(dto: EvaluatePlanImpactDto) {
    if (
      !dto.changeTypes.some((changeType) =>
        ['ALLERGY_CHANGED', 'EXCLUDED_FOOD_CHANGED', 'DISLIKED_FOOD_CHANGED'].includes(changeType)
      )
    ) {
      return [];
    }

    const values = dto.newValues ?? {};
    const keys = ['food', 'foods', 'allergies', 'excludedFoods', 'dislikedFoods', 'restrictedFoods'];
    return this.unique(
      keys.flatMap((key) => this.toStringList(values[key]))
        .map((food) => this.normalizeFood(food))
        .filter(Boolean)
    );
  }

  private extractPlanFoodNames(planJson: Prisma.JsonValue) {
    const root = this.asRecord(planJson);
    const nutrition = this.asRecord(root?.nutrition);
    const names: string[] = [];

    this.extractMeals(nutrition?.meals).forEach((meal) => {
      this.toRecords(meal.foods).forEach((food) => {
        if (typeof food.name === 'string') names.push(food.name);
      });
    });

    this.toRecords(nutrition?.menuOptions).forEach((option) => {
      this.extractMeals(option.meals).forEach((meal) => {
        this.toRecords(meal.foods).forEach((food) => {
          if (typeof food.name === 'string') names.push(food.name);
        });
      });
    });

    const foodPlan = this.asRecord(nutrition?.foodPlan);
    this.toRecords(foodPlan?.meals).forEach((meal) => {
      if (typeof meal.title === 'string') names.push(meal.title);
      this.toRecords(meal.ingredients).forEach((ingredient) => {
        if (typeof ingredient.name === 'string') names.push(ingredient.name);
      });
    });

    return names;
  }

  private extractMeals(value: unknown) {
    return this.toRecords(value);
  }

  private includesFoodName(foodName: string, restrictedFood: string) {
    return this.normalizeFood(foodName).includes(restrictedFood);
  }

  private normalizeFood(value: string) {
    return value.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
  }

  private toStringList(value: unknown): string[] {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }

    return [];
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }

  private toRecords(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value)
      ? value.filter((item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null && !Array.isArray(item)
        )
      : [];
  }

  private unique<T>(items: T[]) {
    return [...new Set(items)];
  }

  private getLocalDate(timezone: string) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }
}
