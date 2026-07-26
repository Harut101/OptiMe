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

## Deferred To Later Batches

- Loading baseline and current facts for a real Daily Plan.
- Checkpoint API endpoints.
- AI adjustment proposal generation.
- Schema, deterministic safety, and Safety Agent proposal validation.
- Proposal persistence and explicit apply/keep behavior.
- Mobile comparison UI.
- Tier limits and cost accounting.
- Background sync and push notifications.
