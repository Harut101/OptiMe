import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  PlanStatus,
  ProgressiveProfilePromptKey
} from '@prisma/client';

import type { AiProvider } from '../ai/ai-provider.interface';
import { AI_PROVIDER } from '../ai/ai-provider.token';
import { OpenAiProviderError } from '../ai/open-ai-provider.error';
import { NutritionAgentService } from '../nutrition-agent/nutrition-agent.service';
import { NutritionTargetsService } from '../nutrition-targets/nutrition-targets.service';
import { createSafeFallbackPlan } from '../safety/safe-fallback-plan.factory';
import type {
  DailyPlanAgentExecution,
  GenerateDailyFoodPlanInput,
  GenerateProviderDailyPlanInput
} from './daily-plan-agent-execution.interface';

@Injectable()
export class DailyPlanAgentExecutionService
  implements DailyPlanAgentExecution
{
  private readonly logger = new Logger(
    DailyPlanAgentExecutionService.name
  );

  constructor(
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
    private readonly nutritionAgent: NutritionAgentService,
    private readonly nutritionTargetsService: NutritionTargetsService
  ) {}

  getProviderName(): 'mock' | 'openai' {
    return this.aiProvider.constructor?.name ===
      'OpenAiProviderService'
      ? 'openai'
      : 'mock';
  }

  async generateProviderPlan(
    input: GenerateProviderDailyPlanInput
  ) {
    try {
      this.logger.log(`provider called: ${this.getProviderName()}`);
      const planJson = await this.aiProvider.generateDailyPlan({
        user: {
          id: input.user.id,
          firstName: input.user.firstName,
          timezone: input.user.timezone,
          isMinor: input.user.isMinor,
          safeMode: input.user.safeMode
        },
        profile: input.user.profile,
        goal: input.user.goal,
        nutritionPreference: input.user.nutritionPref
          ? {
              dietType: input.user.nutritionPref.dietType,
              mealsPerDay: input.user.nutritionPref.mealsPerDay,
              notes: input.user.nutritionPref.notes,
              allergies: input.user.nutritionPref.allergies.map(
                (food) => food.name
              ),
              excludedFoods:
                input.user.nutritionPref.excludedFoods.map(
                  (food) => food.name
                ),
              dislikedFoods:
                input.user.nutritionPref.dislikedFoods.map(
                  (food) => food.name
                ),
              preferredFoods:
                input.user.nutritionPref.preferredFoods.map(
                  (food) => food.name
                )
            }
          : null,
        trainingSchedule: input.user.schedules,
        safeMode: input.user.safeMode,
        locale: input.locale,
        planLocalDate: input.planLocalDate,
        planTimezone: input.planTimezone,
        planQualityMode: input.planQualityMode,
        personalizationContext: input.personalizationContext,
        exerciseSelection: {
          candidates: input.exerciseSelection.candidates.map(
            ({
              internalScore: _score,
              internalReasonCodes: _reasons,
              contraindicationTags: _tags,
              exerciseUpdatedAt: _updatedAt,
              ...candidate
            }) => candidate
          ),
          requestedExerciseCount:
            input.exerciseSelection.requestedExerciseCount,
          minExerciseCount:
            input.exerciseSelection.minExerciseCount,
          maxExerciseCount:
            input.exerciseSelection.maxExerciseCount,
          workoutDurationMinutes:
            input.exerciseSelection.workoutDurationMinutes,
          volumePlan: input.exerciseSelection.volumePlan
        },
        exerciseFeedback: input.exerciseFeedback,
        safetyFeedback: input.safetyFeedback
      });

      return { status: PlanStatus.READY, planJson };
    } catch (error) {
      if (!(error instanceof OpenAiProviderError)) throw error;

      this.logger.warn(
        `fallback used: true; fallback reason=${error.fallbackReason}`
      );
      return {
        status: PlanStatus.FALLBACK,
        planJson: createSafeFallbackPlan({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          locale: input.locale,
          reasons: [error.fallbackReason]
        })
      };
    }
  }

  async generateFoodPlan(
    input: GenerateDailyFoodPlanInput
  ) {
    const result = await this.nutritionAgent.generateDailyFoodPlan({
      planLocalDate: input.planLocalDate,
      locale: input.locale,
      planQualityMode: input.planQualityMode,
      appMode: input.appMode,
      safeMode: input.user.safeMode,
      isMinor: input.user.isMinor,
      pregnancyStatus: input.user.profile?.pregnancyStatus,
      nutritionTarget: input.nutritionTarget,
      nutritionTargetSnapshot:
        this.nutritionTargetsService.toSnapshot(input.nutritionTarget),
      nutritionPreference: this.toNutritionPreference(input.user),
      goalSummary: input.user.goal
        ? {
            primaryGoal: input.user.goal.primaryGoal,
            goalType: input.user.goal.goalType
          }
        : null,
      foodAdherenceSummary:
        input.personalizationContext.foodAdherenceSummary,
      mealPracticalityPreference:
        this.toMealPracticalityPreference(input.user),
      mealTimingPreference: this.toMealTimingPreference(input.user),
      availableFoodSlugs: input.availableFoodSlugs,
      resolvedTrainingDay: input.resolvedTrainingDay
    });

    return result.foodPlan;
  }

  private toNutritionPreference(
    user: GenerateDailyFoodPlanInput['user']
  ) {
    return user.nutritionPref
      ? {
          dietType: user.nutritionPref.dietType,
          mealsPerDay: user.nutritionPref.mealsPerDay,
          notes: user.nutritionPref.notes,
          allergies: user.nutritionPref.allergies.map(
            (food) => food.name
          ),
          excludedFoods: user.nutritionPref.excludedFoods.map(
            (food) => food.name
          ),
          dislikedFoods: user.nutritionPref.dislikedFoods.map(
            (food) => food.name
          ),
          preferredFoods: user.nutritionPref.preferredFoods.map(
            (food) => food.name
          )
        }
      : null;
  }

  private toMealPracticalityPreference(
    user: GenerateDailyFoodPlanInput['user']
  ): {
    cookingTime: 'VERY_QUICK' | 'FIFTEEN_TO_THIRTY' | 'LONGER';
  } | undefined {
    const answer = user.progressiveProfilePrompts.find(
      (prompt) =>
        prompt.promptKey ===
        ProgressiveProfilePromptKey.COOKING_TIME
    )?.answerJson;

    return answer === 'VERY_QUICK' ||
      answer === 'FIFTEEN_TO_THIRTY' ||
      answer === 'LONGER'
      ? { cookingTime: answer }
      : undefined;
  }

  private toMealTimingPreference(
    user: GenerateDailyFoodPlanInput['user']
  ):
    | 'EARLIER'
    | 'EVENLY_SPACED'
    | 'LATER'
    | 'FLEXIBLE'
    | undefined {
    const answer = user.progressiveProfilePrompts.find(
      (prompt) =>
        prompt.promptKey ===
        ProgressiveProfilePromptKey.MEAL_TIMING
    )?.answerJson;

    return answer === 'EARLIER' ||
      answer === 'EVENLY_SPACED' ||
      answer === 'LATER' ||
      answer === 'FLEXIBLE'
      ? answer
      : undefined;
  }
}
