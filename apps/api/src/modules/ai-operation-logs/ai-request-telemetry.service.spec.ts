import {
  AiModelRoute,
  AiOperationStatus,
  AiRequestAgent,
  AiRequestOperation
} from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service';
import type { AiModelRouterService } from '../ai-model-routing/ai-model-router.service';
import { AiRequestTelemetryService } from './ai-request-telemetry.service';

describe('AiRequestTelemetryService', () => {
  it('records sanitized token usage and estimated cost', async () => {
    const { service, create } = createService();

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
  });

  it('records a safe error reason and rethrows the provider error', async () => {
    const { service, create } = createService();
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
});

function createService() {
  const create = jest.fn().mockResolvedValue({});
  const prisma = { aiRequestLog: { create } };
  const modelRouter = {
    estimateCostMicrousd: jest.fn(() => 1_250)
  };
  const service = new AiRequestTelemetryService(
    prisma as unknown as PrismaService,
    modelRouter as unknown as AiModelRouterService
  );

  return { service, create };
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
