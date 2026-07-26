import { Inject, Injectable, Logger } from '@nestjs/common';
import { PlanStatus } from '@prisma/client';

import { normalizeDailyPlanFoodNames } from '../daily-plans/daily-plan-food-name-normalizer';
import {
  type DailyPlanJson,
  dailyPlanJsonSchema
} from '../daily-plans/daily-plan-json.schema';
import { createSafeFallbackPlan } from '../safety/safe-fallback-plan.factory';
import { SafetyService } from '../safety/safety.service';
import { SafetyAgentError } from '../safety-agent/safety-agent.error';
import type {
  ReviewDailyPlanInput,
  SafetyAgent
} from '../safety-agent/safety-agent.interface';
import {
  safetyAgentReviewSchema,
  type SafetyAgentReview
} from '../safety-agent/safety-agent-review.schema';
import {
  SAFETY_AGENT,
  SAFETY_AGENT_CONFIG,
  type SafetyAgentConfig
} from '../safety-agent/safety-agent.token';
import type {
  CreateSafetyFallbackInput,
  DailyPlanSafetyResult,
  ValidateDailyPlanSafetyInput
} from './daily-plan-safety-orchestrator.interface';

const MATERIAL_SAFETY_REVIEW_PATTERNS: Array<{
  category: string;
  pattern: RegExp;
}> = [
  {
    category: 'unsafe_diet',
    pattern:
      /starv|fasting|detox|extreme calor|severe (?:calorie|diet)|skip meals|punish(?:ment)? exercise/i
  },
  {
    category: 'body_shaming',
    pattern: /body.?sham|shame|guilt|disgust|lazy|punish/i
  },
  {
    category: 'medical_claim',
    pattern: /medical diagnos|diagnos|treat(?:ment)?|medical claim|supplement/i
  },
  {
    category: 'unsafe_training',
    pattern:
      /unsafe (?:training|exercise|workout)|train through|push through|ignore (?:pain|dizz|illness|exhaust|injur)|(?:exercise|workout|training).*(?:despite|with) (?:pain|dizz|illness|exhaust|injur)|maximum effort|max effort|overtrain|aggress(?:ive|ively)/i
  },
  {
    category: 'sensitive_context',
    pattern:
      /unsafe.*(?:under.?18|minor|safe mode|pregnan|postpartum|breastfeed)|(?:under.?18|minor|safe mode|pregnan|postpartum|breastfeed).*(?:unsafe|high.?intensity|extreme|aggress)/i
  }
];

@Injectable()
export class DailyPlanSafetyOrchestratorService {
  private readonly logger = new Logger(DailyPlanSafetyOrchestratorService.name);

  constructor(
    private readonly safetyService: SafetyService,
    @Inject(SAFETY_AGENT) private readonly safetyAgent: SafetyAgent,
    @Inject(SAFETY_AGENT_CONFIG)
    private readonly safetyAgentConfig: SafetyAgentConfig
  ) {}

  validate(
    input: ValidateDailyPlanSafetyInput
  ): DailyPlanSafetyResult | Promise<DailyPlanSafetyResult> {
    const parsedPlan = dailyPlanJsonSchema.safeParse(input.providerPlan);

    if (!parsedPlan.success) {
      this.logger.warn('schema validation passed: false; fallback used: true');
      const fallbackPlan = createSafeFallbackPlan({
        planLocalDate: input.planLocalDate,
        planTimezone: input.planTimezone,
        locale: input.locale,
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

    const normalizedFoodNames = normalizeDailyPlanFoodNames(
      parsedPlan.data,
      input.blockedFoods
    );

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
      return this.createDeterministicFallback(input, planSafety.reasons);
    }

    const pregnancyPlanSafety =
      this.safetyService.validatePregnancySensitivePlanSafety(
        normalizedFoodNames.planJson,
        input.userContext.pregnancyStatus
      );

    if (!pregnancyPlanSafety.passed) {
      this.logger.warn(
        [
          'SafetyService failed',
          `pregnancy-sensitive conflict at ${pregnancyPlanSafety.matchedPath ?? 'unknown'}; matchedText=${pregnancyPlanSafety.matchedText ?? 'unknown'}`
        ].join(': ')
      );
      return this.createDeterministicFallback(
        input,
        pregnancyPlanSafety.reasons
      );
    }

    const exercisePlanSafety = this.safetyService.validatePlanExerciseSafety({
      planJson: normalizedFoodNames.planJson,
      safeMode: input.userContext.safeMode,
      isMinor: input.userContext.isMinor,
      pregnancyStatus: input.userContext.pregnancyStatus,
      trainingLevel: input.userContext.trainingLevel,
      limitationsOrPainAreas: input.userContext.limitationsOrPainAreas,
      painOrDiscomfortReported: input.userContext.painOrDiscomfortReported,
      highTirednessReported: input.userContext.highTirednessReported
    });

    if (!exercisePlanSafety.passed) {
      const firstConflict = exercisePlanSafety.conflicts[0];
      this.logger.warn(
        [
          'SafetyService failed',
          firstConflict
            ? `exercise conflict at ${firstConflict.matchedPath}; reason=${firstConflict.reason}; matchedText=${firstConflict.matchedText}`
            : `fallback reason=${exercisePlanSafety.reasons.join(' | ')}`
        ].join(': ')
      );
      return this.createDeterministicFallback(
        input,
        exercisePlanSafety.reasons
      );
    }

    this.logger.log('schema validation passed: true');
    this.logger.log('SafetyService passed: true');

    if (input.forcedFallback) {
      return {
        status: PlanStatus.FALLBACK,
        planJson: normalizedFoodNames.planJson
      };
    }

    return this.reviewWithSafetyAgent({
      ...input,
      planJson: normalizedFoodNames.planJson
    });
  }

  createSafetyFallback(
    input: CreateSafetyFallbackInput
  ): DailyPlanSafetyResult {
    return {
      status: PlanStatus.FALLBACK,
      planJson: this.withSafetyAgentDebug(
        createSafeFallbackPlan({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          locale: input.locale,
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

  private createDeterministicFallback(
    input: ValidateDailyPlanSafetyInput,
    reasons: string[]
  ): DailyPlanSafetyResult {
    return {
      status: PlanStatus.FALLBACK,
      planJson: createSafeFallbackPlan({
        planLocalDate: input.planLocalDate,
        planTimezone: input.planTimezone,
        locale: input.locale,
        reasons
      })
    };
  }

  private async reviewWithSafetyAgent(
    input: ValidateDailyPlanSafetyInput & { planJson: DailyPlanJson }
  ): Promise<DailyPlanSafetyResult> {
    this.logger.log(
      `SafetyAgent enabled=${this.safetyAgentConfig.enabled}; provider=${this.safetyAgentConfig.provider}`
    );

    if (!this.safetyAgentConfig.enabled) {
      return {
        status: PlanStatus.READY,
        planJson: input.safetyRetryUsed
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
        return this.createSafetyFallback({
          planLocalDate: input.planLocalDate,
          planTimezone: input.planTimezone,
          locale: input.locale,
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
        return this.handleRejectedReview(input, parsedReview.data);
      }

      if (input.safetyRetryUsed) {
        this.logger.log('retry SafetyAgent approved=true');
      }

      return {
        status: PlanStatus.READY,
        planJson: this.withSafetyAgentDebug(input.planJson, {
          approved: true,
          riskLevel: parsedReview.data.riskLevel,
          retryUsed: Boolean(input.safetyRetryUsed),
          retryResult: input.safetyRetryUsed ? 'approved' : 'not_used'
        })
      };
    } catch (error) {
      return this.handleSafetyAgentError(input, error);
    }
  }

  private handleRejectedReview(
    input: ValidateDailyPlanSafetyInput & { planJson: DailyPlanJson },
    review: SafetyAgentReview
  ): DailyPlanSafetyResult {
    const rejection = this.classifySafetyAgentRejection(review);
    if (!rejection.isBlocking) {
      this.logger.warn(
        [
          'SafetyAgent non-blocking review accepted',
          `provider=${this.safetyAgentConfig.provider}`,
          `riskLevel=${review.riskLevel}`,
          `reasonCount=${review.reasons.length}`,
          'categories=none'
        ].join('; ')
      );
      return {
        status: PlanStatus.READY,
        planJson: this.withSafetyAgentDebug(input.planJson, {
          approved: true,
          riskLevel: 'low',
          retryUsed: Boolean(input.safetyRetryUsed),
          retryResult: input.safetyRetryUsed ? 'approved' : 'not_used'
        })
      };
    }

    this.logger.warn(
      [
        'SafetyAgent blocking review',
        `provider=${this.safetyAgentConfig.provider}`,
        `riskLevel=${review.riskLevel}`,
        `reasonCount=${review.reasons.length}`,
        `categories=${rejection.categories.join(',')}`
      ].join('; ')
    );
    for (const category of rejection.categories) {
      this.logger.warn(`SafetyAgent blocking category=${category}`);
    }

    if (
      input.allowSafetyRetry &&
      review.requiredChanges.some((change) => change.trim().length > 0)
    ) {
      this.logger.warn(
        `SafetyAgent rejected plan; safety retry available=true; reasonCount=${review.reasons.length}`
      );
      return {
        status: PlanStatus.FALLBACK,
        planJson: this.withSafetyAgentDebug(input.planJson, {
          approved: false,
          riskLevel: review.riskLevel,
          retryUsed: false,
          retryResult: 'not_used'
        }),
        safetyRetryRequest: {
          riskLevel: review.riskLevel,
          reasons: review.reasons,
          requiredChanges: review.requiredChanges
        }
      };
    }

    const fallbackReason = input.safetyRetryUsed
      ? 'safety_agent_retry_rejected'
      : 'safety_agent_rejected';
    this.logger.warn(`fallback used: true; fallback reason=${fallbackReason}`);
    return this.createSafetyFallback({
      planLocalDate: input.planLocalDate,
      planTimezone: input.planTimezone,
      locale: input.locale,
      fallbackReason,
      approved: false,
      riskLevel: review.riskLevel,
      retryUsed: Boolean(input.safetyRetryUsed),
      retryResult: input.safetyRetryUsed ? 'rejected' : 'not_used'
    });
  }

  private handleSafetyAgentError(
    input: ValidateDailyPlanSafetyInput,
    error: unknown
  ): DailyPlanSafetyResult {
    if (error instanceof SafetyAgentError) {
      this.logger.warn(
        `SafetyAgent failed; provider=${this.safetyAgentConfig.provider}; fallback reason=${error.fallbackReason}`
      );
      return this.createSafetyFallback({
        planLocalDate: input.planLocalDate,
        planTimezone: input.planTimezone,
        locale: input.locale,
        fallbackReason: input.safetyRetryUsed
          ? 'safety_agent_retry_failed'
          : error.fallbackReason,
        retryUsed: Boolean(input.safetyRetryUsed),
        retryResult: input.safetyRetryUsed ? 'failed' : 'not_used'
      });
    }

    this.logger.warn(
      'SafetyAgent unavailable; fallback reason=safety_agent_unavailable'
    );
    return this.createSafetyFallback({
      planLocalDate: input.planLocalDate,
      planTimezone: input.planTimezone,
      locale: input.locale,
      fallbackReason: input.safetyRetryUsed
        ? 'safety_agent_retry_failed'
        : 'safety_agent_unavailable',
      retryUsed: Boolean(input.safetyRetryUsed),
      retryResult: input.safetyRetryUsed ? 'failed' : 'not_used'
    });
  }

  private buildSafetyAgentReviewInput(
    input: ValidateDailyPlanSafetyInput & { planJson: DailyPlanJson }
  ): ReviewDailyPlanInput {
    return {
      plan: input.planJson,
      safeMode: input.userContext.safeMode,
      goalSummary: input.userContext.goal,
      deterministicSafetyContext: {
        safeMode: input.userContext.safeMode,
        isMinor: input.userContext.isMinor,
        gender: input.userContext.gender ?? null,
        pregnancyStatus: input.userContext.pregnancyStatus ?? 'UNKNOWN',
        allergies: input.blockedFoods.allergies,
        excludedFoods: input.blockedFoods.excludedFoods,
        deterministicSafetyPassed: true
      }
    };
  }

  private classifySafetyAgentRejection(review: SafetyAgentReview) {
    const reviewText = [...review.reasons, ...review.requiredChanges].join(' ');
    const categories = MATERIAL_SAFETY_REVIEW_PATTERNS
      .filter(({ pattern }) => pattern.test(reviewText))
      .map(({ category }) => category);

    return {
      categories,
      isBlocking: review.riskLevel === 'high' || categories.length > 0
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

    return {
      ...planJson,
      debug: {
        ...planJson.debug,
        safetyAgent: {
          enabled: this.safetyAgentConfig.enabled,
          provider: this.safetyAgentConfig.provider,
          ...(review?.approved !== undefined
            ? { approved: review.approved }
            : {}),
          ...(review?.riskLevel !== undefined
            ? { riskLevel: review.riskLevel }
            : {}),
          ...(review?.retryUsed !== undefined
            ? { retryUsed: review.retryUsed }
            : {}),
          ...(review?.retryResult !== undefined
            ? { retryResult: review.retryResult }
            : {})
        }
      }
    };
  }
}
