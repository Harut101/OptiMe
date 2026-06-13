# Sprint 6 Plan

Sprint 6 improves core plan quality before adding more monetization or integrations.

The main product principle is:

AI should not invent the full plan from scratch. AI should customize deterministic protocols and templates.

This should reduce hallucinations, improve safety, improve consistency, and make Plus and Pro more valuable.

## Goals

- Add optional training preferences.
- Add a text-based exercise recommendation foundation.
- Add a simple protocol/template layer for nutrition, training, and recovery.
- Use existing check-ins more effectively in planning context.
- Make recommendation depth tier-aware through `PlanQualityMode`.

## Scope

- Documentation and contracts first.
- Optional training preference data model in a later batch.
- Progressive prompt integration for training preferences.
- Simple deterministic protocol selection.
- Protocol context passed to `AiProvider`.
- Optional exercise recommendations in `DailyPlanJson`.
- Safety checks for exercise recommendation text.
- Minimal mobile rendering for exercises when available.

## Out Of Scope

- Real payments.
- App Store / Google Play purchase flow.
- Receipt validation.
- WHOOP integration.
- AI Coach chat.
- Embeddings.
- Admin or web.
- ExerciseLibrary implementation.
- Exercise images or videos.
- Advanced progression engine.
- Analytics dashboard.

## Implementation Batches

### Batch 2

- Add `TrainingPreference` Prisma model.
- Add DTOs, service, controller, and endpoints.
- Integrate training preference answers with progressive prompts.
- Expose a minimal training preference summary to planning context.
- Add tests.

### Batch 3

- Add `ProtocolModule` and `ProtocolSelectorService`.
- Produce deterministic nutrition, training, and recovery protocol output.
- Use check-ins for conservative or recovery-oriented protocol selection.
- Pass selected protocols into `AiProvider` context.
- Store safe protocol IDs in debug metadata.
- Add tests.

### Batch 4

- Add optional text-based `training.exercises` schema.
- Add `SafetyService` and Safety Agent exercise checks.
- Keep existing mobile rendering working when exercises are missing.
- Add tests.

### Batch 5

- Add mobile progressive prompts for training preferences if still needed.
- Render optional exercise recommendations in Plan Details only.
- Keep Today simple.
- Run mobile typecheck.

### Batch 6

- Sprint 6 QA.
- Docs update.
- Manual QA checklist.
- Sprint 6 closure and Sprint 7 planning.

## Acceptance Criteria

- Missing training preferences do not block first plan generation.
- `limitationsOrPainAreas` is prioritized as safety-sensitive context.
- Training preferences can be saved and read by the backend.
- Progressive prompts can collect training preferences without lengthening Stage 1.
- Batch 2 does not add `ProtocolSelectorService`; that belongs to Batch 3.
- Protocols are selected deterministically from user context, goals, schedule, check-ins, and safety state.
- OpenAI receives protocol context and can customize it instead of planning from scratch.
- DailyPlan debug metadata stores protocol IDs only, not full private context.
- Optional exercise recommendations validate when present.
- Exercise recommendations remain text-only and optional.
- Existing mobile screens still work when exercises are missing.
- Today remains clean and does not render exercises.
- Safety remains equal across all tiers.
- Unsafe training advice is blocked or replaced with safe fallback.
- API build, e2e tests, and mobile typecheck stay green.

## Risks And Mitigations

- Risk: Protocol layer becomes a complex rules engine.
  Mitigation: Start with protocol IDs, rules, and safetyRules only.
- Risk: Training preferences make onboarding long again.
  Mitigation: Keep them optional and collect through progressive prompts.
- Risk: Exercise recommendations become unsafe or too advanced.
  Mitigation: Add deterministic safety rules and Safety Agent review for exercise text.
- Risk: AI ignores protocols.
  Mitigation: Prompt OpenAI to customize protocols and never override `safetyRules`.
- Risk: ExerciseLibrary scope creep.
  Mitigation: Keep text-only exercises in Sprint 6 and defer media/library work.

## Recommended Sprint 7 Direction

After Sprint 6, consider meal/ingredient swaps or real payment integration depending on whether core plan quality feels strong enough for paid conversion.
