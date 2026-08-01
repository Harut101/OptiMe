import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiRequestAgent,
  AiRequestOperation
} from '@prisma/client';

import { AiModelRouterService } from '../ai-model-routing/ai-model-router.service';
import { AiRequestTelemetryService } from '../ai-operation-logs/ai-request-telemetry.service';
import {
  OpenAiClientFactory,
  OpenAiResponse,
  OpenAiResponsesClient,
  OPENAI_CLIENT_FACTORY
} from '../ai/open-ai-client.factory';
import { resolveOpenAiOutputTokenBudget } from '../ai/open-ai-output-token-budget';
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
    private readonly modelRouter: AiModelRouterService,
    private readonly requestTelemetry: AiRequestTelemetryService,
    @Inject(OPENAI_CLIENT_FACTORY) private readonly clientFactory: OpenAiClientFactory
  ) {}

  async reviewDailyPlan(input: ReviewDailyPlanInput): Promise<SafetyAgentReview> {
    const selection = this.modelRouter.resolve({
      agent: AiRequestAgent.SAFETY,
      planQualityMode: input.planQualityMode
    });
    const model = selection.model;

    try {
      this.logger.log(`SafetyAgent OpenAI request started; provider=openai; model=${model}`);
      const response = await this.requestTelemetry.execute({
        userId: input.userId,
        operation: AiRequestOperation.SAFETY_REVIEW,
        selection,
        retryAttempt: input.retryAttempt,
        request: () =>
          this.getClient().responses.create(
            {
              model,
              max_output_tokens:
                resolveOpenAiOutputTokenBudget(
                  this.configService,
                  'OPENAI_SAFETY_MAX_OUTPUT_TOKENS',
                  4_000
                ),
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
          )
      });

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
      'Review semantic safety only: unsafe diet advice, extreme calorie restriction, starvation or skip-meal advice, unsafe training advice, unsafe exercise recommendations, body-shaming, guilt language, medical diagnosis, unsupported supplement or medical claims, aggressive weight-loss framing, and conflicts with safeMode.',
      'Review nutrition.foodPlan when present: meal titles, ingredients, preparation steps, substitutions, and explanations must be supportive, non-restrictive, and compatible with the deterministic nutrition target status.',
      'Reject food plans that imply fasting, detoxing, starvation, punishment, hidden restriction, medical treatment, or aggressive weight-loss claims.',
      'Do not reject a plan merely because it names an allergy or excluded food in order to avoid it, for example "avoid avocado" or "prepared without avocado". Deterministic checks already block actual restricted ingredients.',
      'Review training.exercises when present. Reject unsafe progression, max-effort beginner advice, training through pain/dizziness/illness/exhaustion/injury, unsafe exercise advice for pregnancy/postpartum/breastfeeding, under-18 unsafe intensity, and guidance that conflicts with limitations.',
      'Review trainingLoadAgentSnapshot when present. Reject unsafe workload advice, medical diagnosis language, instructions to push through pain, instructions to cancel automatically, exercise replacement claims, or contradictions with recovery-focused, light, safeMode, under-18, pregnancy/postpartum/breastfeeding, or pain/limitation context.',
      'Reject gender-stereotyped recommendations, body-shaming gendered language, or assumptions based on gender alone.',
      'Reject advice that says women should avoid strength training, women should eat very little, men should always bulk, or men should always lift heavy.',
      'If pregnancyStatus is PREGNANT, POSTPARTUM, or BREASTFEEDING, reject unsafe high-intensity recommendations, aggressive weight-loss framing, extreme calorie deficits, medical diagnosis language, or guidance that should be personalized by a healthcare provider.',
      'For pregnancy, postpartum, or breastfeeding context, general wellness guidance is okay when conservative, hydration-aware, recovery-aware, balanced, and non-diagnostic.',
      'For under-18 or safeMode plans, require balanced meals, hydration, sleep, recovery, healthy movement, and supportive consistency language.',
      'Approve the plan when deterministic checks passed and you cannot identify a concrete material safety violation in the actual plan text.',
      'Do not reject for genericness, a missing optional preference, conservative intensity, a style preference, cautious wellness wording, or a desire for a more personalized plan.',
      'Use approved=true and riskLevel=low for non-blocking editorial or quality observations; leave reasons and requiredChanges empty.',
      'Reject only for a concrete material safety violation. Every rejection must name the unsafe category and the exact correction needed; use medium only for a remediable material violation and high only for an immediate or severe safety concern.',
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
        reviewTrainingExercises: true,
        noUnsafeExerciseProgression: true,
        noTrainingThroughPainOrSymptoms: true,
        reviewTrainingLoadAgentSnapshot: Boolean(input.plan.trainingLoadAgentSnapshot),
        trainingLoadAgentReadiness: input.plan.trainingLoadAgentSnapshot?.readiness ?? null,
        trainingLoadAgentAdjustments: input.plan.trainingLoadAgentSnapshot?.adjustments ?? null,
        safeMode: input.deterministicSafetyContext.safeMode,
        isMinor: input.deterministicSafetyContext.isMinor,
        gender: input.deterministicSafetyContext.gender ?? null,
        pregnancyStatus: input.deterministicSafetyContext.pregnancyStatus ?? 'UNKNOWN',
        noGenderStereotypes: true,
        pregnancyPostpartumBreastfeedingSafety:
          input.deterministicSafetyContext.pregnancyStatus === 'PREGNANT' ||
          input.deterministicSafetyContext.pregnancyStatus === 'POSTPARTUM' ||
          input.deterministicSafetyContext.pregnancyStatus === 'BREASTFEEDING'
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

  private getRequestTimeoutMs() {
    return this.getPositiveIntConfig('OPENAI_REQUEST_TIMEOUT_MS', 45_000);
  }

  private getPositiveIntConfig(key: string, fallback: number) {
    const value = Number(this.configService.get<string>(key));
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
  }
}
