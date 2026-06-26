import { Injectable } from '@nestjs/common';
import { GoalImpactMode, GoalType, PregnancyStatus, PrimaryGoal } from '@prisma/client';
import type {
  NutritionMacroTarget,
  NutritionTarget,
  NutritionTargetMissingField,
  NutritionTargetReason,
  NutritionTargetSnapshot
} from '@optime/shared-types';

import {
  ACTIVITY_FACTORS,
  ADULT_MIN_CALORIES,
  GOAL_CALORIE_ADJUSTMENTS,
  MAX_TRAINING_KCAL_ADJUSTMENT,
  NUTRITION_ENGINE_VERSION,
  TRAINING_KCAL_PER_MINUTE
} from './nutrition-target.constants';
import { NutritionTargetInputResolver, ResolvedNutritionTargetInput } from './nutrition-target-input.resolver';

@Injectable()
export class NutritionTargetsService {
  constructor(private readonly inputResolver: NutritionTargetInputResolver) {}

  async getPreview(userId: string, planLocalDate?: string) {
    return this.calculate(await this.inputResolver.resolve(userId, planLocalDate));
  }

  toSnapshot(target: NutritionTarget): NutritionTargetSnapshot {
    return {
      engineVersion: target.engineVersion,
      localDate: target.localDate,
      dayType: target.dayType,
      appMode: target.appMode,
      primaryGoal: target.primaryGoal,
      targetKcal: target.calories.targetKcal,
      minKcal: target.calories.minKcal,
      maxKcal: target.calories.maxKcal,
      maintenanceEstimateKcal: target.calories.maintenanceEstimateKcal,
      proteinGrams: target.macros.proteinGrams,
      carbsGrams: target.macros.carbsGrams,
      fatGrams: target.macros.fatGrams,
      safetyStatus: target.safety.status,
      safetyReasons: target.safety.reasons,
      explanation: target.explanation
    };
  }

  private calculate(input: ResolvedNutritionTargetInput): NutritionTarget {
    const profile = input.user.profile;
    const primaryGoal = this.resolvePrimaryGoal(input);
    const dayType = this.resolveDayType(input);
    const context = {
      trainingEnabled: input.trainingEnabled,
      scheduledTrainingDay: dayType === 'TRAINING_DAY',
      plannedWorkoutDurationMinutes: dayType === 'TRAINING_DAY'
        ? input.resolvedTrainingDay.durationMinutes
        : null,
      plannedWorkoutIntensity: dayType === 'TRAINING_DAY' ? 'MODERATE' : null,
      normalActivityLevel: profile?.activityLevel ?? null,
      inheritedScheduleFields: input.resolvedTrainingDay.inheritedFields
    };

    if (!profile) {
      return this.createNeedsMoreInfoTarget(input, primaryGoal, dayType, context, ['profile'], [
        'Profile basics are needed before OptiMe can calculate nutrition targets.'
      ]);
    }

    const age = this.getAge(profile.dateOfBirth, input.planLocalDate);
    if (!Number.isFinite(age) || age < 13 || age > 100) {
      return this.createNeedsMoreInfoTarget(input, primaryGoal, dayType, context, ['dateOfBirth'], [
        'A valid date of birth is needed before OptiMe can calculate nutrition targets.'
      ]);
    }

    const sensitiveContext = this.isSensitiveContext(input, age);
    const safetyReasons: string[] = [];
    const safetyWarnings: string[] = [];
    if (sensitiveContext) {
      safetyReasons.push('Nutrition targets are conservative for age or health-safety context.');
    }
    if (input.healthPlanningContext.signals.lowSleep) {
      safetyWarnings.push('Recent sleep signals suggest keeping targets steady and training support gentle.');
    }

    const maintenanceEstimateKcal = this.roundToNearest(
      this.calculateMaintenance({
        gender: profile.gender,
        weightKg: profile.weightKg,
        heightCm: profile.heightCm,
        age,
        activityLevel: profile.activityLevel
      }),
      25
    );
    const goalAdjustment = this.resolveGoalAdjustment({
      primaryGoal,
      sensitiveContext,
      input,
      safetyReasons
    });
    const trainingAdjustment = dayType === 'TRAINING_DAY'
      ? Math.min(
          MAX_TRAINING_KCAL_ADJUSTMENT,
          input.resolvedTrainingDay.durationMinutes * TRAINING_KCAL_PER_MINUTE
        )
      : 0;
    const adjustmentKcal = this.roundToNearest(goalAdjustment + trainingAdjustment, 25);
    const minKcal = sensitiveContext
      ? maintenanceEstimateKcal
      : this.resolveMinimumCalories(profile.gender);
    const rawTargetKcal = maintenanceEstimateKcal + adjustmentKcal;
    const targetKcal = this.roundToNearest(Math.max(rawTargetKcal, minKcal), 25);
    const macros = this.calculateMacros({
      targetKcal,
      weightKg: profile.weightKg,
      primaryGoal,
      sensitiveContext
    });

    return {
      engineVersion: NUTRITION_ENGINE_VERSION,
      localDate: input.planLocalDate,
      source: 'DETERMINISTIC_ENGINE',
      appMode: input.appMode,
      primaryGoal,
      dayType,
      calories: {
        targetKcal,
        minKcal,
        maxKcal: this.roundToNearest(targetKcal + 150, 25),
        maintenanceEstimateKcal,
        adjustmentKcal: targetKcal - maintenanceEstimateKcal,
        adjustmentReason: this.getAdjustmentReason({ primaryGoal, dayType, sensitiveContext })
      },
      macros,
      context,
      safety: {
        status: sensitiveContext ? 'LIMITED' : 'OK',
        reasons: safetyReasons,
        warnings: safetyWarnings
      },
      explanation: this.buildExplanation({
        targetKcal,
        minKcal,
        maxKcal: this.roundToNearest(targetKcal + 150, 25),
        maintenanceEstimateKcal,
        primaryGoal,
        dayType,
        sensitiveContext,
        appMode: input.appMode,
        durationMinutes: context.plannedWorkoutDurationMinutes,
        macros
      })
    };
  }

  private createNeedsMoreInfoTarget(
    input: ResolvedNutritionTargetInput,
    primaryGoal: PrimaryGoal,
    dayType: NutritionTarget['dayType'],
    context: NutritionTarget['context'],
    missingFields: NutritionTargetMissingField[],
    reasons: string[]
  ): NutritionTarget {
    return {
      engineVersion: NUTRITION_ENGINE_VERSION,
      localDate: input.planLocalDate,
      source: 'DETERMINISTIC_ENGINE',
      appMode: input.appMode,
      primaryGoal,
      dayType,
      calories: {
        targetKcal: 0,
        minKcal: 0,
        maxKcal: 0,
        maintenanceEstimateKcal: 0,
        adjustmentKcal: 0,
        adjustmentReason: 'More profile information is needed.'
      },
      macros: {
        proteinGrams: 0,
        carbsGrams: 0,
        fatGrams: 0,
        proteinKcal: 0,
        carbsKcal: 0,
        fatKcal: 0
      },
      context,
      safety: {
        status: 'NEEDS_MORE_INFO',
        reasons,
        warnings: []
      },
      explanation: {
        titleCode: 'MORE_INFO_NEEDED',
        reasonCodes: [
          {
            code: 'NEEDS_PROFILE_DETAILS',
            params: { missingFields }
          }
        ]
      }
    };
  }

  private calculateMaintenance(input: {
    gender: string | null;
    weightKg: number;
    heightCm: number;
    age: number;
    activityLevel: keyof typeof ACTIVITY_FACTORS;
  }) {
    const gender = input.gender?.toLowerCase();
    const bmrOffset = gender === 'male' ? 5 : gender === 'female' ? -161 : -78;
    const bmr = (10 * input.weightKg) + (6.25 * input.heightCm) - (5 * input.age) + bmrOffset;
    return bmr * ACTIVITY_FACTORS[input.activityLevel];
  }

  private calculateMacros(input: {
    targetKcal: number;
    weightKg: number;
    primaryGoal: PrimaryGoal;
    sensitiveContext: boolean;
  }): NutritionMacroTarget {
    if (input.targetKcal <= 0) {
      return {
        proteinGrams: 0,
        carbsGrams: 0,
        fatGrams: 0,
        proteinKcal: 0,
        carbsKcal: 0,
        fatKcal: 0
      };
    }

    const proteinFactor = input.sensitiveContext
      ? 1.2
      : input.primaryGoal === PrimaryGoal.WEIGHT_GAIN
        ? 1.6
        : input.primaryGoal === PrimaryGoal.WEIGHT_LOSS
          ? 1.5
          : 1.3;
    const proteinGrams = this.roundToNearest(input.weightKg * proteinFactor, 5);
    const fatGrams = this.roundToNearest(Math.max(45, input.weightKg * 0.7), 5);
    const proteinKcal = proteinGrams * 4;
    const fatKcal = fatGrams * 9;
    const carbsGrams = this.roundToNearest(
      Math.max(0, (input.targetKcal - proteinKcal - fatKcal) / 4),
      5
    );

    return {
      proteinGrams,
      carbsGrams,
      fatGrams,
      proteinKcal,
      carbsKcal: carbsGrams * 4,
      fatKcal
    };
  }

  private resolvePrimaryGoal(input: ResolvedNutritionTargetInput) {
    if (input.user.goal?.primaryGoal) return input.user.goal.primaryGoal;

    switch (input.user.goal?.goalType) {
      case GoalType.REDUCE_WEIGHT:
        return PrimaryGoal.WEIGHT_LOSS;
      case GoalType.BUILD_MUSCLE:
        return PrimaryGoal.WEIGHT_GAIN;
      case GoalType.HEALTHY_LIFESTYLE:
        return PrimaryGoal.HEALTHY_EATING;
      case GoalType.IMPROVE_FITNESS:
      case GoalType.IMPROVE_ENDURANCE:
      default:
        return PrimaryGoal.WEIGHT_MAINTENANCE;
    }
  }

  private resolveDayType(input: ResolvedNutritionTargetInput): NutritionTarget['dayType'] {
    if (input.appMode === GoalImpactMode.NUTRITION_ONLY) return 'NUTRITION_ONLY';
    if (!input.trainingEnabled) return 'TRAINING_DISABLED';
    return input.resolvedTrainingDay.isTrainingDay ? 'TRAINING_DAY' : 'REST_DAY';
  }

  private resolveGoalAdjustment(input: {
    primaryGoal: PrimaryGoal;
    sensitiveContext: boolean;
    input: ResolvedNutritionTargetInput;
    safetyReasons: string[];
  }) {
    if (input.sensitiveContext && input.primaryGoal === PrimaryGoal.WEIGHT_LOSS) {
      input.safetyReasons.push('Deficit targets are disabled for this safety context.');
      return 0;
    }

    const baseAdjustment = GOAL_CALORIE_ADJUSTMENTS[input.primaryGoal];
    const targetWeightKg = input.input.user.goal?.targetWeightKg;
    const currentWeightKg = input.input.user.profile?.weightKg;
    const timelineDays = input.input.user.goal?.targetTimelineDays;

    if (
      input.primaryGoal === PrimaryGoal.WEIGHT_LOSS &&
      targetWeightKg &&
      currentWeightKg &&
      timelineDays &&
      currentWeightKg > targetWeightKg
    ) {
      const weeklyLossKg = ((currentWeightKg - targetWeightKg) / timelineDays) * 7;
      if (weeklyLossKg > 0.75) {
        input.safetyReasons.push('Weight-loss pace is capped to keep the target sustainable.');
        return -250;
      }
    }

    return baseAdjustment;
  }

  private isSensitiveContext(input: ResolvedNutritionTargetInput, age: number) {
    const pregnancyStatus = input.user.profile?.pregnancyStatus;
    return (
      input.user.safeMode ||
      input.user.isMinor ||
      age < 18 ||
      pregnancyStatus === PregnancyStatus.PREGNANT ||
      pregnancyStatus === PregnancyStatus.POSTPARTUM ||
      pregnancyStatus === PregnancyStatus.BREASTFEEDING
    );
  }

  private resolveMinimumCalories(gender: string | null) {
    const normalizedGender = gender?.toLowerCase();
    if (normalizedGender === 'male') return ADULT_MIN_CALORIES.male;
    if (normalizedGender === 'female') return ADULT_MIN_CALORIES.female;
    return ADULT_MIN_CALORIES.default;
  }

  private getAdjustmentReason(input: {
    primaryGoal: PrimaryGoal;
    dayType: NutritionTarget['dayType'];
    sensitiveContext: boolean;
  }) {
    if (input.sensitiveContext) {
      return 'Conservative safety context: no aggressive nutrition adjustment.';
    }
    if (input.dayType === 'TRAINING_DAY') {
      return 'Training day support added on top of the goal target.';
    }
    switch (input.primaryGoal) {
      case PrimaryGoal.WEIGHT_LOSS:
        return 'Small sustainable deficit for the selected goal.';
      case PrimaryGoal.WEIGHT_GAIN:
        return 'Small surplus to support muscle and strength progress.';
      case PrimaryGoal.HEALTHY_EATING:
      case PrimaryGoal.WEIGHT_MAINTENANCE:
      default:
        return 'Maintenance-oriented target for steady energy.';
    }
  }

  private buildExplanation(input: {
    targetKcal: number;
    minKcal: number;
    maxKcal: number;
    maintenanceEstimateKcal: number;
    primaryGoal: PrimaryGoal;
    dayType: NutritionTarget['dayType'];
    sensitiveContext: boolean;
    appMode: GoalImpactMode;
    durationMinutes: number | null;
    macros: NutritionMacroTarget;
  }) {
    const reasonCodes: NutritionTargetReason[] = [
      {
        code: 'USING_MAINTENANCE_ESTIMATE',
        params: { targetKcal: input.targetKcal }
      },
      {
        code: 'BASED_ON_NORMAL_ACTIVITY',
        params: {
          targetKcal: input.targetKcal,
          minKcal: input.minKcal,
          maxKcal: input.maxKcal
        }
      },
      {
        code: 'BASED_ON_PRIMARY_GOAL',
        params: { primaryGoal: input.primaryGoal }
      },
      {
        code: 'MACROS_DERIVED_FROM_TARGET',
        params: {
          proteinGrams: input.macros.proteinGrams,
          carbsGrams: input.macros.carbsGrams,
          fatGrams: input.macros.fatGrams
        }
      }
    ];

    if (input.appMode === GoalImpactMode.NUTRITION_ONLY) {
      reasonCodes.push({
        code: 'NUTRITION_ONLY_MODE',
        params: { appMode: input.appMode }
      });
    } else if (input.dayType === 'TRAINING_DAY') {
      reasonCodes.push({
        code: 'ADJUSTED_FOR_TRAINING_DAY',
        params: {
          dayType: input.dayType,
          ...(input.durationMinutes ? { durationMinutes: input.durationMinutes } : {})
        }
      });
    } else if (input.dayType === 'REST_DAY') {
      reasonCodes.push({ code: 'SCHEDULED_REST_DAY' });
    } else if (input.dayType === 'TRAINING_DISABLED') {
      reasonCodes.push({ code: 'TRAINING_DISABLED' });
    }

    if (input.primaryGoal === PrimaryGoal.WEIGHT_LOSS && !input.sensitiveContext) {
      reasonCodes.push({ code: 'WEIGHT_LOSS_DEFICIT_APPLIED' });
    } else if (input.primaryGoal === PrimaryGoal.WEIGHT_GAIN && !input.sensitiveContext) {
      reasonCodes.push({ code: 'WEIGHT_GAIN_SURPLUS_APPLIED' });
    } else if (input.primaryGoal === PrimaryGoal.HEALTHY_EATING) {
      reasonCodes.push({ code: 'HEALTHY_EATING_BALANCED_TARGET' });
    }

    if (input.sensitiveContext) {
      reasonCodes.push(
        { code: 'LIMITED_BY_HEALTH_CONTEXT' },
        { code: 'CONSERVATIVE_SAFETY_TARGET' }
      );
    }

    return {
      titleCode: 'TODAY_TARGET' as const,
      reasonCodes
    };
  }

  private getAge(dateOfBirth: Date, planLocalDate: string) {
    const current = new Date(`${planLocalDate}T00:00:00Z`);
    let age = current.getUTCFullYear() - dateOfBirth.getUTCFullYear();
    const monthDiff = current.getUTCMonth() - dateOfBirth.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && current.getUTCDate() < dateOfBirth.getUTCDate())) {
      age -= 1;
    }
    return age;
  }

  private roundToNearest(value: number, nearest: number) {
    return Math.round(value / nearest) * nearest;
  }
}
