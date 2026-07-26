# Recovery Plan Agent

`RecoveryPlanAgentService` is a bounded deterministic stage in daily-plan
generation. It finalizes recovery context after provider generation and before
the final safety pipeline.

## Inputs

- the generated `DailyPlanJson`
- the selected deterministic recovery protocol
- normalized `HealthPlanningContext`
- whether training is enabled and planned for the local day

The service does not receive raw HealthKit samples, provider credentials, or a
full health history. It does not diagnose fatigue, injury, pregnancy conditions,
poor recovery, or illness.

## Behavior

- Recent low-sleep or high-activity hints may select a gentle recovery context.
- Pain/limitation and pregnancy/postpartum protocols select conservative context.
- Stale or missing wearable data never creates a negative recovery inference.
- Provider-authored nutrition, training, and recovery content is not rewritten in
  this foundation batch.
- User-facing context uses existing localized reason codes, so the DailyPlan API
  contract and mobile rendering remain unchanged.

The deterministic `SafetyService` and semantic `SafetyAgent` remain responsible
for blocking unsafe final guidance.

## Next Boundary

The next architecture batch should extract the top-level flow from
`DailyPlansService` into a `DailyPlanOrchestratorService` that coordinates:

1. core provider generation
2. Nutrition Agent
3. Training Plan Agent
4. Recovery Plan Agent
5. deterministic safety
6. Safety Agent
7. bounded retry/fallback and persistence

Classic vector RAG is not required for this orchestration.
