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

## Batch 3: Safe Preview Proposal

Authenticated clients can now request a preview after evaluation:

```txt
POST /v1/daily-plans/:id/checkpoint/propose
```

The request uses the same foreground trigger contract as evaluation. The backend
first runs deterministic material-change detection. When no material change is
present, or an old plan baseline was just initialized, it returns `NOT_NEEDED`
and does not call the AI provider.

For a material change, `AiProvider` proposes one complete normalized
`DailyPlanJson`. The proposal pipeline then:

1. restores backend-owned metadata and the current checkpoint facts;
2. preserves deterministic nutrition targets and catalog-backed food content;
3. preserves exercise identities and catalog snapshots while allowing bounded
   prescription and recovery adjustments;
4. validates the normalized schema;
5. runs deterministic food, pregnancy-sensitive, and exercise safety checks;
6. runs the configured Safety Agent after deterministic safety passes.

Only a proposal that passes every enabled check is returned with `READY`.
Provider, schema, deterministic safety, or Safety Agent failures return
`UNAVAILABLE`, `INVALID`, or `UNSAFE` with supportive feedback. The endpoint
does not persist the proposal and never changes the source plan or its
`updatedAt`.

The OpenAI checkpoint request includes the current normalized plan, structured
checkpoint evaluation, current normalized facts, and minimal safety context. It
does not include passwords, tokens, raw health samples, or a full private
profile. Safe logs record only plan ID, trigger severity, reason count, status,
and whether persistence occurred.

## Batch 4: Persistent Review And Explicit Decision

Safe `READY` proposals are now stored separately from `DailyPlan` in
`DailyPlanCheckpointProposal`. The record contains the normalized evaluation,
the complete validated proposed plan, a short comparison summary, status, and
the source plan's `updatedAt`. It does not store prompts, raw health samples,
tokens, API keys, or a full profile.

Apply the migration in each environment before using the Batch 4 endpoints:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api prisma:migrate
```

Authenticated clients can use:

```txt
GET  /v1/daily-plans/:id/checkpoint/proposal
POST /v1/daily-plans/:id/checkpoint/proposals/:proposalId/apply
POST /v1/daily-plans/:id/checkpoint/proposals/:proposalId/keep
```

The mobile Today flow checks for a pending proposal on foreground entry. If no
pending proposal exists, it can run one `APP_OPEN` checkpoint evaluation for the
current plan version. A proposal opens a localized review sheet that compares
the current plan with the suggested update and offers two explicit decisions:
Apply update or Keep current plan.

Apply uses optimistic concurrency against the source plan's `updatedAt`. If the
plan was regenerated or changed after the proposal was created, the proposal is
marked `EXPIRED`, the API returns `CHECKPOINT_PROPOSAL_STALE`, and the latest
plan remains unchanged. Keep marks the proposal `DISMISSED` without modifying
the plan. Closing the sheet applies nothing and leaves the proposal available
for a later review.

The checkpoint remains foreground-only. There is no background sync, push
notification, silent plan mutation, or health-data requirement.

## Deferred To Later Batches

- Tier limits and cost accounting.
- Background sync and push notifications.
