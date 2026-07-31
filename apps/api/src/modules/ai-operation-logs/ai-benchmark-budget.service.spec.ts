import { ConfigService } from '@nestjs/config';
import { AiModelRoute, AiRequestAgent } from '@prisma/client';

import {
  AiBenchmarkBudgetError,
  AiBenchmarkBudgetService
} from './ai-benchmark-budget.service';

describe('AiBenchmarkBudgetService', () => {
  it('is passive outside benchmark mode', () => {
    const service = createService({});

    expect(service.reserve(selection())).toBeNull();
    expect(service.snapshot()).toMatchObject({
      enabled: false,
      requestCount: 0,
      spentUsd: 0
    });
  });

  it('requires explicit real-call opt-in in benchmark mode', () => {
    const service = createService({ AI_BENCHMARK_MODE: 'true' });

    expect(() => service.reserve(selection())).toThrow(
      'Real OpenAI benchmark calls are disabled.'
    );
  });

  it('stops before a request can exceed the configured cost cap', () => {
    const service = createService({
      AI_BENCHMARK_MODE: 'true',
      AI_BENCHMARK_REAL_CALLS_ENABLED: 'true',
      AI_BENCHMARK_MAX_COST_USD: '0.08',
      AI_BENCHMARK_MAX_INPUT_TOKENS_PER_REQUEST: '10000',
      OPENAI_MAX_OUTPUT_TOKENS: '4000',
      AI_BENCHMARK_COST_SAFETY_MULTIPLIER: '1'
    });

    expect(() => service.reserve(selection())).toThrow(
      AiBenchmarkBudgetError
    );
    expect(service.snapshot()).toMatchObject({
      requestCount: 0,
      spentUsd: 0,
      exhausted: true
    });
  });

  it('releases the reservation and tracks conservative actual cost', () => {
    const service = createService({
      AI_BENCHMARK_MODE: 'true',
      AI_BENCHMARK_REAL_CALLS_ENABLED: 'true',
      AI_BENCHMARK_MAX_COST_USD: '10',
      AI_BENCHMARK_MAX_INPUT_TOKENS_PER_REQUEST: '10000',
      OPENAI_MAX_OUTPUT_TOKENS: '1000',
      AI_BENCHMARK_COST_SAFETY_MULTIPLIER: '1.5'
    });

    const reservation = service.reserve(selection());
    service.settleSuccess(reservation, 20_000);

    expect(service.snapshot()).toMatchObject({
      requestCount: 1,
      spentUsd: 0.03,
      reservedUsd: 0,
      exhausted: false
    });
  });

  it('never allows configuration above the hard ten-dollar cap', () => {
    expect(() =>
      createService({ AI_BENCHMARK_MAX_COST_USD: '10.01' })
    ).toThrow('AI_BENCHMARK_MAX_COST_USD cannot exceed 10.');
  });

  it('refuses unpriced model routes before making a request', () => {
    const service = createService({
      AI_BENCHMARK_MODE: 'true',
      AI_BENCHMARK_REAL_CALLS_ENABLED: 'true'
    });

    expect(() =>
      service.reserve({
        ...selection(),
        inputCostPerMillionUsd: 0
      })
    ).toThrow('Benchmark pricing is missing for route TERRA.');
  });
});

function createService(values: Record<string, string>) {
  const config = {
    get: (key: string) => values[key]
  } as ConfigService;

  return new AiBenchmarkBudgetService(config);
}

function selection() {
  return {
    agent: AiRequestAgent.DAILY_PLAN,
    route: AiModelRoute.TERRA,
    model: 'benchmark-model',
    inputCostPerMillionUsd: 2.5,
    outputCostPerMillionUsd: 15
  };
}
