import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AiModelSelection } from '../ai-model-routing/ai-model-router.service';

const HARD_MAX_BUDGET_USD = 10;

export interface AiBenchmarkBudgetReservation {
  reservedMicrousd: number;
}

@Injectable()
export class AiBenchmarkBudgetService {
  private readonly logger = new Logger(AiBenchmarkBudgetService.name);
  private readonly enabled: boolean;
  private readonly realCallsEnabled: boolean;
  private readonly maxCostMicrousd: number;
  private readonly maxRequests: number;
  private readonly maxInputTokensPerRequest: number;
  private readonly maxOutputTokensPerRequest: number;
  private readonly safetyMultiplier: number;
  private spentMicrousd = 0;
  private reservedMicrousd = 0;
  private requestCount = 0;
  private exhausted = false;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.readBoolean('AI_BENCHMARK_MODE', false);
    this.realCallsEnabled = this.readBoolean(
      'AI_BENCHMARK_REAL_CALLS_ENABLED',
      false
    );
    const maxCostUsd = this.readPositiveNumber(
      'AI_BENCHMARK_MAX_COST_USD',
      HARD_MAX_BUDGET_USD
    );

    if (maxCostUsd > HARD_MAX_BUDGET_USD) {
      throw new Error(
        `AI_BENCHMARK_MAX_COST_USD cannot exceed ${HARD_MAX_BUDGET_USD}.`
      );
    }

    this.maxCostMicrousd = Math.round(maxCostUsd * 1_000_000);
    this.maxRequests = this.readPositiveInteger(
      'AI_BENCHMARK_MAX_REQUESTS',
      300
    );
    this.maxInputTokensPerRequest = this.readPositiveInteger(
      'AI_BENCHMARK_MAX_INPUT_TOKENS_PER_REQUEST',
      100_000
    );
    this.maxOutputTokensPerRequest = this.readPositiveInteger(
      'OPENAI_MAX_OUTPUT_TOKENS',
      4_000
    );
    this.safetyMultiplier = this.readPositiveNumber(
      'AI_BENCHMARK_COST_SAFETY_MULTIPLIER',
      1.5
    );
  }

  reserve(selection: AiModelSelection): AiBenchmarkBudgetReservation | null {
    if (!this.enabled) return null;
    if (!this.realCallsEnabled) {
      throw new AiBenchmarkBudgetError(
        'ai_benchmark_real_calls_disabled',
        'Real OpenAI benchmark calls are disabled.'
      );
    }
    if (
      selection.inputCostPerMillionUsd === null ||
      selection.outputCostPerMillionUsd === null ||
      selection.inputCostPerMillionUsd <= 0 ||
      selection.outputCostPerMillionUsd <= 0
    ) {
      throw new AiBenchmarkBudgetError(
        'ai_benchmark_model_price_missing',
        `Benchmark pricing is missing for route ${selection.route}.`
      );
    }
    if (this.requestCount >= this.maxRequests) {
      this.exhausted = true;
      throw new AiBenchmarkBudgetError(
        'ai_benchmark_request_limit_reached',
        'AI benchmark request limit reached.'
      );
    }

    const reservedMicrousd = Math.ceil(
      (this.maxInputTokensPerRequest * selection.inputCostPerMillionUsd +
        this.maxOutputTokensPerRequest * selection.outputCostPerMillionUsd) *
        this.safetyMultiplier
    );

    if (
      this.spentMicrousd +
        this.reservedMicrousd +
        reservedMicrousd >
      this.maxCostMicrousd
    ) {
      this.exhausted = true;
      throw new AiBenchmarkBudgetError(
        'ai_benchmark_cost_limit_reached',
        'AI benchmark cost limit reached.'
      );
    }

    this.requestCount += 1;
    this.reservedMicrousd += reservedMicrousd;
    return { reservedMicrousd };
  }

  settleSuccess(
    reservation: AiBenchmarkBudgetReservation | null,
    actualCostMicrousd: number | null
  ) {
    if (!reservation) return;

    this.reservedMicrousd = Math.max(
      0,
      this.reservedMicrousd - reservation.reservedMicrousd
    );
    const conservativeActual = Math.ceil(
      Math.max(0, actualCostMicrousd ?? reservation.reservedMicrousd) *
        this.safetyMultiplier
    );
    this.spentMicrousd += Math.min(
      reservation.reservedMicrousd,
      conservativeActual
    );
    this.logProgress();
  }

  settleFailure(reservation: AiBenchmarkBudgetReservation | null) {
    if (!reservation) return;

    this.reservedMicrousd = Math.max(
      0,
      this.reservedMicrousd - reservation.reservedMicrousd
    );
    // Provider failures may not report usage. Charge the reservation so the
    // controlled run remains conservative rather than silently overspending.
    this.spentMicrousd += reservation.reservedMicrousd;
    this.logProgress();
  }

  snapshot() {
    return {
      enabled: this.enabled,
      realCallsEnabled: this.realCallsEnabled,
      requestCount: this.requestCount,
      maxRequests: this.maxRequests,
      spentUsd: this.spentMicrousd / 1_000_000,
      reservedUsd: this.reservedMicrousd / 1_000_000,
      maxCostUsd: this.maxCostMicrousd / 1_000_000,
      remainingUsd:
        Math.max(
          0,
          this.maxCostMicrousd - this.spentMicrousd - this.reservedMicrousd
        ) / 1_000_000,
      exhausted: this.exhausted
    };
  }

  private logProgress() {
    this.logger.log(
      `AI benchmark budget; requests=${this.requestCount}/${this.maxRequests}; conservativeSpentUsd=${(
        this.spentMicrousd / 1_000_000
      ).toFixed(4)}; maxUsd=${(this.maxCostMicrousd / 1_000_000).toFixed(2)}`
    );
  }

  private readBoolean(key: string, fallback: boolean) {
    const value = this.configService.get<string>(key)?.trim().toLowerCase();
    if (!value) return fallback;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`${key} must be true or false.`);
  }

  private readPositiveInteger(key: string, fallback: number) {
    const value = Number(this.configService.get<string>(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private readPositiveNumber(key: string, fallback: number) {
    const value = Number(this.configService.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}

export class AiBenchmarkBudgetError extends Error {
  constructor(
    public readonly reason: string,
    message: string
  ) {
    super(message);
    this.name = 'AiBenchmarkBudgetError';
  }
}
