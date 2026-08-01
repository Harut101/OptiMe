# Usage Limits

Sprint 4 Batch 3 adds the backend foundation for usage tracking and future limit enforcement.

This is not payment enforcement yet. It does not validate App Store or Google Play purchases. Entitlement state still comes from backend-owned subscription history.

## UsageLedger

`UsageLedger` stores safe product-usage counters.

Tracked fields:

- `userId`
- `feature`
- `periodType`
- `periodStart`
- `count`
- timestamps

The ledger uses a unique period key:

```text
userId + feature + periodType + periodStart
```

This lets the backend use atomic `upsert` with `increment`, avoiding read-then-write race conditions during parallel requests.

Supported period types:

- `DAILY`
- `MONTHLY`

Daily periods use the user's timezone when available. Internally, the period key is stored as a deterministic UTC date for the user's local period start. This is enough for MVP usage limits; future billing-grade logic may need more precise timezone auditing.

## Usage Features

Current enum values:

- `DAILY_PLAN_GENERATION`
- `DAILY_PLAN_REFRESH`
- `AI_DAILY_PLAN_GENERATION`
- `AI_SAFETY_AGENT_REVIEW`
- `AI_PLAN_CHECKPOINT_PROPOSAL`
- `MEAL_REGENERATION`
- `MENU_REGENERATION`
- `AI_TRAINING_LOAD_AGENT`
- `FUTURE_AI_COACH_MESSAGE`

`AI_SAFETY_AGENT_REVIEW` may be tracked for observability or cost visibility, but it must not be blocked when it is needed for safety.

## UsageGuardService

`UsageGuardService` resolves the user's current plan through backend entitlement logic. It never trusts a client-provided plan.

Current production limits:

| Feature | Period | Free | Plus | Pro |
|---|---|---:|---:|---:|
| `DAILY_PLAN_GENERATION` | Daily | 1 | 1 | 1 |
| `DAILY_PLAN_REFRESH` | Monthly | 0 | 3 | 10 |
| `AI_DAILY_PLAN_GENERATION` | Daily | 1 | 1 | 1 |
| `AI_PLAN_CHECKPOINT_PROPOSAL` | Monthly | 0 | 8 | 20 |
| `MENU_REGENERATION` | Monthly | 0 | 2 | 6 |
| `MEAL_REGENERATION` | Monthly | 2 | 8 | 15 |
| `AI_TRAINING_LOAD_AGENT` | Daily | 0 | 2 | 3 |

Meal regeneration remains useful without becoming an unbounded source of AI
cost. The Training Load Agent allowance is deliberately small because it is an
internal step in Daily Plan generation, not a standalone user action. When its
allowance is unavailable, the plan still completes with deterministic
training-load guidance; safety and Daily Plan access are not blocked.

Methods:

- `getLimit(userId, feature, periodType)`
- `getRemaining(userId, feature, periodType)`
- `assertCanUse(userId, feature, periodType)`
- `consume(userId, feature, periodType, amount)`
- `checkAndConsume(userId, feature, periodType, amount)`
- `getConfiguredPeriodType(feature)`
- `assertCanUseConfigured(userId, feature)`
- `checkAndConsumeConfigured(userId, feature, amount)`

`checkAndConsume` is the concurrency-safe path for future feature enforcement. It increments atomically, then rolls back the increment and throws a friendly error if the limit is exceeded.

The `Configured` methods use the central entitlement matrix as the source of truth
for daily versus monthly periods. Callers do not duplicate period decisions.

## What Counts

Sprint 4 Batch 4 integrates usage guards into daily plan generation and refresh.

These actions count:

- Creating a new daily plan when no plan exists for today.
- Explicitly refreshing/regenerating today's plan with `forceRegenerate=true`.
- OpenAI-backed daily plan generation attempts when `AI_PROVIDER=openai`.
- Full menu regeneration.
- Individual meal regeneration.
- AI Training Load Agent calls for `PLUS` and `PRO`.
- OpenAI Adaptive Plan Checkpoint proposals for `PLUS` and `PRO`.

Fallback still counts after generation starts. This includes:

- OpenAI provider fallback.
- deterministic `SafetyService` fallback.
- AI Safety Agent fallback.
- retry-with-safety-feedback fallback.

Reason: the user attempted an expensive product action, and backend work/provider work may already have happened.

## What Does Not Count

These actions do not consume usage:

- `GET /v1/daily-plans/today`.
- `POST /v1/plan-impact/evaluate`.
- Returning an existing Today plan when `forceRegenerate=false`.
- Auth failures.
- Incomplete onboarding when generation does not start.
- Profile, goal, nutrition preference, or training schedule updates.
- Dangerous goal rejection during setup.
- Fetching history or usage summary.
- Internal schema validation or safety checks.
- Free deterministic training-load fallback guidance.

Plan Impact may report `entitlementFeatureKey=DAILY_PLAN_REFRESH` and `usageCost=1` when updating today's plan is recommended. That is informational only. Usage is consumed only if the user chooses to refresh/regenerate the plan through the existing daily plan endpoint.

## Friendly Limit Error

When a limit is reached, the backend throws:

```ts
{
  code: "USAGE_LIMIT_REACHED",
  feature: "DAILY_PLAN_REFRESH",
  currentPlan: "FREE",
    limit: 0,
    periodType: "MONTHLY",
  resetAt: string,
  upgradeSuggestion: "PLUS"
}
```

Mobile renders daily and monthly wording without exposing raw JSON. A separate
operational cost ceiling can return:

```ts
{
  code: "AI_CAPACITY_LIMIT_REACHED",
  currentPlan: "FREE",
  resetAt: string,
  upgradeSuggestion: "PLUS"
}
```

This response intentionally omits internal spend and ceiling values.

## Usage Summary Endpoint

```http
GET /v1/me/usage
```

Returns current limited-feature usage:

```ts
{
  items: [
    {
      feature: string,
      periodType: "DAILY" | "MONTHLY",
      count: number,
      limit: number,
      remaining: number,
      resetAt: string
    }
  ]
}
```

This endpoint is JWT protected. It does not count as usage.

After a counted action, this endpoint reflects the updated usage counters and the
configured daily or monthly reset.

## Operational AI Cost Ceiling

`UsageLedger` remains the product allowance system. `AiCostControlService` is a
separate deployment safety valve based on successful priced `AiRequestLog` rows.
It is disabled by default and does not run in mock mode.

When explicitly enabled, all three positive monthly ceiling values and all route
input/output prices are required. The current UTC month is used for aggregation.
If telemetry cannot be written, user-visible generation remains available because
telemetry is best-effort. Existing unpriced rows do not count toward the ceiling.

The preflight check cannot know the final cost of the next request, so one
operation may cross the threshold. Subsequent user-visible AI operations are
blocked until the next UTC month.

## Safety Is Never Limited

Usage limits must never block:

- `DailyPlanJson` schema validation
- deterministic `SafetyService`
- fallback plans
- allergy checks
- excluded food checks
- under-18 safety
- pregnancy, postpartum, and breastfeeding safety
- dangerous goal protection
- AI Safety Agent review when needed for safety

Pricing can limit product features and expensive operations. It must not limit safety.

`AI_SAFETY_AGENT_REVIEW` must not be used as a blocking guard for safety review. It can be tracked later for observability, but Free users must still receive the same safety protections.

## Batch 5 Mobile UI

Batch 5 adds lightweight mobile UX for usage summaries and friendly limit messages. It does not add real payment processing.

See [mobile-usage-ui.md](./mobile-usage-ui.md).
