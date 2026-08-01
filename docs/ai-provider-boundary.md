# AI Provider Boundary

Sprint 2 introduced the provider seam. Sprint 3 adds the real OpenAI provider behind that same seam.

## Current Structure

Files:

- `apps/api/src/modules/ai/ai.module.ts`
- `apps/api/src/modules/ai/ai-provider.interface.ts`
- `apps/api/src/modules/ai/ai-provider.token.ts`
- `apps/api/src/modules/ai/mock-ai-provider.service.ts`

## AiProvider Interface

```ts
export interface AiProvider {
  generateDailyPlan(input: GenerateDailyPlanInput): Promise<DailyPlanJson>;
}
```

`GenerateDailyPlanInput` includes:

- user
- profile
- goal
- nutrition preferences
- deterministic nutrition target
- training schedule
- safe mode
- plan local date
- plan timezone

## Current Providers

`MockAiProviderService` returns normalized `DailyPlanJson` by calling the existing mock daily plan factory.

It does not:

- call OpenAI
- use an OpenAI SDK
- read API keys
- make network calls
- route models
- log AI interactions

`OpenAiProviderService` is available only when `AI_PROVIDER=openai`.

It:

- uses the backend OpenAI SDK dependency
- calls the Responses API
- requests Structured Outputs through `text.format`
- validates parsed output with `dailyPlanJsonSchema`
- retries invalid output once
- throws `OpenAiProviderError` if the retry fails
- writes safe development logs for request, parse, validation, retry, and fallback state
- adds internal `planJson.debug` metadata after validation

It does not:

- run in mock mode
- expose OpenAI config to mobile
- bypass `SafetyService`
- write prompts, raw responses, full profiles, or full plans to logs

## Provider Selection

Provider selection is controlled by environment config:

```env
AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_DEFAULT_MODEL=
OPENAI_DAILY_PLAN_MODEL_FREE=
OPENAI_DAILY_PLAN_MODEL_PLUS=
OPENAI_DAILY_PLAN_MODEL_PRO=
```

Rules:

- Missing `AI_PROVIDER` defaults to `mock`.
- `AI_PROVIDER=mock` works without `OPENAI_API_KEY`.
- `AI_PROVIDER=openai` requires `OPENAI_API_KEY`.
- If `AI_PROVIDER=openai` is set without `OPENAI_API_KEY`, the API fails fast with a clear config error.
- `OPENAI_DEFAULT_MODEL` is an optional common fallback when
  `AI_PROVIDER=openai`; without it, all three tier models are required.
- `OPENAI_DAILY_PLAN_MODEL_FREE`, `OPENAI_DAILY_PLAN_MODEL_PLUS`, and
  `OPENAI_DAILY_PLAN_MODEL_PRO` select models for `BASIC`, `PERSONALIZED`, and
  `ADAPTIVE` requests.
- Legacy `OPENAI_MODEL_LUNA/TERRA/SOL` names are migration fallbacks only.
- Route names are internal product aliases, not hard-coded provider model IDs.

## Provider And Use-Case Boundary

`DailyPlanAgentExecutionService` depends on `AI_PROVIDER`, not the concrete mock
or OpenAI provider. `DailyPlansService` does not invoke a provider directly; it
delegates generation to the Today and generation use cases.

Flow:

```text
DailyPlansService facade
-> DailyPlanTodayUseCaseService
-> DailyPlanGenerationUseCaseService
-> DailyPlanGenerationContextService calculates backend-owned context
-> DailyPlanAgentExecutionService invokes AiProvider and NutritionAgent
-> DailyPlanOrchestratorService assembles recovery, food, training, and load
-> DailyPlanSafetyOrchestratorService validates schema and safety
-> DailyPlanFinalizationService guarantees a complete normalized plan
-> DailyPlanPersistenceService stores the result and operation metadata
-> stable normalized response
```

## Safety After Provider Output

Provider output is never trusted directly.

The backend must:

- calculate nutrition targets before provider generation
- treat `personalizationContext.nutritionTarget` as the source of truth for calories and macros
- validate the JSON schema
- check allergies and excluded foods
- enforce safe fallback on invalid or unsafe output
- preserve under-18 safe mode behavior
- use `planLocalDate` for user-facing date references
- keep `generatedAt` as backend metadata only
- generate user-facing content in the requested `outputLanguage.locale`
- allow the backend, not the model, to persist `contentLocale`

If `OpenAiProviderService` throws `OpenAiProviderError`, the bounded generation
workflow records a safe operational reason and uses the existing normalized
fallback behavior without exposing provider internals to mobile.

The core AI provider may explain backend-owned nutrition targets, hydration, and
how nutrition fits the day, but it does not generate meals, ingredients,
portions, or menu alternatives. Those fields belong exclusively to the
catalog-bounded Nutrition Agent. Neither provider may invent alternate calorie
or macro targets. Saved plans include `nutritionTargetSnapshot` so historical
plans remain stable after profile, goal, app mode, or schedule changes.

Nutrition target explanations are reason codes and params. Providers should receive them as neutral planning context, not as user-facing English copy to preserve mobile localization.

## Nutrition Output Ownership

Daily plan generation intentionally avoids asking two AI paths to create the
same food content:

```text
OpenAiProviderService
-> summary, readiness, nutrition guidance, hydration, training, recovery

NutritionAgentService
-> catalog-backed primary foodPlan
-> BASIC/PERSONALIZED/ADAPTIVE menu options
-> ingredient quantities, preparation, and nutrition validation

DailyPlanFinalizationService
-> maps the authoritative foodPlan into legacy nutrition.meals
-> maps catalog-backed alternatives into nutrition.menuOptions
```

The Structured Output schema sent to the core planner therefore omits
`nutrition.meals` and `nutrition.menuOptions`. The backend injects empty legacy
fields only for internal schema normalization, then replaces them with validated
Nutrition Agent output before deterministic safety and persistence.

Menu alternatives are composed deterministically from the food catalog and do
not require additional LLM calls. This preserves the public `DailyPlanJson`
contract, reduces duplicate output tokens, and prevents the primary meal plan
from disagreeing with tier alternatives.

## Debug Metadata

Generated plans include internal debug metadata:

```json
{
  "debug": {
    "provider": "mock | openai | fallback",
    "generatedBy": "MockAiProviderService | OpenAiProviderService | SafeFallbackPlanFactory",
    "fallbackReason": "optional reason"
  }
}
```

Mobile must not render `planJson.debug`.

Before production, remove debug metadata from persisted plan JSON or hide it behind environment config.

## Operational Config

OpenAI provider runtime guards:

```env
OPENAI_REQUEST_TIMEOUT_MS=45000
OPENAI_MAX_OUTPUT_TOKENS=4000
OPENAI_DAILY_PLAN_MAX_OUTPUT_TOKENS=4000
OPENAI_NUTRITION_MAX_OUTPUT_TOKENS=4000
OPENAI_CHECKPOINT_MAX_OUTPUT_TOKENS=4000
OPENAI_SAFETY_MAX_OUTPUT_TOKENS=1200
OPENAI_TRAINING_LOAD_MAX_OUTPUT_TOKENS=1200
```

The operation-specific values bound output independently for the core planner,
Nutrition Agent, checkpoint proposal, semantic Safety Agent, and Training Load
Agent. If an operation-specific value is omitted, it falls back to
`OPENAI_MAX_OUTPUT_TOKENS` for backward compatibility. Lower limits must pass
the quality benchmark before production rollout; cost reduction must not reduce
Daily Plan completeness, personalization, or safety.

Identical concurrent generation requests are coalesced in the API process by
user, local date, locale, and operation. This prevents repeated taps from
starting duplicate provider calls and consuming usage twice. The current guard
is process-local; a future multi-instance deployment requires a distributed
lock or idempotency store.

These are lightweight provider guards only. They complement, but do not replace,
`UsageLedger` and entitlement enforcement.

## AI Operation Logs

Sprint 3 Batch 5 adds `AiOperationLog` for minimal internal observability.

Purpose:

- Monitor daily plan provider behavior.
- Track READY/FALLBACK/ERROR outcomes.
- Track latency and retry count.
- Track Safety Agent enabled/provider/approval metadata.
- Track safe fallback or error reason codes.

Logged fields:

- `userId`
- `feature = DAILY_PLAN`
- `provider = MOCK | OPENAI`
- `model`
- `status = SUCCESS | FALLBACK | ERROR`
- `latencyMs`
- `retryCount`
- `safetyAgentEnabled`
- `safetyAgentProvider`
- `safetyAgentApproved`
- `fallbackReason`
- `errorReason`
- `createdAt`

Never log:

- Full prompts.
- Full `DailyPlanJson`.
- Full profile data.
- Password hashes.
- API keys.
- Raw OpenAI responses.
- Auth tokens.
- Sensitive notes.

If `AiOperationLog` writes fail, daily plan generation must continue. These logs are observability only, not billing, subscription, entitlement, or usage-limit enforcement.

## AI Request Logs

`AiRequestLog` complements the aggregate `AiOperationLog` with one safe row per
actual OpenAI request or retry. It records agent, operation, internal route,
resolved model, latency, retry state, token counts, optional estimated micro-USD,
and a safe error reason. It stores no prompts, plan JSON, profiles, health samples,
raw responses, secrets, or private notes.

Daily Plan, Plan Checkpoint, Nutrition, Safety, and Training Load requests all use
`AiModelRouterService`. `BASIC`, `PERSONALIZED`, and `ADAPTIVE` map to the internal
`LUNA`, `TERRA`, and `SOL` routes. See
[ai-model-routing.md](./ai-model-routing.md) for deployment config and cost
estimation rules.

Request telemetry is best-effort observability. It does not replace `UsageLedger`,
alter entitlements, or charge users. `AiCostControlService` may aggregate the
priced request rows for a separately configured monthly operational ceiling.

## OpenAI Provider Rules

The OpenAI provider must:

- live behind the same `AiProvider` interface
- produce only `DailyPlanJson`
- use Structured Outputs
- not return user-visible text outside the schema
- not bypass `SafetyService`
- not be called from mobile
- not expose API keys to mobile

## Not Yet Implemented

- Production deployment values and representative unit-economics approval.
- Billing or store receipt validation.
- Automatic model failover between routes.
