import {
  AiModelRoute,
  AiOperationStatus,
  AiRequestAgent,
  AiRequestOperation
} from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service';
import type { AiModelRouterService } from '../ai-model-routing/ai-model-router.service';
import type { AiBenchmarkBudgetService } from './ai-benchmark-budget.service';
import { AiRequestTelemetryService } from './ai-request-telemetry.service';

describe('AiRequestTelemetryService', () => {
  it('records sanitized token usage and estimated cost', async () => {
    const { service, create, benchmarkBudget } = createService();

    await service.execute({
      userId: 'user-1',
      operation: AiRequestOperation.NUTRITION_GENERATION,
      selection: selection(),
      retryAttempt: false,
      request: async () => ({
        output_text: '{}',
        usage: {
          input_tokens: 1_000,
          output_tokens: 500,
          total_tokens: 1_500
        }
      })
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        agent: AiRequestAgent.NUTRITION,
        route: AiModelRoute.LUNA,
        status: AiOperationStatus.SUCCESS,
        inputTokens: 1_000,
        outputTokens: 500,
        totalTokens: 1_500,
        estimatedCostMicrousd: 1_250,
        errorReason: null
      })
    });
    expect(benchmarkBudget.reserve).toHaveBeenCalledWith(selection());
    expect(benchmarkBudget.settleSuccess).toHaveBeenCalledWith(null, 1_250);
    expect(benchmarkBudget.settleFailure).not.toHaveBeenCalled();
  });

  it('records a safe error reason and rethrows the provider error', async () => {
    const { service, create, benchmarkBudget } = createService();
    const error = Object.assign(new Error('quota'), {
      status: 429,
      code: 'rate_limit_exceeded'
    });

    await expect(
      service.execute({
        userId: 'user-1',
        operation: AiRequestOperation.DAILY_PLAN_GENERATION,
        selection: selection(),
        retryAttempt: true,
        request: async () => {
          throw error;
        }
      })
    ).rejects.toBe(error);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: AiOperationStatus.ERROR,
        retryAttempt: true,
        errorReason: 'openai_rate_limited',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      })
    });
    expect(benchmarkBudget.settleFailure).toHaveBeenCalledWith(null);
    expect(benchmarkBudget.settleSuccess).not.toHaveBeenCalled();
  });

  it('never breaks a successful provider request when telemetry storage fails', async () => {
    const { service, create } = createService();
    create.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      service.execute({
        userId: 'user-1',
        operation: AiRequestOperation.SAFETY_REVIEW,
        selection: selection(),
        retryAttempt: false,
        request: async () => ({ output_text: '{}' })
      })
    ).resolves.toEqual({ output_text: '{}' });
  });

  it('maps a plain timeout message to the safe timeout reason', async () => {
    const { service, create } = createService();

    await expect(
      service.execute({
        userId: 'user-1',
        operation: AiRequestOperation.DAILY_PLAN_GENERATION,
        selection: selection(),
        retryAttempt: false,
        request: async () => {
          throw new Error('Request timed out.');
        }
      })
    ).rejects.toThrow('Request timed out.');

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ errorReason: 'openai_timeout' })
    });
  });
});

function createService() {
  const create = jest.fn().mockResolvedValue({});
  const prisma = { aiRequestLog: { create } };
  const modelRouter = {
    estimateCostMicrousd: jest.fn(() => 1_250)
  };
  const benchmarkBudget = {
    reserve: jest.fn(() => null),
    settleSuccess: jest.fn(),
    settleFailure: jest.fn()
  };
  const service = new AiRequestTelemetryService(
    prisma as unknown as PrismaService,
    modelRouter as unknown as AiModelRouterService,
    benchmarkBudget as unknown as AiBenchmarkBudgetService
  );

  return { service, create, benchmarkBudget };
}

function selection() {
  return {
    agent: AiRequestAgent.NUTRITION,
    route: AiModelRoute.LUNA,
    model: 'luna-model',
    inputCostPerMillionUsd: 0.25,
    outputCostPerMillionUsd: 2
  };
}
