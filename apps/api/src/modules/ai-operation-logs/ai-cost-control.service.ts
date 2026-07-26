import {
  Inject,
  Injectable,
  Logger
} from '@nestjs/common';
import {
  AiOperationStatus,
  SubscriptionPlan
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AiCostCeilingExceededException } from './ai-cost-ceiling-exceeded.exception';
import {
  AI_COST_CONTROL_CONFIG,
  type AiCostControlConfig
} from './ai-cost-control.token';

@Injectable()
export class AiCostControlService {
  private readonly logger = new Logger(AiCostControlService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementsService: EntitlementsService,
    @Inject(AI_COST_CONTROL_CONFIG)
    private readonly config: AiCostControlConfig
  ) {}

  async assertCanStartAiOperation(userId: string) {
    if (!this.config.enforcementEnabled) {
      return;
    }

    const entitlement =
      await this.entitlementsService.getEntitlementSummary(userId);
    const period = this.getCurrentUtcMonth();
    const aggregate = await this.prisma.aiRequestLog.aggregate({
      where: {
        userId,
        status: AiOperationStatus.SUCCESS,
        createdAt: {
          gte: period.start,
          lt: period.end
        },
        estimatedCostMicrousd: {
          not: null
        }
      },
      _sum: {
        estimatedCostMicrousd: true
      }
    });
    const spentMicrousd =
      aggregate._sum.estimatedCostMicrousd ?? 0;
    const ceilingMicrousd =
      this.config.monthlyCeilingMicrousd[
        entitlement.currentPlan
      ];

    if (spentMicrousd < ceilingMicrousd) {
      return;
    }

    this.logger.warn(
      [
        'AI monthly cost ceiling reached',
        `plan=${entitlement.currentPlan}`,
        `periodStart=${period.start.toISOString()}`
      ].join('; ')
    );

    throw new AiCostCeilingExceededException({
      code: 'AI_CAPACITY_LIMIT_REACHED',
      currentPlan: entitlement.currentPlan,
      resetAt: period.end.toISOString(),
      upgradeSuggestion: this.getUpgradeSuggestion(
        entitlement.currentPlan
      )
    });
  }

  private getCurrentUtcMonth(date = new Date()) {
    const start = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
    );
    const end = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        1
      )
    );

    return { start, end };
  }

  private getUpgradeSuggestion(
    plan: SubscriptionPlan
  ): 'PLUS' | 'PRO' | null {
    if (plan === SubscriptionPlan.FREE) return 'PLUS';
    if (plan === SubscriptionPlan.PLUS) return 'PRO';
    return null;
  }
}
