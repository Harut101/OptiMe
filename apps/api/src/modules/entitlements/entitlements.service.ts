import { Injectable } from '@nestjs/common';
import {
  PlanQualityMode,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface EntitlementSummary {
  currentPlan: SubscriptionPlan;
  planQualityMode: PlanQualityMode;
  isPremium: boolean;
  activeSubscriptionId?: string;
  source: 'subscription' | 'default_free';
}

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEntitlementSummary(userId: string): Promise<EntitlementSummary> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }]
    });
    const activeSubscription = this.resolveActiveSubscription(subscriptions);
    const currentPlan = activeSubscription?.plan ?? SubscriptionPlan.FREE;

    return {
      currentPlan,
      planQualityMode: this.getPlanQualityModeForPlan(currentPlan),
      isPremium: currentPlan !== SubscriptionPlan.FREE,
      ...(activeSubscription ? { activeSubscriptionId: activeSubscription.id } : {}),
      source: activeSubscription ? 'subscription' : 'default_free'
    };
  }

  getPlanQualityModeForPlan(plan: SubscriptionPlan): PlanQualityMode {
    switch (plan) {
      case SubscriptionPlan.PRO:
        return PlanQualityMode.ADAPTIVE;
      case SubscriptionPlan.PLUS:
        return PlanQualityMode.PERSONALIZED;
      case SubscriptionPlan.FREE:
      default:
        return PlanQualityMode.BASIC;
    }
  }

  private resolveActiveSubscription(subscriptions: Subscription[]) {
    const now = new Date();
    const activeSubscriptions = subscriptions.filter((subscription) =>
      this.isSubscriptionActive(subscription, now)
    );

    return activeSubscriptions.sort((a, b) => {
      const rankDiff = this.getPlanRank(b.plan) - this.getPlanRank(a.plan);

      if (rankDiff !== 0) {
        return rankDiff;
      }

      return b.startsAt.getTime() - a.startsAt.getTime();
    })[0];
  }

  private isSubscriptionActive(subscription: Subscription, now: Date) {
    if (subscription.startsAt.getTime() > now.getTime()) {
      return false;
    }

    if (subscription.status === SubscriptionStatus.CANCELED) {
      return Boolean(subscription.expiresAt && subscription.expiresAt.getTime() > now.getTime());
    }

    const activeStatuses: SubscriptionStatus[] = [
      SubscriptionStatus.TRIALING,
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.GRACE_PERIOD
    ];

    if (!activeStatuses.includes(subscription.status)) {
      return false;
    }

    return !subscription.expiresAt || subscription.expiresAt.getTime() > now.getTime();
  }

  private getPlanRank(plan: SubscriptionPlan) {
    switch (plan) {
      case SubscriptionPlan.PRO:
        return 3;
      case SubscriptionPlan.PLUS:
        return 2;
      case SubscriptionPlan.FREE:
      default:
        return 1;
    }
  }
}
