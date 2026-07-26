import {
  AiOperationProvider,
  AiOperationStatus,
  PlanStatus
} from '@prisma/client';
import type { ConfigService } from '@nestjs/config';

import type { PrismaService } from '../../prisma/prisma.service';
import type { AiOperationLogsService } from '../ai-operation-logs/ai-operation-logs.service';
import { OpenAiProviderError } from '../ai/open-ai-provider.error';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import { createMockDailyPlan } from '../daily-plans/templates/mock-daily-plan.factory';
import { DailyPlanPersistenceService } from './daily-plan-persistence.service';

describe('DailyPlanPersistenceService', () => {
  it('persists a complete deterministic replacement as READY and records fallback provenance', async () => {
    const planJson = createPlan({
      isComplete: true,
      adjustedSections: ['TRAINING']
    });
    const { service, prisma, aiOperationLogs } = createService();

    const result = await service.persistGeneratedPlan({
      userId: 'user-1',
      planLocalDate: '2026-07-26',
      planTimezone: 'UTC',
      result: { status: PlanStatus.FALLBACK, planJson },
      operationStartedAt: Date.now() - 125,
      operation: openAiOperation()
    });

    expect(result.status).toBe(PlanStatus.READY);
    expect(prisma.dailyPlan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        status: PlanStatus.READY,
        createdByAi: false
      })
    });
    expect(aiOperationLogs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: AiOperationProvider.OPENAI,
        model: 'gpt-test',
        status: AiOperationStatus.FALLBACK,
        fallbackReason: 'deterministic_training_section_adjustment'
      })
    );
  });

  it('updates an existing plan without changing persistence semantics', async () => {
    const planJson = createPlan({
      isComplete: false,
      adjustedSections: ['CORE']
    });
    const { service, prisma } = createService();

    const result = await service.persistGeneratedPlan({
      userId: 'user-1',
      existingPlanId: 'plan-existing',
      planLocalDate: '2026-07-26',
      planTimezone: 'UTC',
      result: { status: PlanStatus.FALLBACK, planJson },
      operationStartedAt: Date.now() - 50,
      operation: mockOperation()
    });

    expect(result.status).toBe(PlanStatus.FALLBACK);
    expect(prisma.dailyPlan.update).toHaveBeenCalledWith({
      where: { id: 'plan-existing' },
      data: expect.objectContaining({
        status: PlanStatus.FALLBACK,
        createdByAi: false
      })
    });
    expect(prisma.dailyPlan.create).not.toHaveBeenCalled();
  });

  it('maps typed provider errors to safe operation error reasons', async () => {
    const { service, aiOperationLogs } = createService();

    await service.recordGenerationError({
      userId: 'user-1',
      latencyMs: 20,
      error: new OpenAiProviderError('request failed', {
        fallbackReason: 'openai_timeout'
      }),
      operation: openAiOperation()
    });

    expect(aiOperationLogs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        status: AiOperationStatus.ERROR,
        errorReason: 'openai_timeout'
      })
    );
  });

  it('does not fail plan persistence when operation logging throws', async () => {
    const { service, aiOperationLogs } = createService();
    aiOperationLogs.record.mockRejectedValueOnce(new Error('log unavailable'));

    await expect(
      service.persistGeneratedPlan({
        userId: 'user-1',
        planLocalDate: '2026-07-26',
        planTimezone: 'UTC',
        result: {
          status: PlanStatus.READY,
          planJson: createPlan(true)
        },
        operationStartedAt: Date.now() - 10,
        operation: mockOperation()
      })
    ).resolves.toEqual(
      expect.objectContaining({ status: PlanStatus.READY })
    );
  });
});

function createService() {
  const record = jest.fn().mockResolvedValue(undefined);
  const create = jest.fn(async ({ data }) => createPlanRecord('plan-new', data));
  const update = jest.fn(async ({ where, data }) =>
    createPlanRecord(where.id, data)
  );
  const prisma = {
    dailyPlan: { create, update }
  };
  const configService = {
    get: jest.fn((key: string) =>
      key === 'OPENAI_DEFAULT_MODEL' ? 'gpt-test' : undefined
    )
  };
  const aiOperationLogs = { record };
  const service = new DailyPlanPersistenceService(
    prisma as unknown as PrismaService,
    configService as unknown as ConfigService,
    aiOperationLogs as unknown as AiOperationLogsService
  );

  return { service, prisma, aiOperationLogs };
}

function createPlan(
  generation: DailyPlanJson['debug'] extends infer Debug
    ? Debug extends { generation?: infer Generation }
      ? Generation | boolean
      : boolean
    : boolean
) {
  const plan = createMockDailyPlan({
    planLocalDate: '2026-07-26',
    planTimezone: 'UTC',
    isMinor: false
  });
  const normalizedGeneration =
    typeof generation === 'boolean'
      ? { isComplete: generation, adjustedSections: [] }
      : generation;

  return {
    ...plan,
    debug: {
      ...plan.debug,
      generation: normalizedGeneration
    }
  } as DailyPlanJson;
}

function createPlanRecord(id: string, data: Record<string, unknown>) {
  const now = new Date('2026-07-26T12:00:00.000Z');
  return {
    id,
    userId: 'user-1',
    planLocalDate: '2026-07-26',
    planTimezone: 'UTC',
    status: PlanStatus.READY,
    readinessLevel: 'MAINTAIN',
    planJson: {},
    createdByAi: false,
    createdAt: now,
    updatedAt: now,
    ...data
  };
}

function openAiOperation() {
  return {
    provider: 'openai' as const,
    safetyAgentEnabled: true,
    safetyAgentProvider: 'openai'
  };
}

function mockOperation() {
  return {
    provider: 'mock' as const,
    safetyAgentEnabled: false,
    safetyAgentProvider: 'mock'
  };
}
