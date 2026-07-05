import { Injectable } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';

import { EntitlementsService, EntitlementSummary } from './entitlements.service';
import {
  FEATURE_ACCESS_MATRIX,
  FeatureAccessMatrix
} from './entitlement-matrix';

export type FeatureAccessSummary = FeatureAccessMatrix;

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

  async canRegenerateMeals(userId: string) {
    return this.getFeaturesForPlan(await this.getCurrentPlan(userId)).canRegenerateMeals;
  }

  async canRegenerateMenus(userId: string) {
    return this.getFeaturesForPlan(await this.getCurrentPlan(userId)).canRegenerateMenus;
  }

  async canUseAiTrainingLoadAgent(userId: string) {
    return this.getFeaturesForPlan(await this.getCurrentPlan(userId)).canUseAiTrainingLoadAgent;
  }

  getFeaturesForPlan(plan: SubscriptionPlan): FeatureAccessSummary {
    return FEATURE_ACCESS_MATRIX[plan] ?? FEATURE_ACCESS_MATRIX[SubscriptionPlan.FREE];
  }

  private isPlusOrPro(plan: SubscriptionPlan) {
    return plan === SubscriptionPlan.PLUS || plan === SubscriptionPlan.PRO;
  }
}
