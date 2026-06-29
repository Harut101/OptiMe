import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanQualityMode } from '@prisma/client';

import {
  DailyPlanJson,
  dailyPlanJsonSchema
} from '../daily-plans/daily-plan-json.schema';
import { AiProvider, GenerateDailyPlanInput } from './ai-provider.interface';
import { dailyPlanJsonOpenAiSchema } from './daily-plan-json.openai-schema';
import {
  OpenAiClientFactory,
  OpenAiResponse,
  OpenAiResponsesClient,
  OPENAI_CLIENT_FACTORY
} from './open-ai-client.factory';
import { OpenAiFallbackReason, OpenAiProviderError } from './open-ai-provider.error';

type OpenAiAttemptResult =
  | { ok: true; plan: DailyPlanJson }
  | { ok: false; fallbackReason: OpenAiFallbackReason; message: string };

@Injectable()
export class OpenAiProviderService implements AiProvider {
  private readonly logger = new Logger(OpenAiProviderService.name);
  private client: OpenAiResponsesClient | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Inject(OPENAI_CLIENT_FACTORY) private readonly clientFactory: OpenAiClientFactory
  ) {}

  async generateDailyPlan(input: GenerateDailyPlanInput): Promise<DailyPlanJson> {
    this.logger.log('provider called: openai');
    const firstAttempt = await this.requestDailyPlan(input, false);

    if (firstAttempt.ok) {
      this.logger.log('OpenAI plan generation completed without retry');
      return firstAttempt.plan;
    }

    this.logger.warn(
      `OpenAI request/output failed; retrying. reason=${firstAttempt.fallbackReason}`
    );
    const retryAttempt = await this.requestDailyPlan(input, true);

    if (retryAttempt.ok) {
      this.logger.log('OpenAI plan generation completed after retry');
      return retryAttempt.plan;
    }

    throw new OpenAiProviderError(retryAttempt.message, {
      fallbackReason: retryAttempt.fallbackReason
    });
  }

  private async requestDailyPlan(
    input: GenerateDailyPlanInput,
    retry: boolean
  ): Promise<OpenAiAttemptResult> {
    const model = this.getModel();

    try {
      this.logger.log(`OpenAI request started; retryAttempt=${retry}; model=${model}`);
      const response = await this.getClient().responses.create(
        {
          model,
          max_output_tokens: this.getMaxOutputTokens(),
          input: [
            {
              role: 'system',
              content: this.buildSystemInstructions(input, retry)
            },
            {
              role: 'user',
              content: JSON.stringify(this.buildPlanningContext(input))
            }
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'daily_plan_json',
              strict: true,
              schema: dailyPlanJsonOpenAiSchema
            }
          }
        },
        { timeout: this.getRequestTimeoutMs() }
      );

      this.logger.log(`OpenAI response received; retryAttempt=${retry}; model=${model}`);
      return this.parseAndValidateResponse(response, input.planQualityMode);
    } catch (error) {
      if (error instanceof OpenAiProviderError) {
        this.logger.warn(
          `OpenAI provider validation failed; reason=${error.fallbackReason}; retryAttempt=${retry}; model=${model}`
        );
        return {
          ok: false,
          fallbackReason: error.fallbackReason,
          message: error.message
        };
      }

      const classified = this.classifyOpenAiError(error);
      this.logOpenAiSdkError(error, classified, retry, model);

      return {
        ok: false,
        fallbackReason: classified,
        message: this.messageForFallbackReason(classified)
      };
    }
  }

  private parseAndValidateResponse(
    response: OpenAiResponse,
    planQualityMode: PlanQualityMode
  ): OpenAiAttemptResult {
    const outputText = this.extractOutputText(response);
    this.logger.log(`OpenAI output_text present: ${Boolean(outputText)}`);

    if (!outputText) {
      throw new OpenAiProviderError('OpenAI response did not include output_text.', {
        fallbackReason: 'missing_output_text'
      });
    }

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(outputText) as unknown;
      this.logger.log('OpenAI JSON parse passed');
    } catch (error) {
      this.logger.warn('OpenAI JSON parse failed; reason=json_parse_failed');
      throw new OpenAiProviderError('OpenAI response was not valid JSON.', {
        fallbackReason: 'json_parse_failed',
        cause: error
      });
    }

    const normalizedJson = this.normalizeBackendOwnedMetadata(parsedJson, planQualityMode);
    const parsedPlan = dailyPlanJsonSchema.safeParse(normalizedJson);

    if (!parsedPlan.success) {
      this.logger.warn(
        `OpenAI schema validation failed; reason=schema_validation_failed; issues=${parsedPlan.error.issues
          .slice(0, 3)
          .map((issue) => issue.path.join('.') || issue.message)
          .join(', ')}`
      );
      throw new OpenAiProviderError('OpenAI response failed DailyPlanJson validation.', {
        fallbackReason: 'schema_validation_failed',
        cause: parsedPlan.error
      });
    }

    this.logger.log('OpenAI schema validation passed');

    return {
      ok: true,
      plan: {
        ...parsedPlan.data,
        debug: {
          provider: 'openai',
          generatedBy: 'OpenAiProviderService',
          planQualityMode
        } as const
      }
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

  private buildSystemInstructions(input: GenerateDailyPlanInput, retry: boolean) {
    return [
      'You are a supportive AI wellness planning service.',
      'Return only JSON that matches the provided plan content schema.',
      'The backend will set schemaVersion, generatedAt, mockVersion, and debug metadata.',
      'Do not include schemaVersion, generatedAt, mockVersion, or debug.',
      'Use planLocalDate from the user context for any user-facing date reference in title or message.',
      'Never derive user-facing dates from generatedAt.',
      'personalizationContext.nutritionTarget is backend-owned and is the source of truth for calorie and macro targets.',
      'Do not invent calorie or macro targets. Align nutrition.calorieGuidance and nutrition.macroGuidance to personalizationContext.nutritionTarget.',
      'If nutritionTarget.safety.status is NEEDS_MORE_INFO, do not output exact calorie or macro targets; use supportive guidance about completing profile basics.',
      'If nutritionTarget.safety.status is LIMITED, keep wording conservative and avoid deficit or aggressive weight-loss framing.',
      'Keep copy calm, practical, premium, and safe.',
      'Make the plan specific to the provided goal, nutrition preferences, preferred foods, and training schedule.',
      'Use appMode from personalizationContext as the source of truth for whether training is active.',
      'If appMode is NUTRITION_ONLY or trainingEnabled is false, do not generate workout content: use training.intensity REST, training.exercises [], and supportive wording that training is optional.',
      'For nutrition-only mode, keep nutrition useful and complete; do not shame or pressure the user to train.',
      'If appMode is NUTRITION_AND_TRAINING and trainingEnabled is true, use the training schedule and allowedExerciseCandidates normally.',
      'Use gender or sex-related context only as one careful personalization input; do not stereotype nutrition or training by gender.',
      'Do not say women should avoid strength training, women should eat very little, men should always bulk, or men should always lift heavy.',
      'Base recommendations on goal, ability, schedule, preferences, feedback, safety, and recovery-aware signals.',
      'Do not assume pregnancy, postpartum, or breastfeeding status from gender alone.',
      'Keep meals simple, realistic, and easy to understand.',
      'foods[].name must be a clean food or dish name only.',
      'Do not include parenthetical restrictions or allergy/exclusion explanations in foods[].name.',
      'Do not write food names like "Mixed salad (no avocado)", "No-avocado salad", "Avocado-free salad", or "Salad without avocado".',
      'Instead write name: "Mixed salad" and put "Prepared without avocado." in notes.',
      'Allergies and excluded foods must never appear in foods[].name.',
      'Apply the same food safety and clean food name rules to nutrition.menuOptions[].meals[].foods[].name.',
      'Every menu option must avoid allergies and excluded foods.',
      'If you need to mention avoided foods, use notes or reminders with safe avoidance language only.',
      'Use preferred foods when they fit, but never include allergies or excluded foods.',
      'When mentioning allergies or excluded foods, be accurate and do not invent restrictions.',
      'Allergies are hard safety blocks. Excluded foods are preference or restriction blocks.',
      'Do not call excluded foods allergies.',
      'You may mention allergies or excluded foods only to say they are avoided.',
      'Do not use shame, guilt, fear, or body-transformation language.',
      'Do not give medical diagnosis.',
      'Do not recommend extreme dieting, starvation, detoxes, or unsafe calorie restriction.',
      'Do not recommend training through pain, dizziness, illness, fever, exhaustion, or injury.',
      'If recent check-ins indicate pain, discomfort, high tiredness, illness-like notes, or extreme fatigue, reduce training intensity and favor conservative recovery-aware guidance without medical diagnosis.',
      'If summarized health signals are present in personalizationContext.healthPlanningContext, use them conservatively only.',
      'If wearablePlanningContext is present, treat it as optional wellness context only; it may be stale or incomplete.',
      'Apple Health does not provide WHOOP-style recovery or strain scores unless explicit values are present; never invent recoveryScore or strainScore.',
      'If trainingLoadContext has readinessHint CONTROLLED, LIGHT, or RECOVERY_FOCUSED, keep training controlled, reduce intensity or volume when appropriate, and suggest longer rests without cancelling the workout.',
      'Low sleep, high activity, or recent workouts should reduce intensity or favor recovery-aware guidance; never use them to push harder.',
      'If wearableContext.isStale or wearablePlanningContext.isStale is true, or hasRecentData is false, do not personalize strongly from it.',
      'Low step trends may support gentle movement suggestions, but never shame or pressure the user.',
      'Do not mention exact health values unless needed for a practical, non-sensitive explanation.',
      'Do not mention heart rate, resting heart rate, HRV, respiratory rate, or weight values in user-facing text; keep recovery wording general and non-diagnostic.',
      'If selectedProtocols are present in personalizationContext, customize those protocols rather than inventing a conflicting strategy.',
      'Follow selected protocol safetyRules exactly and never override them.',
      'Choose exercise identities only from allowedExerciseCandidates.',
      'Never invent, rename, substitute, or output an unlisted exercise.',
      'Use exerciseId and slug exactly as provided. Do not alter catalog name, target muscles, equipment, instructions, coaching cues, or safety notes.',
      'Return exactly requestedExerciseCount exercise items from the allowed candidates.',
      'Provide only plan-specific order, sets, reps, rest, duration, intensityCue, and notes.',
      'Strength sets must be an integer string from 1 to 5; reps must be a number or safe numeric range up to 30; rest must be 15-300 seconds.',
      'Mobility, cardio, and recovery duration must fit within workoutDurationMinutes.',
      'For all exercise guidance: avoid max-effort, all-out, to-failure, no-pain-no-gain, or advanced progression language when beginner, safeMode, under-18, pregnancy/postpartum/breastfeeding, pain, dizziness, illness, exhaustion, or limitations are present.',
      'Return training.exercises as [] on rest days, no-training-planned days, or when conservative recovery is safer.',
      'Respect safeMode rules for minors: balanced meals, hydration, sleep, recovery, healthy movement, and consistency.',
      'If pregnancyStatus is PREGNANT, POSTPARTUM, or BREASTFEEDING: avoid aggressive weight-loss framing, avoid extreme calorie deficit, avoid unsafe high-intensity recommendations, prefer moderate recovery-aware hydration-aware balanced guidance, and encourage consulting a healthcare provider for personal pregnancy/postpartum/breastfeeding guidance.',
      'For pregnancy, postpartum, or breastfeeding context, do not provide diagnosis or medical claims.',
      'Never include foods listed as allergies or excluded foods.',
      this.buildPlanQualityInstructions(input.planQualityMode),
      retry
        ? 'This is a retry. Be stricter: every required field must be present and valid. If safety feedback is present in the user context, regenerate the complete DailyPlanJson while fixing every listed issue. Do not return partial edits.'
        : 'Generate one practical daily plan.'
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildPlanQualityInstructions(planQualityMode: PlanQualityMode) {
    switch (planQualityMode) {
      case PlanQualityMode.ADAPTIVE:
        return [
          'PlanQualityMode is ADAPTIVE for Pro adaptive coaching.',
          'Return exactly 3 nutrition.menuOptions.',
          'Use menu option focuses such as workout support, recovery/easier digestion, and busy day/simple prep.',
          'Generate a highly individualized plan using goal, preferences, schedule, history, feedback summaries, and readiness placeholders.',
          'Include practical meal timing around workouts when training is scheduled.',
          'Make training recommendations adaptive to goal, recent feedback, schedule, and recovery/readiness placeholders.',
          'For exercise suggestions, be specific and adaptive, but do not create advanced progression blocks yet.',
          'Mention future recovery/sleep/strain signals only as placeholders if relevant; do not invent WHOOP data.'
        ].join('\n');
      case PlanQualityMode.PERSONALIZED:
        return [
          'PlanQualityMode is PERSONALIZED for Plus habit consistency.',
          'Return exactly 2 nutrition.menuOptions.',
          'Use menu option focuses such as balanced standard day and quick/simple prep.',
          'Generate more detailed meals and training than BASIC.',
          'Use preferred foods, excluded foods, training schedule, goal, and feedback/history summaries when available.',
          'For training, suggest exercises based on current schedule, description, duration, intensity, and goal.',
          'Include sets, reps, and rest only when appropriate and safe.'
        ].join('\n');
      case PlanQualityMode.BASIC:
      default:
        return [
          'PlanQualityMode is BASIC for Free useful and safe planning.',
          'Return exactly 1 nutrition.menuOptions item, or one simple primary menu represented consistently in nutrition.meals.',
          'Generate a simple, practical, safe daily plan with limited context.',
          'Keep meals straightforward and training guidance easy to follow.',
          'Include short exercise suggestions only when appropriate; do not include advanced progression.'
        ].join('\n');
    }
  }

  private buildPlanningContext(input: GenerateDailyPlanInput) {
    return {
      planLocalDate: input.planLocalDate,
      planTimezone: input.planTimezone,
      planQualityMode: input.planQualityMode,
      personalizationContext: input.personalizationContext,
      deterministicNutritionTarget: input.personalizationContext.nutritionTarget,
      userFacingDateRule: {
        usePlanLocalDateForTitleAndMessage: true,
        planLocalDate: input.planLocalDate,
        doNotUseGeneratedAtForUserFacingDate: true
      },
      user: {
        firstName: input.user.firstName,
        timezone: input.user.timezone,
        isMinor: input.user.isMinor,
        safeMode: input.safeMode
      },
      profile: input.profile
        ? {
            gender: input.profile.gender,
            pregnancyStatus: input.profile.pregnancyStatus,
            heightCm: input.profile.heightCm,
            weightKg: input.profile.weightKg,
            activityLevel: input.profile.activityLevel
          }
        : null,
      goal: input.goal,
      nutritionPreference: input.nutritionPreference,
      trainingSchedule: input.trainingSchedule,
      appMode: input.personalizationContext.appMode,
      trainingEnabled: input.personalizationContext.trainingEnabled,
      allowedExerciseCandidates: input.exerciseSelection.candidates,
      requestedExerciseCount: input.exerciseSelection.requestedExerciseCount,
      workoutDurationMinutes: input.exerciseSelection.workoutDurationMinutes,
      safetyConstraints: {
        noBodyShaming: true,
        noExtremeDietAdvice: true,
        noMedicalDiagnosis: true,
        noUnsafeTrainingAdvice: true,
        allergiesAreHardSafetyBlocks: input.nutritionPreference?.allergies ?? [],
        excludedFoodsArePreferenceBlocks: input.nutritionPreference?.excludedFoods ?? [],
        mayMentionRestrictedFoodsOnlyToSayTheyAreAvoided: true,
        safeMode: input.safeMode,
        genderUse: 'careful_personalization_only_no_stereotypes',
        pregnancyStatus: input.profile?.pregnancyStatus ?? 'UNKNOWN',
        pregnancySensitiveStatusRequiresConservativeGuidance: [
          'PREGNANT',
          'POSTPARTUM',
          'BREASTFEEDING'
        ].includes(input.profile?.pregnancyStatus ?? 'UNKNOWN'),
        recentCheckInsRequireConservativeTraining:
          input.personalizationContext.checkInSummary?.conservativeTrainingRecommended ?? false,
        noMedicalDiagnosisForCheckInSafetySignals: true
      },
      safetyFeedback: input.safetyFeedback
        ? {
            riskLevel: input.safetyFeedback.riskLevel,
            reasons: input.safetyFeedback.reasons,
            requiredChanges: input.safetyFeedback.requiredChanges,
            instruction:
              'Regenerate the complete plan while addressing these safety review findings.'
          }
          : undefined,
      exerciseFeedback: input.exerciseFeedback
        ? {
            reasonCodes: input.exerciseFeedback.reasonCodes,
            instruction: 'Regenerate the complete plan using only allowed exercise IDs and valid conservative prescriptions.'
          }
        : undefined
    };
  }

  private normalizeBackendOwnedMetadata(value: unknown, planQualityMode: PlanQualityMode) {
    const record = typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
    this.logger.log('OpenAI metadata normalized');

    return {
      ...record,
      schemaVersion: 'sprint-2.v1',
      generatedAt: new Date().toISOString(),
      mockVersion: 0,
      debug: {
        provider: 'openai',
        generatedBy: 'OpenAiProviderService',
        planQualityMode
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
      throw new OpenAiProviderError('OPENAI_API_KEY is required when AI_PROVIDER=openai.', {
        fallbackReason: 'openai_auth_error'
      });
    }

    return apiKey;
  }

  private getModel() {
    const model = this.configService.get<string>('OPENAI_DEFAULT_MODEL');

    if (!model) {
      throw new OpenAiProviderError('OPENAI_DEFAULT_MODEL is required when AI_PROVIDER=openai.', {
        fallbackReason: 'openai_invalid_model'
      });
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

  private classifyOpenAiError(error: unknown): OpenAiFallbackReason {
    const details = this.getSafeErrorDetails(error);
    const message = details.message.toLowerCase();
    const code = details.code.toLowerCase();
    const type = details.type.toLowerCase();

    if (details.status === 401 || details.status === 403) {
      return 'openai_auth_error';
    }

    if (details.status === 429) {
      return 'openai_rate_limited';
    }

    if (details.status === 408 || message.includes('timeout') || code.includes('timeout')) {
      return 'openai_timeout';
    }

    if (
      code.includes('model') ||
      type.includes('model') ||
      message.includes('model') ||
      message.includes('does not exist')
    ) {
      return 'openai_invalid_model';
    }

    if (
      details.status === 400 &&
      (message.includes('json_schema') ||
        message.includes('schema') ||
        message.includes('text.format') ||
        message.includes('response_format'))
    ) {
      return 'openai_structured_output_request_invalid';
    }

    if (details.status === 400) {
      return 'openai_bad_request';
    }

    if (
      !details.status &&
      (code.includes('econn') ||
        code.includes('enet') ||
        code.includes('fetch') ||
        message.includes('network') ||
        message.includes('connection'))
    ) {
      return 'openai_network_error';
    }

    return 'unknown_openai_error';
  }

  private logOpenAiSdkError(
    error: unknown,
    fallbackReason: OpenAiFallbackReason,
    retryAttempt: boolean,
    model: string
  ) {
    const details = this.getSafeErrorDetails(error);
    this.logger.error(
      [
        'OpenAI SDK error',
        `reason=${fallbackReason}`,
        `retryAttempt=${retryAttempt}`,
        `model=${model}`,
        `name=${details.name}`,
        `message=${details.message}`,
        `status=${details.status ?? 'none'}`,
        `code=${details.code || 'none'}`,
        `type=${details.type || 'none'}`
      ].join('; ')
    );
  }

  private getSafeErrorDetails(error: unknown) {
    const record = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {};

    return {
      name: typeof record.name === 'string' ? record.name : error instanceof Error ? error.name : 'UnknownError',
      message:
        typeof record.message === 'string'
          ? record.message
          : error instanceof Error
            ? error.message
            : 'No error message',
      status: typeof record.status === 'number' ? record.status : undefined,
      code: typeof record.code === 'string' ? record.code : '',
      type: typeof record.type === 'string' ? record.type : ''
    };
  }

  private messageForFallbackReason(reason: OpenAiFallbackReason) {
    return reason;
  }
}
