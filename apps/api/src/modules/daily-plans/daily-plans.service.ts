import {
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import {
  Prisma,
  PreferredLocale
} from '@prisma/client';
import {
  resolveSupportedLocale,
  type SupportedLocale
} from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { DailyPlanFoodIngredientUseCaseService } from '../daily-plan-orchestrator/daily-plan-food-ingredient-use-case.service';
import { DailyPlanFoodRegenerationUseCaseService } from '../daily-plan-orchestrator/daily-plan-food-regeneration-use-case.service';
import { DailyPlanGenerationUseCaseService } from '../daily-plan-orchestrator/daily-plan-generation-use-case.service';
import { DailyPlanTrainingAdjustmentUseCaseService } from '../daily-plan-orchestrator/daily-plan-training-adjustment-use-case.service';
import { dailyPlanPlanningUserSelect } from '../daily-plan-orchestrator/daily-plan-planning-user';
import { normalizeDailyPlanJson } from './daily-plan-normalizer';
import { GenerateDailyPlanDto } from './dto/generate-daily-plan.dto';
import { ExcludeFoodIngredientDto } from './dto/exclude-food-ingredient.dto';
import { ApplyFoodIngredientSwapDto } from './dto/apply-food-ingredient-swap.dto';
import { RegenerateFoodPlanDto } from './dto/regenerate-food-plan.dto';
import { AdjustTrainingForPreWorkoutDto } from './dto/adjust-training-for-pre-workout.dto';
import {
  ApplyTrainingReplacementsDto,
  TrainingReplacementProposalsDto
} from './dto/training-replacement-proposals.dto';
import { SubmitDailyPlanFeedbackDto } from './dto/submit-daily-plan-feedback.dto';

@Injectable()
export class DailyPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generationUseCase: DailyPlanGenerationUseCaseService,
    private readonly foodIngredientUseCase: DailyPlanFoodIngredientUseCaseService,
    private readonly foodRegenerationUseCase: DailyPlanFoodRegenerationUseCaseService,
    private readonly trainingAdjustmentUseCase: DailyPlanTrainingAdjustmentUseCaseService
  ) {}

  async getTodayPlan(userId: string) {
    const user = await this.getPlanningUser(userId);
    const { planLocalDate, planTimezone } = this.getLocalPlanDate(user.timezone);

    const plan = await this.prisma.dailyPlan.findUnique({
      where: {
        userId_planLocalDate_planTimezone: {
          userId,
          planLocalDate,
          planTimezone
        }
      }
    });

    return plan ? this.toResponse(plan) : null;
  }

  async getHistory(userId: string, limit?: string) {
    const take = this.normalizeHistoryLimit(limit);
    const plans = await this.prisma.dailyPlan.findMany({
      where: { userId },
      orderBy: [{ planLocalDate: 'desc' }, { updatedAt: 'desc' }],
      take
    });

    return {
      items: plans.map((plan) => this.toResponse(plan))
    };
  }

  async generateTodayPlan(userId: string, dto: GenerateDailyPlanDto) {
    const user = await this.getPlanningUser(userId);
    const { planLocalDate, planTimezone } = this.getLocalPlanDate(user.timezone);
    const targetLocale = this.resolvePlanningLocale(user);

    const existingPlan = await this.prisma.dailyPlan.findUnique({
      where: {
        userId_planLocalDate_planTimezone: {
          userId,
          planLocalDate,
          planTimezone
        }
      }
    });

    const plan = await this.generationUseCase.generate({
      userId,
      user,
      existingPlan,
      planLocalDate,
      planTimezone,
      locale: targetLocale,
      forceRegenerate: Boolean(dto.forceRegenerate),
      recreateForCurrentLanguage: Boolean(
        dto.recreateForCurrentLanguage
      )
    });

    return this.toResponse(plan);
  }

  async regenerateFoodPlan(userId: string, dailyPlanId: string, dto: RegenerateFoodPlanDto) {
    const plan = await this.foodRegenerationUseCase.regenerateMenu({
      userId,
      dailyPlanId,
      reason: dto.reason
    });

    return this.toResponse(plan);
  }

  async getFoodIngredientSwapSuggestions(
    userId: string,
    dailyPlanId: string,
    mealId: string,
    ingredientSlug: string
  ) {
    return this.foodIngredientUseCase.getSwapSuggestions({
      userId,
      dailyPlanId,
      mealId,
      ingredientSlug
    });
  }

  async applyFoodIngredientSwap(
    userId: string,
    dailyPlanId: string,
    mealId: string,
    ingredientSlug: string,
    dto: ApplyFoodIngredientSwapDto
  ) {
    const plan = await this.foodIngredientUseCase.applySwap({
      userId,
      dailyPlanId,
      mealId,
      ingredientSlug,
      replacementCatalogFoodSlug:
        dto.replacementCatalogFoodSlug
    });

    return this.toResponse(plan);
  }

  async regenerateFoodMeal(
    userId: string,
    dailyPlanId: string,
    mealId: string,
    dto: RegenerateFoodPlanDto
  ) {
    const plan = await this.foodRegenerationUseCase.regenerateMeal({
      userId,
      dailyPlanId,
      mealId,
      reason: dto.reason
    });

    return this.toResponse(plan);
  }

  async excludeFoodIngredient(userId: string, dailyPlanId: string, dto: ExcludeFoodIngredientDto) {
    return this.foodIngredientUseCase.excludeIngredient({
      userId,
      dailyPlanId,
      ingredientName: dto.ingredientName
    });
  }

  async adjustTrainingForPreWorkout(userId: string, dailyPlanId: string, dto: AdjustTrainingForPreWorkoutDto) {
    const plan =
      await this.trainingAdjustmentUseCase.adjustForPreWorkout({
        userId,
        dailyPlanId,
        preWorkoutCheck: dto.preWorkoutCheck
      });

    return this.toResponse(plan);
  }

  async getTrainingReplacementProposals(
    userId: string,
    dailyPlanId: string,
    dto: TrainingReplacementProposalsDto
  ) {
    return this.trainingAdjustmentUseCase.getReplacementProposals({
      userId,
      dailyPlanId,
      preWorkoutCheck: dto.preWorkoutCheck,
      conflictingExerciseKeys: dto.conflictingExerciseKeys
    });
  }

  async applyTrainingReplacements(
    userId: string,
    dailyPlanId: string,
    dto: ApplyTrainingReplacementsDto
  ) {
    const plan =
      await this.trainingAdjustmentUseCase.applyReplacements({
        userId,
        dailyPlanId,
        preWorkoutCheck: dto.preWorkoutCheck,
        conflictingExerciseKeys:
          dto.conflictingExerciseKeys,
        acceptedOriginalPlanExerciseKeys:
          dto.acceptedOriginalPlanExerciseKeys
      });

    return this.toResponse(plan);
  }

  async submitFeedback(userId: string, dailyPlanId: string, dto: SubmitDailyPlanFeedbackDto) {
    const plan = await this.prisma.dailyPlan.findFirst({
      where: {
        id: dailyPlanId,
        userId
      },
      select: { id: true }
    });

    if (!plan) {
      throw new NotFoundException('Daily plan not found.');
    }

    const feedback = await this.prisma.dailyPlanFeedback.upsert({
      where: {
        userId_dailyPlanId: {
          userId,
          dailyPlanId
        }
      },
      update: {
        rating: dto.rating,
        tags: dto.tags ?? [],
        notes: dto.notes?.trim() || null
      },
      create: {
        userId,
        dailyPlanId,
        rating: dto.rating,
        tags: dto.tags ?? [],
        notes: dto.notes?.trim() || null
      }
    });

    return {
      id: feedback.id,
      dailyPlanId: feedback.dailyPlanId,
      rating: feedback.rating,
      tags: feedback.tags,
      notes: feedback.notes,
      createdAt: feedback.createdAt.toISOString(),
      updatedAt: feedback.updatedAt.toISOString()
    };
  }

  private async getPlanningUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: dailyPlanPlanningUserSelect
    });

    if (!user) {
      throw new UnauthorizedException('Your session is no longer valid. Please log in again.');
    }

    return user;
  }

  private getLocalPlanDate(timezone: string) {
    const safeTimezone = this.normalizeTimezone(timezone);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return {
      planLocalDate: `${year}-${month}-${day}`,
      planTimezone: safeTimezone
    };
  }

  private normalizeTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
      return timezone;
    } catch {
      return 'UTC';
    }
  }

  private normalizeHistoryLimit(limit?: string) {
    const parsedLimit = Number(limit);

    if (!Number.isFinite(parsedLimit)) {
      return 10;
    }

    return Math.min(Math.max(Math.trunc(parsedLimit), 1), 30);
  }

  private resolvePlanningLocale(user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>): SupportedLocale {
    switch (user.settings?.preferredLocale) {
      case PreferredLocale.RU_RU: return 'ru-RU';
      case PreferredLocale.FR_FR: return 'fr-FR';
      case PreferredLocale.ZH_CN: return 'zh-CN';
      case PreferredLocale.EN_US: return 'en-US';
      default: return resolveSupportedLocale(user.locale);
    }
  }

  private toResponse(plan: {
    id: string;
    status: string;
    readinessLevel: string;
    planLocalDate: string;
    planTimezone: string;
    planJson: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const normalizedPlan = normalizeDailyPlanJson({
      planJson: plan.planJson,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      readinessLevel: plan.readinessLevel
    });

    return {
      id: plan.id,
      status: plan.status,
      readinessLevel: plan.readinessLevel,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      plan: normalizedPlan,
      updatedAt: plan.updatedAt.toISOString()
    };
  }
}
