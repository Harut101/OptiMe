import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoalImpactMode, PlanQualityMode, TrainingLevel } from '@prisma/client';

import type { GenerateDailyPlanPersonalizationContext } from '../ai/ai-provider.interface';
import {
  OpenAiClientFactory,
  OpenAiResponse,
  OpenAiResponsesClient,
  OPENAI_CLIENT_FACTORY
} from '../ai/open-ai-client.factory';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import {
  trainingLoadAgentSnapshotSchema,
  type TrainingLoadAgentSnapshot
} from '../daily-plans/daily-plan-json.schema';
import type { ExerciseSelectionResult } from '../exercise-selection/exercise-selection.types';
import type { ResolvedTrainingDayContext, SupportedLocale } from '@optime/shared-types';
import { trainingLoadAgentOpenAiSchema } from './training-load-agent.openai-schema';

export interface GenerateTrainingLoadAgentInput {
  planLocalDate: string;
  locale: SupportedLocale;
  appMode: GoalImpactMode;
  safeMode: boolean;
  isMinor: boolean;
  planQualityMode: PlanQualityMode;
  trainingLevel: TrainingLevel | null;
  resolvedTrainingDay: ResolvedTrainingDayContext;
  personalizationContext: GenerateDailyPlanPersonalizationContext;
  exerciseSelection: ExerciseSelectionResult;
  planTraining: DailyPlanJson['training'];
}

type AgentAttemptResult =
  | { ok: true; snapshot: TrainingLoadAgentSnapshot }
  | { ok: false; reasons: string[] };

@Injectable()
export class TrainingLoadAgentService {
  private readonly logger = new Logger(TrainingLoadAgentService.name);
  private client: OpenAiResponsesClient | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Inject(OPENAI_CLIENT_FACTORY) private readonly clientFactory: OpenAiClientFactory
  ) {}

  async generate(input: GenerateTrainingLoadAgentInput): Promise<TrainingLoadAgentSnapshot> {
    if (this.configService.get<string>('AI_PROVIDER', 'mock').toLowerCase() !== 'openai') {
      return this.createFallback(input, ['mock_mode']);
    }

    const firstAttempt = await this.requestAgentSnapshot(input, false);
    if (firstAttempt.ok) return firstAttempt.snapshot;

    this.logger.warn(
      `TrainingLoadAgent output invalid; retrying; reasons=${firstAttempt.reasons.slice(0, 4).join(',')}`
    );
    const retryAttempt = await this.requestAgentSnapshot(input, true, firstAttempt.reasons);
    if (retryAttempt.ok) return retryAttempt.snapshot;

    this.logger.warn(
      `TrainingLoadAgent fallback used=true; reasons=${retryAttempt.reasons.slice(0, 4).join(',')}`
    );
    return this.createFallback(input, retryAttempt.reasons);
  }

  createFallback(input: GenerateTrainingLoadAgentInput, validationReasons: string[] = []): TrainingLoadAgentSnapshot {
    const context = input.personalizationContext.healthPlanningContext?.trainingLoadContext;
    const workoutReasons = input.exerciseSelection.volumePlan.volumeReasonCodes;
    const noTraining =
      input.appMode === GoalImpactMode.NUTRITION_ONLY ||
      !input.resolvedTrainingDay.isTrainingDay ||
      input.exerciseSelection.requestedExerciseCount === 0;
    const hasWearableData =
      input.personalizationContext.healthPlanningContext?.wearablePlanningContext.hasWearableData ?? false;
    const readiness = noTraining
      ? 'UNKNOWN'
      : context?.readinessHint && context.readinessHint !== 'UNKNOWN'
        ? context.readinessHint
        : hasWearableData
          ? 'NORMAL'
          : 'UNKNOWN';
    const controlled =
      readiness === 'CONTROLLED' || readiness === 'LIGHT' || readiness === 'RECOVERY_FOCUSED';
    const reasonCodes = new Set<TrainingLoadAgentSnapshot['reasonCodes'][number]>();

    if (readiness === 'NORMAL') reasonCodes.add('NORMAL_ROUTINE');
    if (!hasWearableData) reasonCodes.add('NO_RECENT_WEARABLE_DATA');
    if (context?.reasons.includes('LOW_SLEEP')) reasonCodes.add('LOW_SLEEP_CONTEXT');
    if (context?.reasons.includes('HIGH_ACTIVITY')) reasonCodes.add('HIGH_ACTIVITY_CONTEXT');
    if (context?.reasons.includes('RECENT_WORKOUT_LOAD')) reasonCodes.add('RECENT_WORKOUT_LOAD');
    if (context?.reasons.includes('PARTIAL_WEARABLE_DATA')) reasonCodes.add('PARTIAL_WEARABLE_DATA');
    if (readiness === 'RECOVERY_FOCUSED') reasonCodes.add('RECOVERY_FOCUSED_CONTEXT');
    if (input.trainingLevel === TrainingLevel.BEGINNER) reasonCodes.add('BEGINNER_LEVEL');
    if (workoutReasons.some((reason) => reason.endsWith('_REDUCTION') || reason.includes('DURATION'))) {
      reasonCodes.add('DURATION_VOLUME_LIMIT');
    }
    if (input.safeMode || input.isMinor) reasonCodes.add('SAFETY_LIMITED_CONTEXT');

    return {
      source: 'DETERMINISTIC_FALLBACK',
      readiness,
      adjustments: {
        intensity: controlled ? 'REDUCE' : readiness === 'UNKNOWN' ? 'UNKNOWN' : 'NORMAL',
        volume: readiness === 'RECOVERY_FOCUSED' || readiness === 'LIGHT' ? 'REDUCE' : readiness === 'UNKNOWN' ? 'UNKNOWN' : 'NORMAL',
        restTime: controlled ? 'INCREASE' : readiness === 'UNKNOWN' ? 'UNKNOWN' : 'NORMAL'
      },
      reasonCodes: Array.from(reasonCodes).slice(0, 12),
      userFacingSummary: this.getFallbackSummary(readiness, hasWearableData, controlled),
      trainingGuidanceBullets: controlled
        ? [
            'Keep the session controlled and leave effort in reserve.',
            'Take longer rests if breathing, soreness, or energy feels off.'
          ]
        : [
            hasWearableData
              ? "Today's workout can follow your usual plan."
              : "Today's workout uses your saved routine and preferences."
          ],
      exerciseCautions: controlled
        ? input.planTraining.exercises?.slice(0, 2).map((exercise) => ({
            exerciseId: exercise.exerciseId ?? null,
            exerciseSlug: exercise.slug ?? null,
            planExerciseKey: null,
            cautionCode: 'KEEP_CONTROLLED' as const,
            message: 'Use a steady pace and stop if discomfort increases.'
          })) ?? []
        : [],
      validation: {
        status: validationReasons.length ? 'FALLBACK' : 'VALID',
        reasons: validationReasons.slice(0, 12)
      }
    };
  }

  private async requestAgentSnapshot(
    input: GenerateTrainingLoadAgentInput,
    retry: boolean,
    validationFeedback: string[] = []
  ): Promise<AgentAttemptResult> {
    const model = this.getModel();

    try {
      this.logger.log(`TrainingLoadAgent OpenAI request started; retryAttempt=${retry}; model=${model}`);
      const response = await this.getClient().responses.create(
        {
          model,
          max_output_tokens: this.getMaxOutputTokens(),
          input: [
            { role: 'system', content: this.buildSystemInstructions(retry) },
            { role: 'user', content: JSON.stringify(this.buildContext(input, validationFeedback)) }
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'training_load_agent_snapshot',
              strict: true,
              schema: trainingLoadAgentOpenAiSchema
            }
          }
        },
        { timeout: this.getRequestTimeoutMs() }
      );
      this.logger.log(`TrainingLoadAgent OpenAI response received; retryAttempt=${retry}; model=${model}`);
      return this.parseAndValidateResponse(response, input);
    } catch (error) {
      this.logger.warn(
        `TrainingLoadAgent request failed; retryAttempt=${retry}; reason=${error instanceof Error ? error.name : 'unknown_error'}`
      );
      return { ok: false, reasons: ['training_load_agent_request_failed'] };
    }
  }

  private parseAndValidateResponse(
    response: OpenAiResponse,
    input: GenerateTrainingLoadAgentInput
  ): AgentAttemptResult {
    const outputText = this.extractOutputText(response);
    if (!outputText) return { ok: false, reasons: ['missing_output_text'] };

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(outputText);
    } catch {
      return { ok: false, reasons: ['json_parse_failed'] };
    }

    const candidate = {
      ...(typeof parsedJson === 'object' && parsedJson !== null && !Array.isArray(parsedJson)
        ? parsedJson
        : {}),
      source: 'AI_TRAINING_LOAD_AGENT',
      validation: {
        status: 'VALID',
        reasons: []
      }
    };
    const parsed = trainingLoadAgentSnapshotSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        ok: false,
        reasons: parsed.error.issues.slice(0, 8).map((issue) => issue.path.join('.') || issue.message)
      };
    }

    const validationReasons = this.validateSnapshot(parsed.data, input);
    if (validationReasons.length) {
      return { ok: false, reasons: validationReasons };
    }

    return { ok: true, snapshot: parsed.data };
  }

  private validateSnapshot(
    snapshot: TrainingLoadAgentSnapshot,
    input: GenerateTrainingLoadAgentInput
  ) {
    const reasons: string[] = [];
    const allowedExerciseIds = new Set(
      (input.planTraining.exercises ?? [])
        .map((exercise) => exercise.exerciseId)
        .filter((exerciseId): exerciseId is string => Boolean(exerciseId))
    );
    const allowedSlugs = new Set(
      (input.planTraining.exercises ?? [])
        .map((exercise) => exercise.slug)
        .filter((slug): slug is string => Boolean(slug))
    );
    const text = [
      snapshot.userFacingSummary,
      ...snapshot.trainingGuidanceBullets,
      ...snapshot.exerciseCautions.map((caution) => caution.message)
    ].join(' ');

    if (hasUnsafeTrainingLanguage(text)) reasons.push('unsafe_training_language');
    if (hasMedicalDiagnosisLanguage(text)) reasons.push('medical_diagnosis_language');
    if (/\b(cancel|skip|replace|swap)\s+(the\s+)?(workout|exercise|movement)\b/i.test(text)) {
      reasons.push('disallowed_workout_cancellation_or_replacement');
    }

    if (
      input.personalizationContext.healthPlanningContext?.trainingLoadContext.readinessHint === 'RECOVERY_FOCUSED' &&
      snapshot.adjustments.intensity === 'NORMAL'
    ) {
      reasons.push('unsafe_high_intensity_for_recovery_context');
    }

    snapshot.exerciseCautions.forEach((caution, index) => {
      if (caution.exerciseId && !allowedExerciseIds.has(caution.exerciseId)) {
        reasons.push(`invented_exercise_id_${index}`);
      }
      if (caution.exerciseSlug && !allowedSlugs.has(caution.exerciseSlug)) {
        reasons.push(`invented_exercise_slug_${index}`);
      }
    });

    return reasons;
  }

  private buildSystemInstructions(retry: boolean) {
    return [
      'You are the OptiMe AI Training Load Agent.',
      'Return only structured JSON matching the TrainingLoadAgent snapshot schema.',
      'You analyze training load guidance only. Do not calculate nutrition targets.',
      'WorkoutVolumePlanner is the deterministic source of numeric volume limits. Do not replace it.',
      'ExerciseSelectionService is the deterministic source of allowed exercises. Do not invent exercises.',
      'Work inside deterministic readiness, volume, exercise, equipment, safeMode, pregnancy/postpartum, under-18, and limitation boundaries.',
      'Do not diagnose medical conditions.',
      'Do not tell the user they must train.',
      'Do not tell the user to push through pain, dizziness, illness, injury, exhaustion, or unusual discomfort.',
      'Do not cancel the workout or replace exercises. You may recommend controlled effort, longer rests, gentler pacing, or stopping if pain increases.',
      'Do not mention raw health values in user-facing copy.',
      'Use supportive, non-punitive wording.',
      retry
        ? 'This is a retry. Fix the validation feedback and regenerate the complete snapshot.'
        : 'Generate training-load guidance for today.'
    ].join('\n');
  }

  private buildContext(input: GenerateTrainingLoadAgentInput, validationFeedback: string[]) {
    return {
      planLocalDate: input.planLocalDate,
      locale: input.locale,
      appMode: input.appMode,
      planQualityMode: input.planQualityMode,
      safeMode: input.safeMode,
      isMinor: input.isMinor,
      trainingLevel: input.trainingLevel,
      resolvedTrainingDay: input.resolvedTrainingDay,
      deterministicTrainingLoadContext: input.personalizationContext.healthPlanningContext?.trainingLoadContext,
      wearablePlanningContext: input.personalizationContext.healthPlanningContext?.wearablePlanningContext,
      checkInSummary: input.personalizationContext.checkInSummary,
      workoutVolumePlan: input.exerciseSelection.volumePlan,
      requestedExerciseCount: input.exerciseSelection.requestedExerciseCount,
      plannedExercises: (input.planTraining.exercises ?? []).map((exercise) => ({
        exerciseId: exercise.exerciseId ?? null,
        exerciseSlug: exercise.slug ?? null,
        name: exercise.name,
        targetMuscles: exercise.targetMuscles,
        equipment: exercise.equipment
      })),
      allowedExerciseIds: input.exerciseSelection.candidates.map((candidate) => candidate.exerciseId),
      allowedExerciseSlugs: input.exerciseSelection.candidates.map((candidate) => candidate.slug),
      validationFeedback,
      safetyBoundaries: {
        noMedicalDiagnosis: true,
        noTrainingThroughPain: true,
        noExerciseReplacement: true,
        noNutritionTargetChanges: true,
        equipmentFiltersAlreadyApplied: true
      }
    };
  }

  private getFallbackSummary(
    readiness: TrainingLoadAgentSnapshot['readiness'],
    hasWearableData: boolean,
    controlled: boolean
  ) {
    if (controlled) {
      return "Keep today's workout controlled and take longer rests if needed.";
    }
    if (readiness === 'NORMAL') {
      return "Today's workout can follow your usual plan.";
    }
    if (!hasWearableData) {
      return "Today's workout uses your saved routine and preferences.";
    }
    return 'Use your routine today and adjust effort based on how you feel.';
  }

  private extractOutputText(response: OpenAiResponse) {
    if (typeof response.output_text === 'string') return response.output_text;

    return (
      response.output
        ?.flatMap((item) => item.content ?? [])
        .find((content) => content.type === 'output_text' && typeof content.text === 'string')
        ?.text ?? null
    );
  }

  private getClient() {
    if (!this.client) {
      this.client = this.clientFactory(this.getApiKey());
    }
    return this.client;
  }

  private getApiKey() {
    return this.configService.get<string>('OPENAI_API_KEY') ?? '';
  }

  private getModel() {
    return this.configService.get<string>('OPENAI_DEFAULT_MODEL') ?? 'missing-openai-model';
  }

  private getRequestTimeoutMs() {
    return this.getPositiveIntConfig('OPENAI_REQUEST_TIMEOUT_MS', 45_000);
  }

  private getMaxOutputTokens() {
    return this.getPositiveIntConfig('OPENAI_MAX_OUTPUT_TOKENS', 1_200);
  }

  private getPositiveIntConfig(key: string, fallback: number) {
    const value = Number(this.configService.get<string>(key));
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
  }
}

function hasUnsafeTrainingLanguage(text: string) {
  return /\b(push|train|work|power|fight)\s+through\s+(pain|injur(?:y|ies|ed)|dizz(?:y|iness)|ill(?:ness)?|sick(?:ness)?|fever|exhaust(?:ion|ed)|fatigue|discomfort)\b/i.test(text) ||
    /\b(no pain no gain|all[-\s]?out|max(?:imum)? effort|to failure|train to failure)\b/i.test(text);
}

function hasMedicalDiagnosisLanguage(text: string) {
  return /\b(diagnos(?:e|is|ed)|treat(?:s|ment)?|cure|clinical|disease|condition)\b/i.test(text);
}
