import { Injectable, Logger } from '@nestjs/common';
import {
  AiOperationProvider,
  AiOperationStatus,
  AiRequestOperation
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  AiModelRouterService,
  type AiModelSelection
} from '../ai-model-routing/ai-model-router.service';
import type { OpenAiResponse } from '../ai/open-ai-client.factory';

export interface ExecuteAiRequestInput {
  userId: string;
  operation: AiRequestOperation;
  selection: AiModelSelection;
  retryAttempt: boolean;
  request: () => Promise<OpenAiResponse>;
}

@Injectable()
export class AiRequestTelemetryService {
  private readonly logger = new Logger(
    AiRequestTelemetryService.name
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly modelRouter: AiModelRouterService
  ) {}

  async execute(input: ExecuteAiRequestInput) {
    const startedAt = Date.now();

    try {
      const response = await input.request();
      const usage = this.readUsage(response);
      await this.recordSafely({
        ...input,
        status: AiOperationStatus.SUCCESS,
        latencyMs: Date.now() - startedAt,
        usage,
        errorReason: null
      });
      return response;
    } catch (error) {
      await this.recordSafely({
        ...input,
        status: AiOperationStatus.ERROR,
        latencyMs: Date.now() - startedAt,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0
        },
        errorReason: this.getSafeErrorReason(error)
      });
      throw error;
    }
  }

  private async recordSafely(
    input: ExecuteAiRequestInput & {
      status: AiOperationStatus;
      latencyMs: number;
      usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      };
      errorReason: string | null;
    }
  ) {
    try {
      await this.prisma.aiRequestLog.create({
        data: {
          userId: input.userId,
          agent: input.selection.agent,
          operation: input.operation,
          route: input.selection.route,
          provider: AiOperationProvider.OPENAI,
          model: input.selection.model,
          status: input.status,
          latencyMs: Math.max(0, Math.trunc(input.latencyMs)),
          retryAttempt: input.retryAttempt,
          inputTokens: input.usage.inputTokens,
          outputTokens: input.usage.outputTokens,
          totalTokens: input.usage.totalTokens,
          estimatedCostMicrousd:
            this.modelRouter.estimateCostMicrousd(
              input.selection,
              input.usage
            ),
          errorReason: input.errorReason
        }
      });
    } catch {
      this.logger.warn(
        'AI request telemetry write failed; provider request continued.'
      );
    }
  }

  private readUsage(response: OpenAiResponse) {
    const inputTokens = this.safeTokenCount(
      response.usage?.input_tokens
    );
    const outputTokens = this.safeTokenCount(
      response.usage?.output_tokens
    );
    const reportedTotal = this.safeTokenCount(
      response.usage?.total_tokens
    );

    return {
      inputTokens,
      outputTokens,
      totalTokens:
        reportedTotal > 0
          ? reportedTotal
          : inputTokens + outputTokens
    };
  }

  private safeTokenCount(value: unknown) {
    return typeof value === 'number' &&
      Number.isFinite(value) &&
      value > 0
      ? Math.trunc(value)
      : 0;
  }

  private getSafeErrorReason(error: unknown) {
    const record =
      typeof error === 'object' && error !== null
        ? (error as Record<string, unknown>)
        : {};
    const status =
      typeof record.status === 'number' ? record.status : null;
    const code =
      typeof record.code === 'string'
        ? record.code.toLowerCase()
        : '';
    const name =
      typeof record.name === 'string'
        ? record.name.toLowerCase()
        : error instanceof Error
          ? error.name.toLowerCase()
          : '';

    if (status === 401 || status === 403) return 'openai_auth_error';
    if (status === 429) return 'openai_rate_limited';
    if (
      status === 408 ||
      code.includes('timeout') ||
      name.includes('timeout')
    ) {
      return 'openai_timeout';
    }
    if (status === 400 && code.includes('model')) {
      return 'openai_invalid_model';
    }
    if (status === 400) return 'openai_bad_request';
    if (
      code.includes('econn') ||
      code.includes('enet') ||
      name.includes('connection')
    ) {
      return 'openai_network_error';
    }

    return 'unknown_openai_error';
  }
}
