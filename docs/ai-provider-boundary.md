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
```

Rules:

- Missing `AI_PROVIDER` defaults to `mock`.
- `AI_PROVIDER=mock` works without `OPENAI_API_KEY`.
- `AI_PROVIDER=openai` requires `OPENAI_API_KEY`.
- If `AI_PROVIDER=openai` is set without `OPENAI_API_KEY`, the API fails fast with a clear config error.
- `OPENAI_DEFAULT_MODEL` is also required when `AI_PROVIDER=openai`.

## DailyPlansService Boundary

`DailyPlansService` depends on `AI_PROVIDER`, not the concrete mock provider.

Flow:

```text
DailyPlansService
-> NutritionTargetsService calculates backend-owned calorie/macro targets
-> AiProvider.generateDailyPlan()
-> validate DailyPlanJson schema
-> SafetyService checks
-> persist READY plan or FALLBACK plan
-> return normalized response
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

If `OpenAiProviderService` throws `OpenAiProviderError`, `DailyPlansService` uses the existing safe fallback plan.

AI providers may explain nutrition targets and shape meals around them, but they must not invent alternate calorie or macro values. Saved plans include `nutritionTargetSnapshot` so historical plans remain stable after profile, goal, app mode, or schedule changes.

Nutrition target explanations are reason codes and params. Providers should receive them as neutral planning context, not as user-facing English copy to preserve mobile localization.

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
```

These are lightweight provider guards only. They are not a full `UsageLedger` or entitlement system.

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

- Model routing.
- Usage ledger.
- Subscription or entitlement enforcement.
