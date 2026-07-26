# Daily Plan Orchestrator

OptiMe uses a bounded backend workflow rather than one unrestricted autonomous
agent. `DailyPlanOrchestratorService` coordinates specialized stages, while
`DailyPlanGenerationUseCaseService` owns the generation lifecycle and
`DailyPlansService` remains a thin controller-facing facade.

## Current Generation Flow

1. `DailyPlanTodayUseCaseService` resolves the authenticated planning user,
   local date, timezone, locale, and an existing plan.
2. `DailyPlanGenerationUseCaseService` enforces onboarding readiness, existing
   plan semantics, and usage accounting.
3. `DailyPlanGenerationContextService` prepares backend-owned context:
   app mode, goal, nutrition target, training day or override, health summary,
   selected protocols, blocked foods, and trusted exercise candidates.
4. `DailyPlanAgentExecutionService` calls the configured `AiProvider` for the
   general structured plan and `NutritionAgentService` for the catalog-backed
   food plan.
5. `DailyPlanOrchestratorService` assembles the plan before safety:
   recovery context is finalized, the food plan is attached, training is
   validated or repaired, and training load is applied.
6. `DailyPlanSafetyOrchestratorService` validates the complete schema,
   normalizes safe food-name exclusions, runs deterministic `SafetyService`,
   and then runs the optional semantic `SafetyAgent`.
7. A single bounded safety-feedback regeneration may run only for an eligible
   OpenAI plan rejected by the Safety Agent with actionable changes. The full
   assembly and safety sequence runs again.
8. `DailyPlanFinalizationService` guarantees a complete normalized plan,
   restores deterministic catalog-backed sections when required, adds the
   recovery result and checkpoint baseline, and records safe debug provenance.
9. `DailyPlanPersistenceService` resolves the final status, stores the plan,
   and writes best-effort metadata-only `AiOperationLog` observability.
10. `daily-plan-response.mapper.ts` returns the stable API response.

Initial generation and safety-feedback regeneration use the same assembly and
validation stages so the two paths cannot silently drift.

## Agent Responsibilities

- `AiProvider` creates the general normalized plan content.
- `NutritionAgentService` creates meals within backend-calculated targets and
  the approved food catalog.
- `TrainingPlanAgentService` accepts only supplied `ExerciseLibrary`
  candidates, validates duration and prescription bounds, and can use one
  bounded repair attempt before a deterministic fallback.
- `RecoveryPlanAgentService` applies protocol and normalized health context
  without diagnosis or raw-sample interpretation.
- `SafetyAgent` performs optional semantic review after deterministic safety.

Agents do not call each other, persist plans, change entitlements, or make the
final READY/FALLBACK decision.

## Backend Authority

The backend remains authoritative for:

- nutrition targets and catalog eligibility;
- training-day resolution, exercise identity, duration, and volume bounds;
- allergies, exclusions, safe mode, age, pregnancy/postpartum, pain, and
  dangerous-goal rules;
- schema normalization and fallback content;
- retry limits, final status, persistence, usage accounting, and operation
  logging.

The mobile app never calls OpenAI. No full prompts, raw provider responses,
profiles, secrets, tokens, or raw health samples are stored in operation logs.

## Other Daily Plan Use Cases

Generation is separate from mutation and query workflows:

- `DailyPlanFoodRegenerationUseCaseService`
- `DailyPlanFoodIngredientUseCaseService`
- `DailyPlanTrainingAdjustmentUseCaseService`
- `DailyPlanHistoryFeedbackUseCaseService`

`DailyPlansService` delegates to these use cases and maps responses. It contains
no direct Prisma, provider, date/timezone, nutrition, training, or safety logic.

## Architecture Status

The planned orchestration extraction is complete. Safety, finalization,
persistence, Today resolution, food mutations, training adjustments, and
history/feedback now have explicit boundaries and focused tests.

Further refactoring should happen only to resolve a measured reliability,
ownership, or maintainability problem. The next active work is product and
release readiness: model routing, per-agent cost telemetry, production limits,
and release QA.

RAG and embeddings are not required for this workflow. Food and exercise
retrieval remain structured catalog queries.
