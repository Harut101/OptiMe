import { Injectable, Logger } from '@nestjs/common';
import { AiOperationFeature, AiOperationProvider, AiOperationStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface RecordAiOperationLogInput {
  userId: string;
  feature: AiOperationFeature;
  provider: AiOperationProvider;
  model?: string | null;
  status: AiOperationStatus;
  latencyMs: number;
  retryCount?: number;
  safetyAgentEnabled: boolean;
  safetyAgentProvider?: string | null;
  safetyAgentApproved?: boolean | null;
  fallbackReason?: string | null;
  errorReason?: string | null;
}

@Injectable()
export class AiOperationLogsService {
  private readonly logger = new Logger(AiOperationLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAiOperationLogInput) {
    try {
      await this.prisma.aiOperationLog.create({
        data: {
          userId: input.userId,
          feature: input.feature,
          provider: input.provider,
          model: input.model ?? null,
          status: input.status,
          latencyMs: Math.max(0, Math.trunc(input.latencyMs)),
          retryCount: Math.max(0, Math.trunc(input.retryCount ?? 0)),
          safetyAgentEnabled: input.safetyAgentEnabled,
          safetyAgentProvider: input.safetyAgentProvider ?? null,
          safetyAgentApproved: input.safetyAgentApproved ?? null,
          fallbackReason: input.fallbackReason ?? null,
          errorReason: input.errorReason ?? null
        }
      });
    } catch {
      this.logger.warn('AI operation log write failed; daily plan generation continued.');
    }
  }
}
