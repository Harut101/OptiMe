# Daily Plan Orchestrator

`DailyPlanOrchestratorService` owns the bounded order of specialized plan stages
and the final safety decision before persistence.

## Current Pipeline

1. Apply backend-owned plan metadata and mode snapshots.
2. Finalize normalized recovery context through `RecoveryPlanAgentService`.
3. Attach the validated Nutrition Agent food plan.
4. Validate and, when allowed, repair training through
   `TrainingPlanAgentService`.
5. Reattach the authoritative food plan after any training-only retry.
6. Apply the structured Training Load Agent snapshot.
7. Normalize and validate the complete `DailyPlanJson`.
8. Run deterministic food, pregnancy-context, and exercise safety rules.
9. Run the optional structured Safety Agent review.
10. Return `READY`, an actionable one-retry request, or a normalized safe
    fallback to `DailyPlansService`.

The same orchestration method is used for initial generation and safety-feedback
regeneration. This prevents those paths from drifting apart.

## Boundaries

- The orchestrator does not call mobile clients.
- It does not store plans or usage records.
- It does not bypass deterministic safety.
- It does not create an unbounded autonomous agent loop.
- Training repair remains limited to one provider retry.
- `SafetyService` remains the hard-rule authority and always runs before the
  semantic Safety Agent.
- Safety-feedback retry execution remains controlled by `DailyPlansService`,
  but the orchestrator decides whether that one retry is allowed and supplies
  the structured feedback.
- No raw health samples, full prompts, secrets, or provider responses are logged.

## Remaining Extraction

`DailyPlansService` still owns provider invocation, persistence, usage
accounting, and operation logging. A later batch can extract persistence after
focused transaction and observability coverage is in place.

RAG and embeddings are not required for this pipeline. Food and exercise
retrieval remain structured catalog queries.
