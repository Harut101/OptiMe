import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiOperationFeature,
  AiOperationProvider,
  AiOperationStatus,
  DailyReadinessLevel,
  PlanFeedbackRating,
  PlanQualityMode,
  PlanStatus,
  Prisma,
  UsageFeature,
  UsagePeriodType
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AiOperationLogsService } from '../ai-operation-logs/ai-operation-logs.service';
import {
  AiProvider,
  GenerateDailyPlanPersonalizationContext,
  GenerateDailyPlanSafetyFeedback
} from '../ai/ai-provider.interface';
import { AI_PROVIDER } from '../ai/ai-provider.token';
import { OpenAiProviderError } from '../ai/open-ai-provider.error';
import { FeatureAccessService } from '../entitlements/feature-access.service';
import { OnboardingService } from '../onboarding/onboarding.service';
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
import { UsageGuardService } from '../usage/usage-guard.service';
import { normalizeDailyPlanFoodNames } from './daily-plan-food-name-normalizer';
import { DailyPlanJson, dailyPlanJsonSchema } from './daily-plan-json.schema';
import { normalizeDailyPlanJson } from './daily-plan-normalizer';
import { GenerateDailyPlanDto } from './dto/generate-daily-plan.dto';
import { SubmitDailyPlanFeedbackDto } from './dto/submit-daily-plan-feedback.dto';

interface DailyPlanValidationResult {
  status: PlanStatus;
  planJson: DailyPlanJson;
  safetyRetryRequest?: GenerateDailyPlanSafetyFeedback;
}

@Injectable()
export class DailyPlansService {
  private readonly logger = new Logger(DailyPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly safetyService: SafetyService,
    private readonly aiOperationLogs: AiOperationLogsService,
    private readonly featureAccessService: FeatureAccessService,
    private readonly usageGuardService: UsageGuardService,
    private readonly onboardingService: OnboardingService,
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

    this.assertReadyToGenerate(user);
    await this.consumeDailyPlanUsage(userId, Boolean(existingPlan && dto.forceRegenerate));

    const operationStartedAt = Date.now();

    try {
      this.logger.log(`daily plan generation started; provider=${this.getProviderDebugName()}`);
      const planQualityMode = await this.featureAccessService.getPlanQualityMode(userId);
      const personalizationContext = await this.buildPersonalizationContext(userId, planQualityMode);
      const blockedFoods = {
        allergies: user.nutritionPref?.allergies.map((food) => food.name) ?? [],
        excludedFoods: user.nutritionPref?.excludedFoods.map((food) => food.name) ?? []
      };
      const providerPlanResult = await this.generateProviderPlanOrFallback({
        user,
        planLocalDate,
        planTimezone,
        planQualityMode,
        personalizationContext
      });
      let safePlanResult = await this.validateProviderPlan({
        providerPlan: providerPlanResult.planJson,
        blockedFoods,
        planLocalDate,
        planTimezone,
        user,
        forcedFallback: providerPlanResult.status === PlanStatus.FALLBACK,
        allowSafetyRetry: this.canUseSafetyFeedbackRetry(providerPlanResult.status)
      });

      if (safePlanResult.safetyRetryRequest) {
        this.logger.log(
          `safety retry triggered=true; reasonCount=${safePlanResult.safetyRetryRequest.reasons.length}`
        );
        this.logger.log('safety retry generation started');
        const retryProviderPlanResult = await this.generateProviderPlanOrFallback({
          user,
          planLocalDate,
          planTimezone,
          planQualityMode,
          personalizationContext,
          safetyFeedback: safePlanResult.safetyRetryRequest
        });

        safePlanResult = await this.validateProviderPlan({
          providerPlan: retryProviderPlanResult.planJson,
          blockedFoods,
          planLocalDate,
          planTimezone,
          user,
          forcedFallback: retryProviderPlanResult.status === PlanStatus.FALLBACK,
          allowSafetyRetry: false,
          safetyRetryUsed: true
        });

        if (retryProviderPlanResult.status === PlanStatus.FALLBACK) {
          const retryFallbackReason =
            this.getFallbackReason(retryProviderPlanResult.planJson) === 'schema_validation_failed'
              ? 'safety_agent_retry_invalid_output'
              : 'safety_agent_retry_failed';
          safePlanResult = {
            status: PlanStatus.FALLBACK,
            planJson: this.createSafetyAgentFallback({
              planLocalDate,
              planTimezone,
              fallbackReason: retryFallbackReason,
              retryUsed: true,
              retryResult: 'failed'
            }).planJson
          };
        }
      } else {
        this.logger.log('safety retry triggered=false');
      }
      safePlanResult = {
        ...safePlanResult,
        planJson: this.withPlanQualityModeDebug(safePlanResult.planJson, planQualityMode)
      };
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

      await this.recordDailyPlanAiOperation({
        userId,
        status,
        planJson: safePlanResult.planJson,
        latencyMs: Date.now() - operationStartedAt
      });

      return this.toResponse(plan);
    } catch (error) {
      await this.recordDailyPlanAiOperationError({
        userId,
        latencyMs: Date.now() - operationStartedAt,
        error
      });
      throw error;
    }
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
        noTrainingPlanned: true,
        privacyConsentedAt: true,
        profile: {
          select: {
            gender: true,
            pregnancyStatus: true,
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
            noKnownAllergiesConfirmed: true,
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

  private assertReadyToGenerate(user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>) {
    const readiness = this.onboardingService.evaluateStage1Readiness(user);

    if (!readiness.canGenerateFirstPlan) {
      throw new BadRequestException({
        message: 'Please complete the required onboarding basics before generating a daily plan.',
        code: 'ONBOARDING_STAGE_1_INCOMPLETE',
        missingStage1Fields: readiness.missingStage1Fields
      });
    }
  }

  private async consumeDailyPlanUsage(userId: string, isRefresh: boolean) {
    const productFeature = isRefresh
      ? UsageFeature.DAILY_PLAN_REFRESH
      : UsageFeature.DAILY_PLAN_GENERATION;
    const usageChecks: Array<{ feature: UsageFeature; periodType: UsagePeriodType }> = [
      {
        feature: productFeature,
        periodType: UsagePeriodType.DAILY
      }
    ];

    if (this.getProviderDebugName() === 'openai') {
      usageChecks.push({
        feature: UsageFeature.AI_DAILY_PLAN_GENERATION,
        periodType: UsagePeriodType.DAILY
      });
    }

    await Promise.all(
      usageChecks.map((check) =>
        this.usageGuardService.assertCanUse(userId, check.feature, check.periodType)
      )
    );

    for (const check of usageChecks) {
      await this.usageGuardService.checkAndConsume(userId, check.feature, check.periodType);
    }
  }

  private async generateProviderPlanOrFallback(input: {
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>;
    planLocalDate: string;
    planTimezone: string;
    planQualityMode: PlanQualityMode;
    personalizationContext: GenerateDailyPlanPersonalizationContext;
    safetyFeedback?: GenerateDailyPlanSafetyFeedback;
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
        planTimezone: input.planTimezone,
        planQualityMode: input.planQualityMode,
        personalizationContext: input.personalizationContext,
        safetyFeedback: input.safetyFeedback
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
    allowSafetyRetry?: boolean;
    safetyRetryUsed?: boolean;
  }): DailyPlanValidationResult | Promise<DailyPlanValidationResult> {
    const parsedPlan = dailyPlanJsonSchema.safeParse(input.providerPlan);

    if (!parsedPlan.success) {
      this.logger.warn('schema validation passed: false; fallback used: true');
      const fallbackPlan = createSafeFallbackPlan({
        planLocalDate: input.planLocalDate,
        planTimezone: input.planTimezone,
        reasons: [
          input.safetyRetryUsed
            ? 'safety_agent_retry_invalid_output'
            : 'The generated plan could not be safely validated.'
        ]
      });

      return {
        status: PlanStatus.FALLBACK,
        planJson: input.safetyRetryUsed
          ? this.withSafetyAgentDebug(fallbackPlan, {
              retryUsed: true,
              retryResult: 'failed'
            })
          : fallbackPlan
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

    const pregnancyPlanSafety = this.safetyService.validatePregnancySensitivePlanSafety(
      normalizedFoodNames.planJson,
      input.user.profile?.pregnancyStatus
    );

    if (!pregnancyPlanSafety.passed) {
      this.logger.warn(
        [
          'SafetyService failed',
          `pregnancy-sensitive conflict at ${pregnancyPlanSafety.matchedPath ?? 'unknown'}; matchedText=${pregnancyPlanSafety.matchedText ?? 'unknown'}`
        ].join(': ')
      );
      return {
        status: PlanStatus.FALLBACK,
        planJson: createSafeFallbackPlan({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          reasons: pregnancyPlanSafety.reasons
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
      planTimezone: input.planTimezone,
      allowSafetyRetry: Boolean(input.allowSafetyRetry),
      retryUsed: Boolean(input.safetyRetryUsed)
    });
  }

  private async reviewPlanWithSafetyAgent(input: {
    planJson: DailyPlanJson;
    user: Awaited<ReturnType<DailyPlansService['getPlanningUser']>>;
    blockedFoods: { allergies: string[]; excludedFoods: string[] };
    planLocalDate: string;
    planTimezone: string;
    allowSafetyRetry: boolean;
    retryUsed: boolean;
  }): Promise<DailyPlanValidationResult> {
    this.logger.log(
      `SafetyAgent enabled=${this.safetyAgentConfig.enabled}; provider=${this.safetyAgentConfig.provider}`
    );

    if (!this.safetyAgentConfig.enabled) {
      return {
        status: PlanStatus.READY,
        planJson: input.retryUsed
          ? this.withSafetyAgentDebug(input.planJson, {
              retryUsed: true,
              retryResult: 'approved'
            })
          : input.planJson
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
        if (
          input.allowSafetyRetry &&
          parsedReview.data.requiredChanges.some((change) => change.trim().length > 0)
        ) {
          this.logger.warn(
            `SafetyAgent rejected plan; safety retry available=true; reasonCount=${parsedReview.data.reasons.length}`
          );
          return {
            status: PlanStatus.FALLBACK,
            planJson: this.withSafetyAgentDebug(input.planJson, {
              approved: false,
              riskLevel: parsedReview.data.riskLevel,
              retryUsed: false,
              retryResult: 'not_used'
            }),
            safetyRetryRequest: {
              riskLevel: parsedReview.data.riskLevel,
              reasons: parsedReview.data.reasons,
              requiredChanges: parsedReview.data.requiredChanges
            }
          };
        }

        const fallbackReason = input.retryUsed
          ? 'safety_agent_retry_rejected'
          : 'safety_agent_rejected';
        this.logger.warn(`fallback used: true; fallback reason=${fallbackReason}`);
        return this.createSafetyAgentFallback({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          fallbackReason,
          approved: false,
          riskLevel: parsedReview.data.riskLevel,
          retryUsed: input.retryUsed,
          retryResult: input.retryUsed ? 'rejected' : 'not_used'
        });
      }

      if (input.retryUsed) {
        this.logger.log('retry SafetyAgent approved=true');
      }

      return {
        status: PlanStatus.READY,
        planJson: this.withSafetyAgentDebug(input.planJson, {
          approved: true,
          riskLevel: parsedReview.data.riskLevel,
          retryUsed: input.retryUsed,
          retryResult: input.retryUsed ? 'approved' : 'not_used'
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
          fallbackReason: input.retryUsed ? 'safety_agent_retry_failed' : error.fallbackReason,
          retryUsed: input.retryUsed,
          retryResult: input.retryUsed ? 'failed' : 'not_used'
        });
      }

      this.logger.warn('SafetyAgent unavailable; fallback reason=safety_agent_unavailable');
      return this.createSafetyAgentFallback({
        planLocalDate: input.planLocalDate,
        planTimezone: input.planTimezone,
        fallbackReason: input.retryUsed ? 'safety_agent_retry_failed' : 'safety_agent_unavailable',
        retryUsed: input.retryUsed,
        retryResult: input.retryUsed ? 'failed' : 'not_used'
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
        gender: input.user.profile?.gender ?? null,
        pregnancyStatus: input.user.profile?.pregnancyStatus ?? 'UNKNOWN',
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
    retryUsed?: boolean;
    retryResult?: 'approved' | 'rejected' | 'failed' | 'not_used';
  }): DailyPlanValidationResult {
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
          riskLevel: input.riskLevel,
          retryUsed: input.retryUsed,
          retryResult: input.retryResult
        }
      )
    };
  }

  private withSafetyAgentDebug(
    planJson: DailyPlanJson,
    review?: {
      approved?: boolean;
      riskLevel?: 'low' | 'medium' | 'high';
      retryUsed?: boolean;
      retryResult?: 'approved' | 'rejected' | 'failed' | 'not_used';
    }
  ): DailyPlanJson {
    if (!planJson.debug) {
      return planJson;
    }

    const safetyAgentDebug = {
      enabled: this.safetyAgentConfig.enabled,
      provider: this.safetyAgentConfig.provider,
      ...(review?.approved !== undefined ? { approved: review.approved } : {}),
      ...(review?.riskLevel !== undefined ? { riskLevel: review.riskLevel } : {}),
      ...(review?.retryUsed !== undefined ? { retryUsed: review.retryUsed } : {}),
      ...(review?.retryResult !== undefined ? { retryResult: review.retryResult } : {})
    };

    return {
      ...planJson,
      debug: {
        provider: planJson.debug.provider,
        generatedBy: planJson.debug.generatedBy,
        ...(planJson.debug.fallbackReason ? { fallbackReason: planJson.debug.fallbackReason } : {}),
        ...(planJson.debug.planQualityMode ? { planQualityMode: planJson.debug.planQualityMode } : {}),
        safetyAgent: safetyAgentDebug
      }
    };
  }

  private withPlanQualityModeDebug(
    planJson: DailyPlanJson,
    planQualityMode: PlanQualityMode
  ): DailyPlanJson {
    if (!planJson.debug) {
      return planJson;
    }

    return {
      ...planJson,
      debug: {
        ...planJson.debug,
        planQualityMode
      }
    };
  }

  private getProviderDebugName() {
    return this.aiProvider.constructor?.name === 'OpenAiProviderService' ? 'openai' : 'mock';
  }

  private canUseSafetyFeedbackRetry(providerStatus: PlanStatus) {
    return (
      providerStatus === PlanStatus.READY &&
      this.getProviderDebugName() === 'openai' &&
      this.safetyAgentConfig.enabled
    );
  }

  private getFallbackReason(planJson: unknown) {
    const debug = (planJson as { debug?: { fallbackReason?: unknown } })?.debug;
    return typeof debug?.fallbackReason === 'string' ? debug.fallbackReason : undefined;
  }

  private async buildPersonalizationContext(
    userId: string,
    planQualityMode: PlanQualityMode
  ): Promise<GenerateDailyPlanPersonalizationContext> {
    const baseContext: GenerateDailyPlanPersonalizationContext = {
      mode: planQualityMode,
      contextLevel: this.getContextLevel(planQualityMode),
      guidance: this.getPersonalizationGuidance(planQualityMode),
      trainingPersonalization: this.getTrainingPersonalizationContext(planQualityMode)
    };

    if (planQualityMode === PlanQualityMode.BASIC) {
      return baseContext;
    }

    const feedbackLimit = planQualityMode === PlanQualityMode.ADAPTIVE ? 10 : 5;
    const historyLimit = planQualityMode === PlanQualityMode.ADAPTIVE ? 10 : 5;
    const [recentFeedback, recentPlans] = await Promise.all([
      this.prisma.dailyPlanFeedback.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: feedbackLimit,
        select: {
          rating: true,
          tags: true
        }
      }),
      this.prisma.dailyPlan.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: historyLimit,
        select: {
          status: true,
          readinessLevel: true
        }
      })
    ]);

    return {
      ...baseContext,
      feedbackSummary: {
        helpfulCount: recentFeedback.filter(
          (feedback) => feedback.rating === PlanFeedbackRating.HELPFUL
        ).length,
        notHelpfulCount: recentFeedback.filter(
          (feedback) => feedback.rating === PlanFeedbackRating.NOT_HELPFUL
        ).length,
        commonTags: this.getCommonFeedbackTags(recentFeedback.flatMap((feedback) => feedback.tags))
      },
      historySummary: {
        recentPlanCount: recentPlans.length,
        readinessLevels: [...new Set(recentPlans.map((plan) => plan.readinessLevel))],
        fallbackCount: recentPlans.filter((plan) => plan.status === PlanStatus.FALLBACK).length
      }
    };
  }

  private getContextLevel(planQualityMode: PlanQualityMode) {
    switch (planQualityMode) {
      case PlanQualityMode.ADAPTIVE:
        return 'adaptive' as const;
      case PlanQualityMode.PERSONALIZED:
        return 'personalized' as const;
      case PlanQualityMode.BASIC:
      default:
        return 'minimal' as const;
    }
  }

  private getPersonalizationGuidance(planQualityMode: PlanQualityMode) {
    switch (planQualityMode) {
      case PlanQualityMode.ADAPTIVE:
        return [
          'Use recent feedback and plan history summaries to adapt the plan.',
          'Time meals around scheduled training when helpful.',
          'Use readiness placeholders for future recovery, sleep, strain, and WHOOP signals.',
          'Make training guidance adaptive without inventing unavailable recovery data.'
        ];
      case PlanQualityMode.PERSONALIZED:
        return [
          'Use preferences, schedule, goal, and feedback summaries more strongly.',
          'Make meals and training more specific than BASIC.',
          'Suggest practical exercises from current schedule and descriptions when safe.'
        ];
      case PlanQualityMode.BASIC:
      default:
        return [
          'Keep the plan simple, safe, and practical.',
          'Use limited context and avoid advanced progression.'
        ];
    }
  }

  private getTrainingPersonalizationContext(planQualityMode: PlanQualityMode) {
    switch (planQualityMode) {
      case PlanQualityMode.ADAPTIVE:
        return {
          usesSchedule: true,
          usesTrainingDescriptions: true,
          exerciseDetailLevel: 'adaptive' as const,
          futureSignals: [
            'targetMuscleGroups',
            'trainingOutcome',
            'equipment',
            'trainingLevel',
            'limitationsOrPainAreas',
            'whoopRecovery',
            'whoopSleep',
            'whoopStrain'
          ]
        };
      case PlanQualityMode.PERSONALIZED:
        return {
          usesSchedule: true,
          usesTrainingDescriptions: true,
          exerciseDetailLevel: 'sets_reps_rest' as const,
          futureSignals: [
            'targetMuscleGroups',
            'trainingOutcome',
            'equipment',
            'trainingLevel',
            'limitationsOrPainAreas'
          ]
        };
      case PlanQualityMode.BASIC:
      default:
        return {
          usesSchedule: true,
          usesTrainingDescriptions: false,
          exerciseDetailLevel: 'simple' as const,
          futureSignals: [
            'targetMuscleGroups',
            'trainingOutcome',
            'equipment',
            'trainingLevel',
            'limitationsOrPainAreas'
          ]
        };
    }
  }

  private getCommonFeedbackTags(tags: string[]) {
    const counts = new Map<string, number>();

    tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
  }

  private async recordDailyPlanAiOperation(input: {
    userId: string;
    status: PlanStatus;
    planJson: DailyPlanJson;
    latencyMs: number;
  }) {
    await this.recordAiOperationSafely({
      userId: input.userId,
      feature: AiOperationFeature.DAILY_PLAN,
      provider: this.getAiOperationProvider(),
      model: this.getAiOperationModel(),
      status:
        input.status === PlanStatus.READY
          ? AiOperationStatus.SUCCESS
          : AiOperationStatus.FALLBACK,
      latencyMs: input.latencyMs,
      retryCount: this.getSafetyRetryUsed(input.planJson) ? 1 : 0,
      safetyAgentEnabled: this.safetyAgentConfig.enabled,
      safetyAgentProvider: this.safetyAgentConfig.provider,
      safetyAgentApproved: this.getSafetyAgentApproved(input.planJson),
      fallbackReason: this.getFallbackReason(input.planJson) ?? null,
      errorReason: null
    });
  }

  private async recordDailyPlanAiOperationError(input: {
    userId: string;
    latencyMs: number;
    error: unknown;
  }) {
    await this.recordAiOperationSafely({
      userId: input.userId,
      feature: AiOperationFeature.DAILY_PLAN,
      provider: this.getAiOperationProvider(),
      model: this.getAiOperationModel(),
      status: AiOperationStatus.ERROR,
      latencyMs: input.latencyMs,
      retryCount: 0,
      safetyAgentEnabled: this.safetyAgentConfig.enabled,
      safetyAgentProvider: this.safetyAgentConfig.provider,
      safetyAgentApproved: null,
      fallbackReason: null,
      errorReason: this.getSafeAiOperationErrorReason(input.error)
    });
  }

  private async recordAiOperationSafely(
    input: Parameters<AiOperationLogsService['record']>[0]
  ) {
    try {
      await this.aiOperationLogs.record(input);
    } catch {
      this.logger.warn('AI operation log write failed; daily plan generation continued.');
    }
  }

  private getAiOperationProvider() {
    return this.getProviderDebugName() === 'openai'
      ? AiOperationProvider.OPENAI
      : AiOperationProvider.MOCK;
  }

  private getAiOperationModel() {
    return this.getProviderDebugName() === 'openai'
      ? this.configService.get<string>('OPENAI_DEFAULT_MODEL') ?? null
      : null;
  }

  private getSafetyAgentApproved(planJson: DailyPlanJson) {
    const approved = planJson.debug?.safetyAgent?.approved;
    return typeof approved === 'boolean' ? approved : null;
  }

  private getSafetyRetryUsed(planJson: DailyPlanJson) {
    return planJson.debug?.safetyAgent?.retryUsed === true;
  }

  private getSafeAiOperationErrorReason(error: unknown) {
    if (error instanceof OpenAiProviderError) {
      return error.fallbackReason;
    }

    if (error instanceof SafetyAgentError) {
      return error.fallbackReason;
    }

    return 'daily_plan_generation_error';
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
