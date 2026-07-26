# Daily Plan Orchestrator

`DailyPlanOrchestratorService` owns the bounded order of specialized plan stages
before final safety review.

## Current Pipeline

1. Apply backend-owned plan metadata and mode snapshots.
2. Finalize normalized recovery context through `RecoveryPlanAgentService`.
3. Attach the validated Nutrition Agent food plan.
4. Validate and, when allowed, repair training through
   `TrainingPlanAgentService`.
5. Reattach the authoritative food plan after any training-only retry.
6. Apply the structured Training Load Agent snapshot.
7. Return the assembled plan to `DailyPlansService` for deterministic safety,
   semantic Safety Agent review, fallback decisions, debug metadata, and
   persistence.

The same orchestration method is used for initial generation and safety-feedback
regeneration. This prevents those paths from drifting apart.

## Boundaries

- The orchestrator does not call mobile clients.
- It does not store plans or usage records.
- It does not bypass deterministic safety.
- It does not create an unbounded autonomous agent loop.
- Training repair remains limited to one provider retry.
- Safety-feedback retry remains controlled by `DailyPlansService`.
- No raw health samples, full prompts, secrets, or provider responses are logged.

## Remaining Extraction

A later batch can move final safety orchestration and persistence from
`DailyPlansService` after focused regression coverage is in place. This should be
done separately so ownership and fallback behavior remain auditable.

RAG and embeddings are not required for this pipeline. Food and exercise
retrieval remain structured catalog queries.
