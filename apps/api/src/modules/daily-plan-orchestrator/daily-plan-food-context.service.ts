import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import {
  GoalImpactMode,
  PlanStatus,
  PreferredLocale,
  Prisma
} from '@prisma/client';
import {
  resolveSupportedLocale,
  type DailyFoodPlan,
  type NutritionTarget,
  type NutritionTargetExplanation,
  type NutritionTargetSnapshot,
  type ResolvedTrainingDayContext,
  type SupportedLocale
} from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { normalizeDailyPlanJson } from '../daily-plans/daily-plan-normalizer';
import { FeatureAccessService } from '../entitlements/feature-access.service';
import {
  dailyPlanPlanningUserSelect,
  type DailyPlanPlanningUser
} from './daily-plan-planning-user';
import { DailyPlanOrchestratorService } from './daily-plan-orchestrator.service';

@Injectable()
export class DailyPlanFoodContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureAccessService: FeatureAccessService,
    private readonly orchestrator: DailyPlanOrchestratorService
  ) {}

  async getContext(userId: string, dailyPlanId: string) {
    const [user, plan] = await Promise.all([
      this.getPlanningUser(userId),
      this.getOwnedPlanOrThrow(userId, dailyPlanId)
    ]);
    const currentPlanJson = normalizeDailyPlanJson({
      planJson: plan.planJson,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      readinessLevel: plan.readinessLevel
    });
    const currentFoodPlan = currentPlanJson.nutrition.foodPlan;

    if (!currentFoodPlan) {
      throw new BadRequestException(
        'This plan does not support meal regeneration yet.'
      );
    }

    const nutritionTargetSnapshot =
      currentFoodPlan.nutritionTargetSnapshot ??
      currentPlanJson.nutritionTargetSnapshot;

    if (!nutritionTargetSnapshot) {
      throw new BadRequestException(
        'This plan is missing a nutrition target snapshot.'
      );
    }

    const nutritionTarget = this.nutritionTargetFromSnapshot(
      nutritionTargetSnapshot
    );
    const resolvedTrainingDay =
      currentPlanJson.trainingScheduleSnapshot ??
      this.createFallbackTrainingDayContext(
        plan.planLocalDate,
        nutritionTarget
      );
    const planQualityMode =
      await this.featureAccessService.getPlanQualityMode(userId);
    const appMode = nutritionTarget.appMode as GoalImpactMode;
    const personalizationContext =
      await this.orchestrator.preparePersonalizationContext({
        user,
        planQualityMode,
        planLocalDate: plan.planLocalDate,
        resolvedTrainingDay,
        appMode
      });
    personalizationContext.nutritionTarget = nutritionTarget;

    return {
      user,
      plan,
      locale: this.resolvePlanningLocale(user),
      currentPlanJson,
      currentFoodPlan,
      nutritionTarget,
      nutritionTargetSnapshot,
      resolvedTrainingDay,
      planQualityMode,
      appMode,
      personalizationContext,
      blockedFoods: {
        allergies:
          user.nutritionPref?.allergies.map(
            (food) => food.name
          ) ?? [],
        excludedFoods:
          user.nutritionPref?.excludedFoods.map(
            (food) => food.name
          ) ?? []
      }
    };
  }

  async persistFoodPlan(
    context: Awaited<
      ReturnType<DailyPlanFoodContextService['getContext']>
    >,
    foodPlan: DailyFoodPlan
  ) {
    const nextPlanJson = this.orchestrator.attachFoodPlan(
      context.currentPlanJson,
      foodPlan
    );
    const validation =
      await this.orchestrator.validateGeneratedPlan({
        providerPlan: nextPlanJson,
        blockedFoods: context.blockedFoods,
        planLocalDate: context.plan.planLocalDate,
        planTimezone: context.plan.planTimezone,
        locale: context.locale,
        planQualityMode: context.planQualityMode,
        user: context.user,
        personalizationContext:
          context.personalizationContext,
        forcedFallback: false,
        allowSafetyRetry: false
      });

    if (validation.status !== PlanStatus.READY) {
      throw new BadRequestException(
        'Could not safely regenerate this meal plan. Your current plan was kept.'
      );
    }

    return this.prisma.dailyPlan.update({
      where: { id: context.plan.id },
      data: {
        status: validation.status,
        planJson: validation.planJson as Prisma.JsonObject
      }
    });
  }

  private async getPlanningUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: dailyPlanPlanningUserSelect
    });

    if (!user) {
      throw new UnauthorizedException(
        'Your session is no longer valid. Please log in again.'
      );
    }

    return user;
  }

  private async getOwnedPlanOrThrow(
    userId: string,
    dailyPlanId: string
  ) {
    const plan = await this.prisma.dailyPlan.findFirst({
      where: {
        id: dailyPlanId,
        userId
      }
    });

    if (!plan) {
      throw new NotFoundException('Daily plan not found.');
    }

    return plan;
  }

  private nutritionTargetFromSnapshot(
    snapshot: NutritionTargetSnapshot
  ): NutritionTarget {
    return {
      engineVersion: snapshot.engineVersion,
      localDate: snapshot.localDate,
      source: 'DETERMINISTIC_ENGINE',
      appMode: snapshot.appMode,
      primaryGoal: snapshot.primaryGoal,
      dayType: snapshot.dayType,
      calories: {
        targetKcal: snapshot.targetKcal,
        minKcal: snapshot.minKcal,
        maxKcal: snapshot.maxKcal,
        maintenanceEstimateKcal:
          snapshot.maintenanceEstimateKcal,
        adjustmentKcal: 0,
        adjustmentReason: 'stored_daily_plan_snapshot'
      },
      macros: {
        proteinGrams: snapshot.proteinGrams,
        carbsGrams: snapshot.carbsGrams,
        fatGrams: snapshot.fatGrams,
        proteinKcal: snapshot.proteinGrams * 4,
        carbsKcal: snapshot.carbsGrams * 4,
        fatKcal: snapshot.fatGrams * 9
      },
      context: {
        trainingEnabled:
          snapshot.appMode === 'NUTRITION_AND_TRAINING',
        scheduledTrainingDay:
          snapshot.dayType === 'TRAINING_DAY',
        plannedWorkoutDurationMinutes: null,
        plannedWorkoutIntensity: null,
        normalActivityLevel: null
      },
      safety: {
        status: snapshot.safetyStatus,
        reasons: snapshot.safetyReasons,
        warnings: []
      },
      explanation: this.normalizeNutritionTargetExplanation(
        snapshot.explanation
      )
    };
  }

  private normalizeNutritionTargetExplanation(
    explanation: NutritionTargetSnapshot['explanation']
  ): NutritionTargetExplanation {
    if (
      'titleCode' in explanation &&
      'reasonCodes' in explanation
    ) {
      return explanation;
    }

    return {
      titleCode: 'TODAY_TARGET',
      reasonCodes: []
    };
  }

  private createFallbackTrainingDayContext(
    planLocalDate: string,
    nutritionTarget: NutritionTarget
  ): ResolvedTrainingDayContext {
    return {
      source: 'GLOBAL_DEFAULTS',
      localDate: planLocalDate,
      dayOfWeek: 'MONDAY',
      isTrainingDay:
        nutritionTarget.dayType === 'TRAINING_DAY',
      targetMuscles: [],
      environment: null,
      availableEquipment: [],
      durationMinutes: 30,
      protocolPreference: null,
      inheritedFields: []
    };
  }

  private resolvePlanningLocale(
    user: DailyPlanPlanningUser
  ): SupportedLocale {
    switch (user.settings?.preferredLocale) {
      case PreferredLocale.RU_RU:
        return 'ru-RU';
      case PreferredLocale.FR_FR:
        return 'fr-FR';
      case PreferredLocale.ZH_CN:
        return 'zh-CN';
      case PreferredLocale.EN_US:
        return 'en-US';
      default:
        return resolveSupportedLocale(user.locale);
    }
  }
}

export type DailyPlanFoodContext = Awaited<
  ReturnType<DailyPlanFoodContextService['getContext']>
>;
