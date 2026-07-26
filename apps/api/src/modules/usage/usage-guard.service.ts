import { Injectable } from '@nestjs/common';
import { SubscriptionPlan, UsageFeature, UsagePeriodType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { USAGE_LIMIT_MATRIX } from '../entitlements/entitlement-matrix';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { UsageLedgerService } from './usage-ledger.service';
import { UsageLimitExceededException } from './usage-limit-exceeded.exception';

@Injectable()
export class UsageGuardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementsService: EntitlementsService,
    private readonly usageLedger: UsageLedgerService
  ) {}

  async getLimit(userId: string, feature: UsageFeature, periodType: UsagePeriodType) {
    const currentPlan = (await this.entitlementsService.getEntitlementSummary(userId)).currentPlan;
    return this.getLimitForPlan(currentPlan, feature, periodType);
  }

  getConfiguredPeriodType(feature: UsageFeature) {
    return this.getConfig(feature)?.periodType ?? null;
  }

  async assertCanUseConfigured(userId: string, feature: UsageFeature) {
    const periodType = this.requireConfiguredPeriodType(feature);
    return this.assertCanUse(userId, feature, periodType);
  }

  async checkAndConsumeConfigured(
    userId: string,
    feature: UsageFeature,
    amount = 1
  ) {
    const periodType = this.requireConfiguredPeriodType(feature);
    return this.checkAndConsume(userId, feature, periodType, amount);
  }

  async getRemaining(userId: string, feature: UsageFeature, periodType: UsagePeriodType) {
    const context = await this.getUsageContext(userId, feature, periodType);

    if (context.limit === null) {
      return null;
    }

    return Math.max(context.limit - context.count, 0);
  }

  async assertCanUse(userId: string, feature: UsageFeature, periodType: UsagePeriodType) {
    const context = await this.getUsageContext(userId, feature, periodType);

    if (context.limit !== null && context.count >= context.limit) {
      throw this.createLimitExceededException({
        feature: context.feature,
        periodType: context.periodType,
        currentPlan: context.currentPlan,
        limit: context.limit,
        resetAt: context.resetAt
      });
    }
  }

  consume(userId: string, feature: UsageFeature, periodType: UsagePeriodType, amount = 1) {
    return this.usageLedger.incrementUsage(userId, feature, periodType, amount);
  }

  refundById(id: string, amount = 1) {
    return this.usageLedger.decrementUsageById(id, amount);
  }

  async checkAndConsume(
    userId: string,
    feature: UsageFeature,
    periodType: UsagePeriodType,
    amount = 1
  ) {
    const currentPlan = (await this.entitlementsService.getEntitlementSummary(userId)).currentPlan;
    const user = await this.getUsageUser(userId);
    const limit = this.getLimitForPlan(currentPlan, feature, periodType);
    const usage = await this.usageLedger.incrementUsage(
      userId,
      feature,
      periodType,
      amount,
      new Date(),
      user.timezone
    );

    if (limit === null || usage.count <= limit) {
      return usage;
    }

    await this.usageLedger.decrementUsageById(usage.id, amount);
    throw this.createLimitExceededException({
      feature,
      periodType,
      limit,
      currentPlan,
      resetAt: this.usageLedger.getResetAt(periodType, usage.periodStart)
    });
  }

  async getUsageSummary(userId: string) {
    const entitlement = await this.entitlementsService.getEntitlementSummary(userId);
    const user = await this.getUsageUser(userId);
    const now = new Date();

    const items = await Promise.all(
      USAGE_LIMIT_MATRIX.map(async (config) => {
        const periodStart = this.usageLedger.getPeriodStart(config.periodType, now, user.timezone);
        const count = await this.usageLedger.getUsage(
          userId,
          config.feature,
          config.periodType,
          now,
          user.timezone
        );
        const limit = config.limits[entitlement.currentPlan];

        return {
          feature: config.feature,
          periodType: config.periodType,
          count,
          limit,
          remaining: Math.max(limit - count, 0),
          resetAt: this.usageLedger.getResetAt(config.periodType, periodStart).toISOString()
        };
      })
    );

    return { items };
  }

  private async getUsageContext(
    userId: string,
    feature: UsageFeature,
    periodType: UsagePeriodType
  ) {
    const [entitlement, user] = await Promise.all([
      this.entitlementsService.getEntitlementSummary(userId),
      this.getUsageUser(userId)
    ]);
    const now = new Date();
    const periodStart = this.usageLedger.getPeriodStart(periodType, now, user.timezone);
    const count = await this.usageLedger.getUsage(
      userId,
      feature,
      periodType,
      now,
      user.timezone
    );
    const limit = this.getLimitForPlan(entitlement.currentPlan, feature, periodType);

    return {
      userId,
      feature,
      periodType,
      count,
      limit,
      currentPlan: entitlement.currentPlan,
      resetAt: this.usageLedger.getResetAt(periodType, periodStart)
    };
  }

  private getLimitForPlan(
    plan: SubscriptionPlan,
    feature: UsageFeature,
    periodType: UsagePeriodType
  ) {
    const config = this.getConfig(feature, periodType);

    return config?.limits[plan] ?? null;
  }

  private getConfig(feature: UsageFeature, periodType?: UsagePeriodType) {
    return USAGE_LIMIT_MATRIX.find(
      (candidate) =>
        candidate.feature === feature &&
        (periodType === undefined || candidate.periodType === periodType)
    );
  }

  private requireConfiguredPeriodType(feature: UsageFeature) {
    const periodType = this.getConfiguredPeriodType(feature);

    if (!periodType) {
      throw new Error(`No usage limit configuration exists for ${feature}.`);
    }

    return periodType;
  }

  private getUsageUser(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true }
    });
  }

  private createLimitExceededException(input: {
    feature: UsageFeature;
    periodType: UsagePeriodType;
    currentPlan: SubscriptionPlan;
    limit: number;
    resetAt: Date;
  }) {
    return new UsageLimitExceededException({
      code: 'USAGE_LIMIT_REACHED',
      feature: input.feature,
      currentPlan: input.currentPlan,
      limit: input.limit,
      periodType: input.periodType,
      resetAt: input.resetAt.toISOString(),
      upgradeSuggestion: this.getUpgradeSuggestion(input.currentPlan)
    });
  }

  private getUpgradeSuggestion(plan: SubscriptionPlan): 'PLUS' | 'PRO' | null {
    if (plan === SubscriptionPlan.FREE) {
      return 'PLUS';
    }

    if (plan === SubscriptionPlan.PLUS) {
      return 'PRO';
    }

    return null;
  }
}
