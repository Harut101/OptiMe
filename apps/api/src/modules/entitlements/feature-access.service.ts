import { Injectable } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';

import { EntitlementsService, EntitlementSummary } from './entitlements.service';

export interface FeatureAccessSummary {
  canGenerateDailyPlan: boolean;
  canRefreshPlan: boolean;
  canUseOpenAIProvider: boolean;
  canUseAdvancedPersonalization: boolean;
  canUseFeedbackPersonalization: boolean;
  canViewHistory: boolean;
  canSubmitFeedback: boolean;
  canUseWeeklyReports: boolean;
  canUseWhoop: boolean;
  canUseAiCoach: boolean;
}

export type EntitlementSummaryWithFeatures = EntitlementSummary & {
  features: FeatureAccessSummary;
};

@Injectable()
export class FeatureAccessService {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  async getEntitlementSummary(userId: string): Promise<EntitlementSummaryWithFeatures> {
    const summary = await this.entitlementsService.getEntitlementSummary(userId);

    return {
      ...summary,
      features: this.getFeaturesForPlan(summary.currentPlan)
    };
  }

  async getCurrentPlan(userId: string) {
    return (await this.entitlementsService.getEntitlementSummary(userId)).currentPlan;
  }

  async getPlanQualityMode(userId: string) {
    return (await this.entitlementsService.getEntitlementSummary(userId)).planQualityMode;
  }

  async canGenerateDailyPlan(_userId: string) {
    return true;
  }

  async canRefreshPlan(_userId: string) {
    return true;
  }

  async canUseOpenAIProvider(_userId: string) {
    return true;
  }

  async canUseAdvancedPersonalization(userId: string) {
    return this.isPlusOrPro(await this.getCurrentPlan(userId));
  }

  async canUseFeedbackPersonalization(userId: string) {
    return this.isPlusOrPro(await this.getCurrentPlan(userId));
  }

  async canViewHistory(_userId: string) {
    return true;
  }

  async canSubmitFeedback(_userId: string) {
    return true;
  }

  async canUseWeeklyReports(userId: string) {
    return this.isPlusOrPro(await this.getCurrentPlan(userId));
  }

  async canUseWhoop(userId: string) {
    return (await this.getCurrentPlan(userId)) === SubscriptionPlan.PRO;
  }

  async canUseAiCoach(userId: string) {
    return (await this.getCurrentPlan(userId)) === SubscriptionPlan.PRO;
  }

  getFeaturesForPlan(plan: SubscriptionPlan): FeatureAccessSummary {
    const isPlusOrPro = this.isPlusOrPro(plan);
    const isPro = plan === SubscriptionPlan.PRO;

    return {
      canGenerateDailyPlan: true,
      canRefreshPlan: true,
      canUseOpenAIProvider: true,
      canUseAdvancedPersonalization: isPlusOrPro,
      canUseFeedbackPersonalization: isPlusOrPro,
      canViewHistory: true,
      canSubmitFeedback: true,
      canUseWeeklyReports: isPlusOrPro,
      canUseWhoop: isPro,
      canUseAiCoach: isPro
    };
  }

  private isPlusOrPro(plan: SubscriptionPlan) {
    return plan === SubscriptionPlan.PLUS || plan === SubscriptionPlan.PRO;
  }
}
