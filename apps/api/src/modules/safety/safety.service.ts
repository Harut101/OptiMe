import { BadRequestException, Injectable } from '@nestjs/common';
import { GoalImpactMode, GoalType, IntensityLevel, PregnancyStatus } from '@prisma/client';

import {
  MAX_SAFE_WEIGHT_LOSS_FRACTION,
  MAX_SAFE_WEIGHT_LOSS_KG_PER_WEEK,
  MINOR_AGE,
  MINOR_SAFE_GOAL_TYPE,
  SUPPORTIVE_SAFETY_MESSAGES,
  TRAINING_DURATION_LIMITS_BY_INTENSITY,
  UNSAFE_TRAINING_DESCRIPTION_PATTERNS
} from './safety-rules';

export interface AgeSafetyResult {
  age: number;
  isMinor: boolean;
  safeMode: boolean;
}

export interface GoalSafetyInput {
  goalType: GoalType;
  targetWeightKg?: number;
  targetTimelineDays?: number;
  impactMode?: GoalImpactMode;
  currentWeightKg?: number;
  isMinor: boolean;
  pregnancyStatus?: PregnancyStatus | null;
}

export interface SafeGoalResult {
  goalType: GoalType;
  targetWeightKg: number | null;
  targetTimelineDays: number | null;
  impactMode: GoalImpactMode | null;
  adjustedForSafety: boolean;
}

export interface TrainingSafetyInput {
  durationMinutes: number;
  intensity: IntensityLevel;
  description?: string | null;
}

export interface NutritionSafetyInput {
  allergies: string[];
  excludedFoods: string[];
  preferredFoods: string[];
}

export type FoodConflictType = 'allergy' | 'excludedFood';

export interface PlanFoodSafetyConflict {
  conflictType: FoodConflictType;
  restrictedFood: string;
  matchedFoodName?: string;
  matchedPath?: string;
}

export type PregnancySensitiveStatus = Extract<
  PregnancyStatus,
  'PREGNANT' | 'POSTPARTUM' | 'BREASTFEEDING'
>;

@Injectable()
export class SafetyService {
  deriveAgeSafety(dateOfBirth: Date): AgeSafetyResult {
    if (Number.isNaN(dateOfBirth.getTime())) {
      throw new BadRequestException(SUPPORTIVE_SAFETY_MESSAGES.invalidDateOfBirth);
    }

    const now = new Date();

    if (dateOfBirth > now) {
      throw new BadRequestException(SUPPORTIVE_SAFETY_MESSAGES.futureDateOfBirth);
    }

    let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
    const monthDelta = now.getUTCMonth() - dateOfBirth.getUTCMonth();
    const hasBirthdayPassed =
      monthDelta > 0 || (monthDelta === 0 && now.getUTCDate() >= dateOfBirth.getUTCDate());

    if (!hasBirthdayPassed) {
      age -= 1;
    }

    const isMinor = age < MINOR_AGE;

    return {
      age,
      isMinor,
      safeMode: isMinor
    };
  }

  validateGoal(input: GoalSafetyInput): SafeGoalResult {
    if (input.goalType !== GoalType.REDUCE_WEIGHT) {
      return {
        goalType: input.goalType,
        targetWeightKg: null,
        targetTimelineDays: null,
        impactMode: null,
        adjustedForSafety: false
      };
    }

    if (input.isMinor || this.isPregnancySensitiveStatus(input.pregnancyStatus)) {
      return {
        goalType: MINOR_SAFE_GOAL_TYPE,
        targetWeightKg: null,
        targetTimelineDays: null,
        impactMode: null,
        adjustedForSafety: true
      };
    }

    if (!input.currentWeightKg || !input.targetWeightKg || !input.targetTimelineDays) {
      throw new BadRequestException(SUPPORTIVE_SAFETY_MESSAGES.missingProfileForGoal);
    }

    const weightLossKg = input.currentWeightKg - input.targetWeightKg;

    if (weightLossKg <= 0) {
      throw new BadRequestException(SUPPORTIVE_SAFETY_MESSAGES.adultExtremeWeightGoal);
    }

    const totalLossFraction = weightLossKg / input.currentWeightKg;
    const weeklyLossKg = weightLossKg / (input.targetTimelineDays / 7);

    if (
      totalLossFraction > MAX_SAFE_WEIGHT_LOSS_FRACTION ||
      weeklyLossKg > MAX_SAFE_WEIGHT_LOSS_KG_PER_WEEK
    ) {
      throw new BadRequestException(SUPPORTIVE_SAFETY_MESSAGES.adultExtremeWeightGoal);
    }

    return {
      goalType: input.goalType,
      targetWeightKg: input.targetWeightKg,
      targetTimelineDays: input.targetTimelineDays,
      impactMode: input.impactMode ?? null,
      adjustedForSafety: false
    };
  }

  validateNutritionPreferences(input: NutritionSafetyInput) {
    const blockedFoods = new Set([
      ...input.allergies.map((food) => this.normalizeFoodName(food)),
      ...input.excludedFoods.map((food) => this.normalizeFoodName(food))
    ]);

    const conflictingPreferredFood = input.preferredFoods.find((food) =>
      blockedFoods.has(this.normalizeFoodName(food))
    );

    if (conflictingPreferredFood) {
      throw new BadRequestException(SUPPORTIVE_SAFETY_MESSAGES.foodPreferenceConflict);
    }
  }

  validateTrainingScheduleItem(input: TrainingSafetyInput) {
    const maxDuration = TRAINING_DURATION_LIMITS_BY_INTENSITY[input.intensity];

    if (input.durationMinutes > maxDuration) {
      throw new BadRequestException(SUPPORTIVE_SAFETY_MESSAGES.unsafeTrainingIntensity);
    }

    if (
      input.intensity === IntensityLevel.HIGH &&
      input.description &&
      this.hasUnsafeTrainingDescription(input.description)
    ) {
      throw new BadRequestException(SUPPORTIVE_SAFETY_MESSAGES.unsafeTrainingDescription);
    }
  }

  validatePregnancySensitivePlanSafety(
    planJson: unknown,
    pregnancyStatus?: PregnancyStatus | null
  ):
    | { passed: true; reasons: [] }
    | { passed: false; reasons: string[]; matchedPath?: string; matchedText?: string } {
    if (!this.isPregnancySensitiveStatus(pregnancyStatus)) {
      return { passed: true, reasons: [] };
    }

    const unsafeMatch = this.findUnsafePregnancyPlanText(planJson);

    if (!unsafeMatch) {
      return { passed: true, reasons: [] };
    }

    return {
      passed: false,
      reasons: [SUPPORTIVE_SAFETY_MESSAGES.pregnancyPlanUnsafe],
      matchedPath: unsafeMatch.path,
      matchedText: unsafeMatch.text
    };
  }

  isPregnancySensitiveStatus(
    pregnancyStatus?: PregnancyStatus | null
  ): pregnancyStatus is PregnancySensitiveStatus {
    return (
      pregnancyStatus === PregnancyStatus.PREGNANT ||
      pregnancyStatus === PregnancyStatus.POSTPARTUM ||
      pregnancyStatus === PregnancyStatus.BREASTFEEDING
    );
  }

  validatePlanFoodSafety(
    planJson: unknown,
    blockedFoods: string[] | { allergies?: string[]; excludedFoods?: string[] }
  ):
    | { passed: true; reasons: []; conflicts: [] }
    | { passed: false; reasons: string[]; conflicts: PlanFoodSafetyConflict[] } {
    const restrictedFoods = this.normalizeRestrictedFoods(blockedFoods);

    if (restrictedFoods.length === 0) {
      return { passed: true, reasons: [], conflicts: [] };
    }

    const conflicts = this.findPlanFoodConflicts(planJson, restrictedFoods);

    if (conflicts.length === 0) {
      return { passed: true, reasons: [], conflicts: [] };
    }

    return {
      passed: false,
      reasons: [SUPPORTIVE_SAFETY_MESSAGES.planFoodConflict],
      conflicts
    };
  }

  private hasUnsafeTrainingDescription(description: string) {
    return UNSAFE_TRAINING_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(description));
  }

  private normalizeFoodName(food: string) {
    return food.trim().toLowerCase();
  }

  private normalizeRestrictedFoods(
    blockedFoods: string[] | { allergies?: string[]; excludedFoods?: string[] }
  ) {
    if (Array.isArray(blockedFoods)) {
      return blockedFoods
        .map((food) => ({
          conflictType: 'allergy' as const,
          restrictedFood: food,
          normalizedFood: this.normalizeFoodName(food)
        }))
        .filter((food) => food.normalizedFood);
    }

    return [
      ...(blockedFoods.allergies ?? []).map((food) => ({
        conflictType: 'allergy' as const,
        restrictedFood: food,
        normalizedFood: this.normalizeFoodName(food)
      })),
      ...(blockedFoods.excludedFoods ?? []).map((food) => ({
        conflictType: 'excludedFood' as const,
        restrictedFood: food,
        normalizedFood: this.normalizeFoodName(food)
      }))
    ].filter((food) => food.normalizedFood);
  }

  private findPlanFoodConflicts(
    planJson: unknown,
    restrictedFoods: Array<{
      conflictType: FoodConflictType;
      restrictedFood: string;
      normalizedFood: string;
    }>
  ) {
    const plan = this.asRecord(planJson);
    const nutrition = this.asRecord(plan.nutrition);
    const meals = Array.isArray(nutrition.meals) ? nutrition.meals : [];
    const conflicts: PlanFoodSafetyConflict[] = [];

    this.collectMealConflicts(meals, 'nutrition.meals', restrictedFoods, conflicts);

    const menuOptions = Array.isArray(nutrition.menuOptions) ? nutrition.menuOptions : [];

    menuOptions.forEach((option, optionIndex) => {
      const optionRecord = this.asRecord(option);
      const optionMeals = Array.isArray(optionRecord.meals) ? optionRecord.meals : [];

      this.collectMealConflicts(
        optionMeals,
        `nutrition.menuOptions[${optionIndex}].meals`,
        restrictedFoods,
        conflicts
      );
    });

    const reminders = Array.isArray(plan.reminders) ? plan.reminders : [];

    reminders.forEach((reminder, index) => {
      if (typeof reminder === 'string') {
        conflicts.push(
          ...this.findConflictsInText(reminder, `reminders[${index}]`, restrictedFoods, false)
        );
      }
    });

    return conflicts;
  }

  private collectMealConflicts(
    meals: unknown[],
    pathPrefix: string,
    restrictedFoods: Array<{
      conflictType: FoodConflictType;
      restrictedFood: string;
      normalizedFood: string;
    }>,
    conflicts: PlanFoodSafetyConflict[]
  ) {
    meals.forEach((meal, mealIndex) => {
      const mealRecord = this.asRecord(meal);
      const foods = Array.isArray(mealRecord.foods) ? mealRecord.foods : [];

      foods.forEach((food, foodIndex) => {
        const foodRecord = this.asRecord(food);
        const namePath = `${pathPrefix}[${mealIndex}].foods[${foodIndex}].name`;
        const notesPath = `${pathPrefix}[${mealIndex}].foods[${foodIndex}].notes`;

        if (typeof foodRecord.name === 'string') {
          conflicts.push(
            ...this.findConflictsInText(foodRecord.name, namePath, restrictedFoods, true)
          );
        }

        if (typeof foodRecord.notes === 'string') {
          conflicts.push(
            ...this.findConflictsInText(foodRecord.notes, notesPath, restrictedFoods, false)
          );
        }
      });
    });
  }

  private findConflictsInText(
    text: string,
    matchedPath: string,
    restrictedFoods: Array<{
      conflictType: FoodConflictType;
      restrictedFood: string;
      normalizedFood: string;
    }>,
    hardBlockAnyMention: boolean
  ) {
    const normalizedText = this.normalizeFoodName(text);

    return restrictedFoods.flatMap((restrictedFood) => {
      if (
        !this.foodNameConflictsWithBlockedFood(normalizedText, restrictedFood.normalizedFood)
      ) {
        return [];
      }

      const unsafeMention = hardBlockAnyMention
        ? text
        : this.getUnsafeRestrictedFoodMention(normalizedText, restrictedFood.normalizedFood);

      if (!unsafeMention) {
        return [];
      }

      return [
        {
          conflictType: restrictedFood.conflictType,
          restrictedFood: restrictedFood.restrictedFood,
          matchedFoodName: unsafeMention,
          matchedPath
        }
      ];
    });
  }

  private getUnsafeRestrictedFoodMention(text: string, restrictedFood: string) {
    const escapedRestrictedFood = restrictedFood.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const restrictedFoodPattern = new RegExp(`(^|\\b)${escapedRestrictedFood}(\\b|$)`, 'gi');
    let match: RegExpExecArray | null;

    while ((match = restrictedFoodPattern.exec(text)) !== null) {
      const matchStart = match.index + match[1].length;
      const matchEnd = matchStart + restrictedFood.length;
      const before = text.slice(Math.max(0, matchStart - 80), matchStart);
      const after = text.slice(matchEnd, Math.min(text.length, matchEnd + 40));

      if (this.isRestrictedFoodAvoidanceMention(before, after)) {
        continue;
      }

      if (this.isRestrictedFoodInclusionMention(before, after)) {
        return this.extractMentionSnippet(text, matchStart, matchEnd);
      }
    }

    return null;
  }

  private isRestrictedFoodAvoidanceMention(before: string, after: string) {
    const normalizedBefore = before.replace(/[^\w\s'-:]/g, ' ').replace(/\s+/g, ' ').trim();
    const normalizedAfter = after.replace(/\s+/g, ' ').trim();
    const avoidanceBeforePattern =
      /\b(avoid|avoids|avoiding|avoided|without|no|exclude|excludes|excluding|excluded|skip|skipping|free[-\s]?from|allergy:|allergic to)(?:\s+(?:your|listed|allergy:?)){0,4}$/i;

    return avoidanceBeforePattern.test(normalizedBefore) || /^[-\s]?free\b/i.test(normalizedAfter);
  }

  private isRestrictedFoodInclusionMention(before: string, after: string) {
    const normalizedBefore = before.replace(/[^\w\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
    const normalizedAfter = after.replace(/[^\w\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
    const inclusionBeforePattern =
      /\b(add|eat|include|serve|served|top|topped|pair|paired|mix|mixed|choose|use|using|with|alongside|combine|combined|in)(?:\s+\w+){0,5}$/i;
    const foodPhraseAfterPattern =
      /^(toast|side|topping|spread|sauce|dip|dressing|salad|bowl|as\s+a\s+side|on\s+top|in\s+the\s+meal)\b/i;

    return inclusionBeforePattern.test(normalizedBefore) || foodPhraseAfterPattern.test(normalizedAfter);
  }

  private extractMentionSnippet(text: string, matchStart: number, matchEnd: number) {
    return text
      .slice(Math.max(0, matchStart - 35), Math.min(text.length, matchEnd + 35))
      .replace(/\s+/g, ' ')
      .trim();
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private findUnsafePregnancyPlanText(planJson: unknown) {
    const plan = this.asRecord(planJson);
    const checks: Array<{ path: string; value: unknown }> = [
      { path: 'summary.message', value: this.asRecord(plan.summary).message },
      { path: 'nutrition.calorieGuidance.notes', value: this.asRecord(this.asRecord(plan.nutrition).calorieGuidance).notes },
      { path: 'nutrition.macroGuidance.notes', value: this.asRecord(this.asRecord(plan.nutrition).macroGuidance).notes },
      { path: 'training.recommendation', value: this.asRecord(plan.training).recommendation },
      { path: 'training.notes', value: this.asRecord(plan.training).notes },
      { path: 'recovery.recommendation', value: this.asRecord(plan.recovery).recommendation }
    ];

    const reminders = Array.isArray(plan.reminders) ? plan.reminders : [];
    reminders.forEach((reminder, index) => {
      checks.push({ path: `reminders[${index}]`, value: reminder });
    });

    for (const check of checks) {
      if (typeof check.value !== 'string') {
        continue;
      }

      if (this.hasUnsafePregnancySensitiveLanguage(check.value)) {
        return { path: check.path, text: this.extractSafeSnippet(check.value) };
      }
    }

    return null;
  }

  private hasUnsafePregnancySensitiveLanguage(text: string) {
    const unsafePatterns = [
      /\b(extreme|aggressive|very low|severe)\s+(calorie|caloric|deficit|restriction|diet)/i,
      /\b(starv(?:e|ing|ation)|skip meals?|detox|cleanse)\b/i,
      /\b(push through|train through|work through)\s+(pain|exhaustion|dizziness|illness|injury|fatigue)\b/i,
      /\b(high[-\s]?intensity|hard|all[-\s]?out|max effort|maximum effort)\b.*\b(pregnan\w*|postpartum|breastfeeding|nursing)\b/i,
      /\b(pregnan\w*|postpartum|breastfeeding|nursing)\b.*\b(high[-\s]?intensity|all[-\s]?out|max effort|maximum effort)\b/i,
      /\bdiagnos(?:e|is|ed)\b/i
    ];

    return unsafePatterns.some((pattern) => pattern.test(text));
  }

  private extractSafeSnippet(text: string) {
    return text.replace(/\s+/g, ' ').trim().slice(0, 140);
  }

  private foodNameConflictsWithBlockedFood(foodName: string, blockedFood: string) {
    if (!foodName || !blockedFood) {
      return false;
    }

    if (foodName === blockedFood) {
      return true;
    }

    const escapedBlockedFood = blockedFood.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|\\b)${escapedBlockedFood}(\\b|$)`, 'i').test(foodName);
  }
}
