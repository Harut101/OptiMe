# Adaptive Plan Checkpoint

## Purpose

Adaptive Plan Checkpoint compares the facts used for today's plan with meaningful
new facts. It avoids unnecessary AI calls and never changes a Daily Plan without
explicit user approval.

## Batch 1: Deterministic Material-Change Foundation

Batch 1 adds shared contracts and
`PlanCheckpointMaterialChangeDetectorService`. It does not add an API endpoint,
database table, AI call, background task, notification, or mobile UI.

Inputs are normalized structured facts:

- optional sleep, steps, active calories, and workout minutes;
- completed or skipped meal counts;
- workout status;
- energy, tiredness, and soreness check-ins;
- explicit pain/limitation, illness, dizziness, and exhaustion signals.

The detector recommends review only when a fact crosses a deterministic threshold
or a meaningful event occurs. Missing metrics are ignored and never interpreted
as poor sleep, low recovery, illness, or inactivity.

Initial material changes include:

- newly detected low sleep or a sleep decrease of at least 90 minutes;
- at least 6,000 additional steps or crossing 12,000 steps;
- at least 500 additional active calories;
- at least 30 additional workout minutes;
- a newly completed workout;
- a newly skipped meal;
- newly low energy, high tiredness, or high soreness;
- new pain/limitation, illness, dizziness, or exhaustion signals.

Safety signals receive priority and require deterministic safety review. The
detector does not diagnose a condition and does not call AI.

## Batch 2: Plan Baseline And Deterministic Evaluation

Every newly generated or regenerated Daily Plan now stores an optional,
backend-owned `checkpointBaseline` inside `DailyPlanJson`. It contains only
normalized facts that were available when the plan was generated:

- one selected wearable snapshot for the plan date;
- aggregate meal completion and skip counts;
- workout status;
- numeric energy, tiredness, and soreness check-ins;
- explicit structured pain/limitation signals.

Raw health samples, free-form notes, prompts, and private profile details are not
stored in the baseline.

Authenticated clients can call:

```txt
POST /v1/daily-plans/:id/checkpoint/evaluate
```

with one trigger: `APP_OPEN`, `HEALTH_SYNC`, `PRE_WORKOUT_CHECK`, or
`MANUAL_CHECK_IN`. The server verifies plan ownership and loads current facts
from the database; clients cannot submit or override health values.

Older plans without a baseline are backward compatible. Their first evaluation
stores the current facts as the baseline and returns no material change. This
prevents a false review prompt caused by comparing known current data with an
unknown historical state.

Batch 2 does not call AI, change a plan, create a proposal, or add mobile UI.

## Deferred To Later Batches

- AI adjustment proposal generation.
- Schema, deterministic safety, and Safety Agent proposal validation.
- Proposal persistence and explicit apply/keep behavior.
- Mobile comparison UI.
- Tier limits and cost accounting.
- Background sync and push notifications.
