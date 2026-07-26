import {
  AiOperationStatus,
  SubscriptionPlan
} from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service';
import type { EntitlementsService } from '../entitlements/entitlements.service';
import { AiCostCeilingExceededException } from './ai-cost-ceiling-exceeded.exception';
import { AiCostControlService } from './ai-cost-control.service';

describe('AiCostControlService', () => {
  it('does not query cost data when enforcement is disabled', async () => {
    const { service, aggregate } = createService({
      enforcementEnabled: false
    });

    await expect(
      service.assertCanStartAiOperation('user-1')
    ).resolves.toBeUndefined();
    expect(aggregate).not.toHaveBeenCalled();
  });

  it('allows an operation below the current plan ceiling', async () => {
    const { service } = createService({
      currentPlan: SubscriptionPlan.PLUS,
      spentMicrousd: 1_999_999
    });

    await expect(
      service.assertCanStartAiOperation('user-1')
    ).resolves.toBeUndefined();
  });

  it('blocks before another AI operation when the monthly ceiling is reached', async () => {
    const { service, aggregate } = createService({
      currentPlan: SubscriptionPlan.FREE,
      spentMicrousd: 500_000
    });

    await expect(
      service.assertCanStartAiOperation('user-1')
    ).rejects.toMatchObject({
      response: {
        code: 'AI_CAPACITY_LIMIT_REACHED',
        currentPlan: SubscriptionPlan.FREE,
        upgradeSuggestion: 'PLUS'
      }
    });
    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          status: AiOperationStatus.SUCCESS,
          estimatedCostMicrousd: { not: null }
        })
      })
    );
  });

  it('uses a typed exception without exposing internal cost amounts', async () => {
    const { service } = createService({
      spentMicrousd: 500_000
    });

    try {
      await service.assertCanStartAiOperation('user-1');
      throw new Error('Expected ceiling rejection.');
    } catch (error) {
      expect(error).toBeInstanceOf(
        AiCostCeilingExceededException
      );
      expect(JSON.stringify(error)).not.toContain('500000');
    }
  });
});

function createService(
  input: {
    enforcementEnabled?: boolean;
    currentPlan?: SubscriptionPlan;
    spentMicrousd?: number;
  } = {}
) {
  const aggregate = jest.fn().mockResolvedValue({
    _sum: {
      estimatedCostMicrousd: input.spentMicrousd ?? 0
    }
  });
  const prisma = {
    aiRequestLog: { aggregate }
  } as unknown as PrismaService;
  const entitlementsService = {
    getEntitlementSummary: jest.fn().mockResolvedValue({
      currentPlan: input.currentPlan ?? SubscriptionPlan.FREE
    })
  } as unknown as EntitlementsService;
  const service = new AiCostControlService(
    prisma,
    entitlementsService,
    {
      enforcementEnabled: input.enforcementEnabled ?? true,
      monthlyCeilingMicrousd: {
        [SubscriptionPlan.FREE]: 500_000,
        [SubscriptionPlan.PLUS]: 2_000_000,
        [SubscriptionPlan.PRO]: 5_000_000
      }
    }
  );

  return { service, aggregate };
}
