import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  OpenAiClientFactory,
  OpenAiResponse,
  OpenAiResponsesClient,
  OPENAI_CLIENT_FACTORY
} from '../ai/open-ai-client.factory';
import { SafetyAgent, ReviewDailyPlanInput } from './safety-agent.interface';
import { SafetyAgentError } from './safety-agent.error';
import { safetyAgentReviewOpenAiSchema } from './safety-agent-review.openai-schema';
import {
  SafetyAgentReview,
  safetyAgentReviewSchema
} from './safety-agent-review.schema';

@Injectable()
export class OpenAiSafetyAgentService implements SafetyAgent {
  private readonly logger = new Logger(OpenAiSafetyAgentService.name);
  private client: OpenAiResponsesClient | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Inject(OPENAI_CLIENT_FACTORY) private readonly clientFactory: OpenAiClientFactory
  ) {}

  async reviewDailyPlan(input: ReviewDailyPlanInput): Promise<SafetyAgentReview> {
    const model = this.getModel();

    try {
      this.logger.log(`SafetyAgent OpenAI request started; provider=openai; model=${model}`);
      const response = await this.getClient().responses.create(
        {
          model,
          max_output_tokens: this.getMaxOutputTokens(),
          input: [
            {
              role: 'system',
              content: this.buildSystemInstructions()
            },
            {
              role: 'user',
              content: JSON.stringify(this.buildReviewContext(input))
            }
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'safety_agent_review',
              strict: true,
              schema: safetyAgentReviewOpenAiSchema
            }
          }
        },
        { timeout: this.getRequestTimeoutMs() }
      );

      this.logger.log('SafetyAgent OpenAI response received; provider=openai');
      const review = this.parseAndValidateResponse(response);
      this.logger.log(
        [
          'SafetyAgent OpenAI review validated',
          `approved=${review.approved}`,
          `riskLevel=${review.riskLevel}`,
          `reasonCount=${review.reasons.length}`
        ].join('; ')
      );

      return review;
    } catch (error) {
      if (error instanceof SafetyAgentError) {
        throw error;
      }

      this.logger.warn('SafetyAgent OpenAI request failed; fallback reason=safety_agent_unavailable');
      throw new SafetyAgentError(
        'OpenAI Safety Agent is unavailable.',
        'safety_agent_unavailable'
      );
    }
  }

  private parseAndValidateResponse(response: OpenAiResponse) {
    const outputText = this.extractOutputText(response);
    this.logger.log(`SafetyAgent output_text present=${Boolean(outputText)}`);

    if (!outputText) {
      throw new SafetyAgentError(
        'OpenAI Safety Agent response did not include output_text.',
        'safety_agent_invalid_review'
      );
    }

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(outputText);
    } catch {
      this.logger.warn('SafetyAgent JSON parse failed; fallback reason=safety_agent_invalid_review');
      throw new SafetyAgentError(
        'OpenAI Safety Agent response was not valid JSON.',
        'safety_agent_invalid_review'
      );
    }

    const parsedReview = safetyAgentReviewSchema.safeParse(this.normalizeReview(parsedJson));

    if (!parsedReview.success) {
      this.logger.warn(
        `SafetyAgent review validation failed; fallback reason=safety_agent_invalid_review; issueCount=${parsedReview.error.issues.length}`
      );
      throw new SafetyAgentError(
        'OpenAI Safety Agent response failed validation.',
        'safety_agent_invalid_review'
      );
    }

    return parsedReview.data;
  }

  private normalizeReview(value: unknown) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return value;
    }

    const record = value as Record<string, unknown>;

    return {
      ...record,
      safeUserMessage:
        typeof record.safeUserMessage === 'string' && record.safeUserMessage.trim().length > 0
          ? record.safeUserMessage
          : undefined
    };
  }

  private extractOutputText(response: OpenAiResponse) {
    if (typeof response.output_text === 'string') {
      return response.output_text;
    }

    return (
      response.output
        ?.flatMap((item) => item.content ?? [])
        .find((content) => content.type === 'output_text' && typeof content.text === 'string')
        ?.text ?? null
    );
  }

  private buildSystemInstructions() {
    return [
      'You are an AI Safety Agent for a wellness planning product.',
      'Return only structured JSON matching the SafetyAgentReview schema.',
      'You do not replace deterministic backend hard rules.',
      'Deterministic rules already checked allergies, excluded foods, safeMode hard rules, under-18 hard rules, dangerous goals, schema, and training boundaries.',
      'Review semantic safety only: unsafe diet advice, extreme calorie restriction, starvation or skip-meal advice, unsafe training advice, body-shaming, guilt language, medical diagnosis, unsupported supplement or medical claims, aggressive weight-loss framing, and conflicts with safeMode.',
      'For under-18 or safeMode plans, require balanced meals, hydration, sleep, recovery, healthy movement, and supportive consistency language.',
      'Approve only low-risk plans.',
      'If rejecting, provide concise reasons and specific requiredChanges for a future retry.',
      'safeUserMessage must be calm, supportive, non-shaming, and user-safe.'
    ].join('\n');
  }

  private buildReviewContext(input: ReviewDailyPlanInput) {
    return {
      plan: input.plan,
      safeMode: input.safeMode,
      ageGroup: input.deterministicSafetyContext.isMinor ? 'under_18' : 'adult',
      goalSummary: input.goalSummary,
      safetyConstraints: {
        deterministicSafetyPassed: input.deterministicSafetyContext.deterministicSafetyPassed,
        noBodyShaming: true,
        noExtremeDietAdvice: true,
        noMedicalDiagnosis: true,
        noUnsafeTrainingAdvice: true,
        safeMode: input.deterministicSafetyContext.safeMode,
        isMinor: input.deterministicSafetyContext.isMinor
      }
    };
  }

  private getClient() {
    if (!this.client) {
      this.client = this.clientFactory(this.getApiKey());
    }

    return this.client;
  }

  private getApiKey() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      throw new SafetyAgentError(
        'OPENAI_API_KEY is required when SAFETY_AGENT_PROVIDER=openai.',
        'safety_agent_unavailable'
      );
    }

    return apiKey;
  }

  private getModel() {
    const model = this.configService.get<string>('OPENAI_DEFAULT_MODEL');

    if (!model) {
      throw new SafetyAgentError(
        'OPENAI_DEFAULT_MODEL is required when SAFETY_AGENT_PROVIDER=openai.',
        'safety_agent_unavailable'
      );
    }

    return model;
  }

  private getRequestTimeoutMs() {
    return this.getPositiveIntConfig('OPENAI_REQUEST_TIMEOUT_MS', 45_000);
  }

  private getMaxOutputTokens() {
    return this.getPositiveIntConfig('OPENAI_MAX_OUTPUT_TOKENS', 4_000);
  }

  private getPositiveIntConfig(key: string, fallback: number) {
    const value = Number(this.configService.get<string>(key));
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
  }
}
