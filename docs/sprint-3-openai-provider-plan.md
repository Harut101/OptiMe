# Sprint 3 OpenAI Provider Plan

Sprint 3 adds real OpenAI daily plan generation behind the existing backend-only `AiProvider` seam. Batch 1 only adds configuration and a provider skeleton; it does not call OpenAI yet.

## Batch 1 Status

Added configuration:

```env
AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_DEFAULT_MODEL=
```

Behavior:

- `AI_PROVIDER` defaults to `mock`.
- Mock mode works without `OPENAI_API_KEY`.
- `AI_PROVIDER=openai` requires `OPENAI_API_KEY` and fails fast if missing.
- `OpenAiProviderService` exists but does not call OpenAI yet.
- Mobile still calls only the backend.

## Batch 2 Status

Added:

- `openai` dependency in `apps/api`.
- `OpenAiProviderService` implementation.
- Responses API request shape.
- Structured Outputs JSON schema for `DailyPlanJson`.
- Zod validation after OpenAI output.
- One retry for invalid model output.
- Typed provider error after retry failure.
- Safe fallback from `DailyPlansService` when provider fails.
- Safe development logs around request, parse, schema validation, safety, fallback, and final status.
- Internal `planJson.debug` metadata for DBeaver smoke testing.
- Mocked e2e tests with no real OpenAI calls.

No mobile behavior changed.

## Sprint 3 Goal

Enable real backend-only OpenAI daily plan generation while preserving deterministic safety.

## Scope

- Implement `OpenAiProviderService`.
- Use OpenAI Responses API.
- Use Structured Outputs for `DailyPlanJson`.
- Validate output with `dailyPlanJsonSchema`.
- Retry invalid model output once.
- Fall back safely if retry fails.
- Keep `SafetyService` after provider output.
- Add minimal AI request logging.
- Add simple cost guard configuration without `UsageLedger`.

## Out Of Scope

- Mobile-to-OpenAI calls.
- WHOOP.
- Payments.
- Subscriptions.
- Full usage ledger.
- AI Coach chat.
- Embeddings.
- Weekly reports.
- Admin panel.
- Web app.

## Required Environment Variables

```env
AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_DEFAULT_MODEL=
OPENAI_PREMIUM_MODEL=
OPENAI_REASONING_MODEL=
OPENAI_SAFETY_MODEL=
OPENAI_MODERATION_MODEL=
OPENAI_EMBEDDING_MODEL=
```

Only `AI_PROVIDER`, `OPENAI_API_KEY`, and `OPENAI_DEFAULT_MODEL` are needed for the first real daily-plan provider batch.

## OpenAI Provider Implementation

1. The API package owns the OpenAI SDK dependency.
2. `OpenAiProviderService` initializes the client lazily.
3. The provider builds a compact planning context from `GenerateDailyPlanInput`.
4. The request uses Responses API.
5. The request uses Structured Outputs through `text.format`.
6. The response is parsed from `response.output_text`.
7. The parsed object is validated with `dailyPlanJsonSchema`.
8. Valid output is returned to `DailyPlansService`.
9. Invalid output retries once.
10. Retry failure throws `OpenAiProviderError`.

## Structured Outputs Plan

The OpenAI provider must produce only:

```ts
DailyPlanJson
```

Rules:

- `schemaVersion` must be `sprint-2.v1`.
- No extra user-visible text outside the JSON.
- No markdown response.
- No free-form object shape.
- Meal foods must use structured food items.
- The model must not include foods from allergies or excluded foods.
- Under-18 safe mode must focus on balanced habits, movement, hydration, sleep, and recovery.

## JSON Schema Validation Plan

Validation layers:

- OpenAI Structured Outputs schema.
- Backend `dailyPlanJsonSchema`.
- Existing `SafetyService`.

Invalid output behavior:

```text
first invalid output
-> retry once
-> if invalid again, safe fallback
```

## Safety Agent Plan

Sprint 3 can begin with deterministic `SafetyService` only.

The Safety Agent should be deferred until the real provider is stable unless specifically approved.

When added later, Safety Agent must:

- receive generated `DailyPlanJson`
- return structured safety review JSON
- never replace deterministic safety rules
- never bypass allergy, excluded food, minor, or training checks

## Retry And Fallback Plan

Fallback triggers:

- OpenAI request fails.
- Output cannot be parsed.
- Output fails `dailyPlanJsonSchema`.
- Output contains allergy or excluded food conflicts.
- Output violates safety rules.

Fallback plans include:

```json
{
  "debug": {
    "provider": "fallback",
    "generatedBy": "SafeFallbackPlanFactory",
    "fallbackReason": "..."
  }
}
```

Fallback response:

- `status = FALLBACK`
- normalized `DailyPlanJson`
- supportive copy
- no extreme dieting
- no unsafe training advice

## AI Request Logging Plan

Add minimal log fields only:

- user id
- provider
- model
- feature name
- success/failure
- fallback used
- duration
- created at

Do not store full prompts or sensitive health data unless explicitly approved.

## Cost Guard Plan

Start simple:

- model configured by env
- max output tokens configured in provider code/config
- short prompt context
- no full `UsageLedger` yet

Do not add paid plan enforcement in Sprint 3 unless explicitly approved.

## Model Routing Plan

Keep routing simple:

- daily plans use `OPENAI_DEFAULT_MODEL`
- do not add model router service yet
- do not add premium/reasoning model paths yet

## Backend Files To Add Or Change

- `apps/api/package.json`
- `apps/api/src/modules/ai/open-ai-provider.service.ts`
- `apps/api/src/modules/ai/ai.module.ts`
- `apps/api/src/modules/ai/open-ai-client.factory.ts`
- `apps/api/src/modules/ai/open-ai-provider.error.ts`
- `apps/api/src/modules/ai/daily-plan-json.openai-schema.ts`
- tests under `apps/api/test/`

## Tests To Add

- mock provider remains default
- OpenAI mode requires API key
- OpenAI mode requires default model
- OpenAI provider sends structured-output request
- OpenAI provider parses valid structured output
- invalid output retries once
- retry failure falls back
- allergy conflict falls back
- mobile typecheck remains green

## Manual QA

- Run app in mock mode.
- Confirm existing Today flow works.
- Enable OpenAI mode locally only with valid credentials:
  ```powershell
  $env:AI_PROVIDER='openai'
  $env:OPENAI_API_KEY='your-api-key'
  $env:OPENAI_DEFAULT_MODEL='your-selected-model'
  pnpm --filter @optime/api start:dev
  ```
- Generate plan.
- Refresh plan.
- Confirm normalized plan renders.
- Confirm allergy fallback.
- Confirm minor-safe output.
- Confirm no mobile OpenAI config exists.

## Implementation Batches

1. Config and OpenAI provider skeleton.
2. Add SDK, Structured Outputs daily plan generation, mocked tests, retry, and fallback.
3. Add minimal AI request logging.
4. Add optional provider-level timeout and token/output caps.
5. Manual QA and safety regression.
