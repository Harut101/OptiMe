import { Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DailyReadinessLevel, PlanStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AiProvider } from '../ai/ai-provider.interface';
import { AI_PROVIDER } from '../ai/ai-provider.token';
import { OpenAiProviderError } from '../ai/open-ai-provider.error';
import { createSafeFallbackPlan } from '../safety/safe-fallback-plan.factory';
import { SafetyService } from '../safety/safety.service';
import { SafetyAgent, ReviewDailyPlanInput } from '../safety-agent/safety-agent.interface';
import { SafetyAgentError } from '../safety-agent/safety-agent.error';
import { safetyAgentReviewSchema } from '../safety-agent/safety-agent-review.schema';
import {
  SAFETY_AGENT,
  SAFETY_AGENT_CONFIG,
  SafetyAgentConfig
} from '../safety-agent/safety-agent.token';
import { normalizeDailyPlanFoodNames } from './daily-plan-food-name-normalizer';
import { DailyPlanJson, dailyPlanJsonSchema } from './daily-plan-json.schema';
import { normalizeDailyPlanJson } from './daily-plan-normalizer';
import { GenerateDailyPlanDto } from './dto/generate-daily-plan.dto';
import { SubmitDailyPlanFeedbackDto } from './dto/submit-daily-plan-feedback.dto';

@Injectable()
export class DailyPlansService {
  private readonly logger = new Logger(DailyPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly safetyService: SafetyService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
    @Inject(SAFETY_AGENT) private readonly safetyAgent: SafetyAgent,
    @Inject(SAFETY_AGENT_CONFIG) private readonly safetyAgentConfig: SafetyAgentConfig
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

    const existingPlan = await this.prisma.dailyPlan.findUnique({
      where: {
        userId_planLocalDate_planTimezone: {
          userId,
          planLocalDate,
          planTimezone
        }
      }
    });

    if (existingPlan && !dto.forceRegenerate) {
      return this.toResponse(existingPlan);
    }

    this.logger.log(`daily plan generation started; provider=${this.getProviderDebugName()}`);
    const blockedFoods = {
      allergies: user.nutritionPref?.allergies.map((food) => food.name) ?? [],
      excludedFoods: user.nutritionPref?.excludedFoods.map((food) => food.name) ?? []
    };
    const providerPlanResult = await this.generateProviderPlanOrFallback({
      user,
      planLocalDate,
      planTimezone
    });
    const safePlanResult = await this.validateProviderPlan({
      providerPlan: providerPlanResult.planJson,
      blockedFoods,
      planLocalDate,
      planTimezone,
      user,
      forcedFallback: providerPlanResult.status === PlanStatus.FALLBACK
    });
    const planJson = safePlanResult.planJson as Prisma.JsonObject;
    const status = safePlanResult.status;
    this.logger.log(
      `daily plan generation completed; fallback used: ${status === PlanStatus.FALLBACK}; final status=${status}`
    );

    const plan = existingPlan
      ? await this.prisma.dailyPlan.update({
          where: { id: existingPlan.id },
          data: {
            status,
            readinessLevel: DailyReadinessLevel.MAINTAIN,
            planJson,
            createdByAi: false
          }
        })
      : await this.prisma.dailyPlan.create({
          data: {
            userId,
            planLocalDate,
            planTimezone,
            status,
            readinessLevel: DailyReadinessLevel.MAINTAIN,
            planJson,
            createdByAi: false
          }
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
      select: {
        id: true,
        firstName: true,
        timezone: true,
        isMinor: true,
        safeMode: true,
        profile: {
          select: {
            gender: true,
            dateOfBirth: true,
            heightCm: true,
            weightKg: true,
            activityLevel: true
          }
        },
        goal: {
          select: {
            goalType: true,
            targetWeightKg: true,
            targetTimelineDays: true,
            impactMode: true
          }
        },
        nutritionPref: {
          select: {
            dietType: true,
            mealsPerDay: true,
            notes: true,
            allergies: {
              select: { name: true }
            },
            excludedFoods: {
              select: { name: true }
            },
            preferredFoods: {
              select: { name: true }
            }
          }
        },
        schedules: {
          select: {
            dayOfWeek: true,
            localTime: true,
            sportType: true,
            durationMinutes: true,
            intensity: true,
            description: true
          },
          orderBy: [{ dayOfWeek: 'asc' }, { localTime: 'asc' }]
        }
      }
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

  private async generateProviderPlanOrFallback(input: {
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>;
    planLocalDate: string;
    planTimezone: string;
  }) {
    try {
      this.logger.log(`provider called: ${this.getProviderDebugName()}`);
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
              allergies: input.user.nutritionPref.allergies.map((food) => food.name),
              excludedFoods: input.user.nutritionPref.excludedFoods.map((food) => food.name),
              preferredFoods: input.user.nutritionPref.preferredFoods.map((food) => food.name)
            }
          : null,
        trainingSchedule: input.user.schedules,
        safeMode: input.user.safeMode,
        planLocalDate: input.planLocalDate,
        planTimezone: input.planTimezone
      });

      return {
        status: PlanStatus.READY,
        planJson
      };
    } catch (error) {
      if (error instanceof OpenAiProviderError) {
        this.logger.warn(`fallback used: true; fallback reason=${error.fallbackReason}`);
        return {
          status: PlanStatus.FALLBACK,
          planJson: createSafeFallbackPlan({
            planLocalDate: input.planLocalDate,
            planTimezone: input.planTimezone,
            reasons: [error.fallbackReason]
          })
        };
      }

      throw error;
    }
  }

  private validateProviderPlan(input: {
    providerPlan: unknown;
    blockedFoods: { allergies: string[]; excludedFoods: string[] };
    planLocalDate: string;
    planTimezone: string;
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>;
    forcedFallback?: boolean;
  }) {
    const parsedPlan = dailyPlanJsonSchema.safeParse(input.providerPlan);

    if (!parsedPlan.success) {
      this.logger.warn('schema validation passed: false; fallback used: true');
      return {
        status: PlanStatus.FALLBACK,
        planJson: createSafeFallbackPlan({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          reasons: ['The generated plan could not be safely validated.']
        })
      };
    }

    const normalizedFoodNames = normalizeDailyPlanFoodNames(parsedPlan.data, input.blockedFoods);

    normalizedFoodNames.normalizedPaths.forEach((path) => {
      this.logger.log(`Food name normalized: path=${path}`);
    });

    const planSafety = this.safetyService.validatePlanFoodSafety(
      normalizedFoodNames.planJson,
      input.blockedFoods
    );

    if (!planSafety.passed) {
      const firstConflict = planSafety.conflicts[0];
      this.logger.warn(
        [
          'SafetyService failed',
          firstConflict
            ? `${firstConflict.conflictType} conflict at ${firstConflict.matchedPath}; restrictedFood=${firstConflict.restrictedFood}; matchedFoodName=${firstConflict.matchedFoodName ?? 'unknown'}`
            : `fallback reason=${planSafety.reasons.join(' | ')}`
        ].join(': ')
      );
      return {
        status: PlanStatus.FALLBACK,
        planJson: createSafeFallbackPlan({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          reasons: planSafety.reasons
        })
      };
    }

    this.logger.log('schema validation passed: true');
    this.logger.log('SafetyService passed: true');

    if (input.forcedFallback) {
      return {
        status: PlanStatus.FALLBACK,
        planJson: normalizedFoodNames.planJson
      };
    }

    return this.reviewPlanWithSafetyAgent({
      planJson: normalizedFoodNames.planJson,
      user: input.user,
      blockedFoods: input.blockedFoods,
      planLocalDate: input.planLocalDate,
      planTimezone: input.planTimezone
    });
  }

  private async reviewPlanWithSafetyAgent(input: {
    planJson: DailyPlanJson;
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>;
    blockedFoods: { allergies: string[]; excludedFoods: string[] };
    planLocalDate: string;
    planTimezone: string;
  }) {
    this.logger.log(
      `SafetyAgent enabled=${this.safetyAgentConfig.enabled}; provider=${this.safetyAgentConfig.provider}`
    );

    if (!this.safetyAgentConfig.enabled) {
      return {
        status: PlanStatus.READY,
        planJson: input.planJson
      };
    }

    try {
      const review = await this.safetyAgent.reviewDailyPlan(
        this.buildSafetyAgentReviewInput(input)
      );
      const parsedReview = safetyAgentReviewSchema.safeParse(review);

      if (!parsedReview.success) {
        this.logger.warn(
          `SafetyAgent review invalid; provider=${this.safetyAgentConfig.provider}; fallback reason=safety_agent_invalid_review`
        );
        return this.createSafetyAgentFallback({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          fallbackReason: 'safety_agent_invalid_review'
        });
      }

      this.logger.log(
        [
          'SafetyAgent review completed',
          `provider=${this.safetyAgentConfig.provider}`,
          `approved=${parsedReview.data.approved}`,
          `riskLevel=${parsedReview.data.riskLevel}`,
          `reasonCount=${parsedReview.data.reasons.length}`
        ].join('; ')
      );

      if (!parsedReview.data.approved) {
        this.logger.warn('fallback used: true; fallback reason=safety_agent_rejected');
        return this.createSafetyAgentFallback({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          fallbackReason: 'safety_agent_rejected',
          approved: false,
          riskLevel: parsedReview.data.riskLevel
        });
      }

      return {
        status: PlanStatus.READY,
        planJson: this.withSafetyAgentDebug(input.planJson, {
          approved: true,
          riskLevel: parsedReview.data.riskLevel
        })
      };
    } catch (error) {
      if (error instanceof SafetyAgentError) {
        this.logger.warn(
          `SafetyAgent failed; provider=${this.safetyAgentConfig.provider}; fallback reason=${error.fallbackReason}`
        );
        return this.createSafetyAgentFallback({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          fallbackReason: error.fallbackReason
        });
      }

      this.logger.warn('SafetyAgent unavailable; fallback reason=safety_agent_unavailable');
      return this.createSafetyAgentFallback({
        planLocalDate: input.planLocalDate,
        planTimezone: input.planTimezone,
        fallbackReason: 'safety_agent_unavailable'
      });
    }
  }

  private buildSafetyAgentReviewInput(input: {
    planJson: DailyPlanJson;
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>;
    blockedFoods: { allergies: string[]; excludedFoods: string[] };
  }): ReviewDailyPlanInput {
    return {
      plan: input.planJson,
      safeMode: input.user.safeMode,
      goalSummary: input.user.goal
        ? {
            goalType: input.user.goal.goalType,
            targetWeightKg: input.user.goal.targetWeightKg,
            targetTimelineDays: input.user.goal.targetTimelineDays,
            impactMode: input.user.goal.impactMode
          }
        : null,
      deterministicSafetyContext: {
        safeMode: input.user.safeMode,
        isMinor: input.user.isMinor,
        allergies: input.blockedFoods.allergies,
        excludedFoods: input.blockedFoods.excludedFoods,
        deterministicSafetyPassed: true
      }
    };
  }

  private createSafetyAgentFallback(input: {
    planLocalDate: string;
    planTimezone: string;
    fallbackReason: string;
    approved?: boolean;
    riskLevel?: 'low' | 'medium' | 'high';
  }) {
    return {
      status: PlanStatus.FALLBACK,
      planJson: this.withSafetyAgentDebug(
        createSafeFallbackPlan({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          reasons: [input.fallbackReason]
        }),
        {
          approved: input.approved,
          riskLevel: input.riskLevel
        }
      )
    };
  }

  private withSafetyAgentDebug(
    planJson: DailyPlanJson,
    review?: {
      approved?: boolean;
      riskLevel?: 'low' | 'medium' | 'high';
    }
  ): DailyPlanJson {
    if (!planJson.debug) {
      return planJson;
    }

    const safetyAgentDebug = {
      enabled: this.safetyAgentConfig.enabled,
      provider: this.safetyAgentConfig.provider,
      ...(review?.approved !== undefined ? { approved: review.approved } : {}),
      ...(review?.riskLevel !== undefined ? { riskLevel: review.riskLevel } : {})
    };

    return {
      ...planJson,
      debug: {
        provider: planJson.debug.provider,
        generatedBy: planJson.debug.generatedBy,
        ...(planJson.debug.fallbackReason ? { fallbackReason: planJson.debug.fallbackReason } : {}),
        safetyAgent: safetyAgentDebug
      }
    };
  }

  private getProviderDebugName() {
    return this.aiProvider.constructor?.name === 'OpenAiProviderService' ? 'openai' : 'mock';
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
