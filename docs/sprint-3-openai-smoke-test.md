# Sprint 3 OpenAI Smoke Test

Use this checklist when testing `AI_PROVIDER=openai` locally.

## Start Backend In OpenAI Mode

```powershell
$env:DATABASE_URL='postgresql://optime:optime@localhost:5432/optime?schema=public'
$env:AI_PROVIDER='openai'
$env:OPENAI_API_KEY='your-api-key'
$env:OPENAI_DEFAULT_MODEL='your-model'
pnpm --filter @optime/api start:dev
```

Mock mode remains the default:

```powershell
Remove-Item Env:\AI_PROVIDER -ErrorAction SilentlyContinue
Remove-Item Env:\OPENAI_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:\OPENAI_DEFAULT_MODEL -ErrorAction SilentlyContinue
pnpm --filter @optime/api start:dev
```

## Backend Logs To Check

Expected successful OpenAI path:

```text
selected provider: openai
daily plan generation started; provider=openai
provider called: openai
OpenAI request started; retryAttempt=false; model=...
OpenAI response received; retryAttempt=false; model=...
OpenAI output_text present: true
OpenAI JSON parse passed
OpenAI metadata normalized
OpenAI schema validation passed
SafetyService passed: true
daily plan generation completed; fallback used: false; final status=READY
```

Expected fallback path:

```text
fallback used: true
fallback reason=...
final status=FALLBACK
```

Request failure logs include safe OpenAI SDK details:

```text
OpenAI SDK error; reason=openai_invalid_model; retryAttempt=false; model=...; name=BadRequestError; message=...; status=400; code=model_not_found; type=...
OpenAI request/output failed; retrying. reason=openai_invalid_model
OpenAI SDK error; reason=openai_invalid_model; retryAttempt=true; model=...; name=BadRequestError; message=...; status=400; code=model_not_found; type=...
```

Do not log:

- `OPENAI_API_KEY`
- full prompt
- full profile
- password hash
- tokens
- full OpenAI raw response

## DBeaver Checks

Open the latest `DailyPlan` row.

Successful OpenAI plan:

- `status = READY`
- `planJson.schemaVersion = "sprint-2.v1"`
- `planJson.generatedAt` is a backend-generated ISO timestamp.
- `planJson.mockVersion = 0`.
- User-facing title/message should reference `planLocalDate` if they mention a date.
- User-facing title/message must not derive dates from `generatedAt`.
- `planJson.debug.provider = "openai"`
- `planJson.debug.generatedBy = "OpenAiProviderService"`
- `planJson.debug.fallbackReason` is empty or missing

Fallback plan:

- `status = FALLBACK`
- `planJson.debug.provider = "fallback"`
- `planJson.debug.generatedBy = "SafeFallbackPlanFactory"`
- `planJson.debug.fallbackReason` explains why fallback happened

If fallback is caused by food safety, backend logs include the matched path:

```text
SafetyService failed: allergy conflict at nutrition.meals[1].foods[0].name; restrictedFood=avocado; matchedFoodName=Avocado toast
```

Mentions like `Avoid avocado` or `This plan avoids pork` should not trigger fallback.

Mock plan:

- `status = READY`
- `planJson.debug.provider = "mock"`
- `planJson.debug.generatedBy = "MockAiProviderService"`

## Common Fallback Reasons

- `openai_auth_error`: invalid or unauthorized API key.
- `openai_invalid_model`: `OPENAI_DEFAULT_MODEL` is unavailable, misspelled, or not enabled.
- `openai_rate_limited`: account/project/model rate limit.
- `openai_bad_request`: general 400 request error.
- `openai_timeout`: request timed out.
- `openai_network_error`: network or connection failure.
- `openai_structured_output_request_invalid`: Structured Outputs request/schema shape was rejected.
- `missing_output_text`: response did not include text output.
- `json_parse_failed`: output was not valid JSON.
- `schema_validation_failed`: output did not match `DailyPlanJson`.
- `unknown_openai_error`: unclassified provider error.
- `The generated plan included a food that conflicts with your allergies or excluded foods.`
- `The generated plan could not be safely validated.`

## How To Identify Common Issues

Invalid model:

- Backend log reason: `openai_invalid_model`.
- DBeaver `planJson.debug.fallbackReason`: `openai_invalid_model`.
- Check `OPENAI_DEFAULT_MODEL`.

Auth error:

- Backend log reason: `openai_auth_error`.
- DBeaver `planJson.debug.fallbackReason`: `openai_auth_error`.
- Check `OPENAI_API_KEY` and project permissions.

Structured output bad request:

- Backend log reason: `openai_structured_output_request_invalid`.
- DBeaver `planJson.debug.fallbackReason`: `openai_structured_output_request_invalid`.
- Usually means `text.format` or the JSON schema is rejected by the API.

Rate limit:

- Backend log reason: `openai_rate_limited`.
- DBeaver `planJson.debug.fallbackReason`: `openai_rate_limited`.
- Wait, use a different model, or check account/project limits.

Timeout:

- Backend log reason: `openai_timeout`.
- DBeaver `planJson.debug.fallbackReason`: `openai_timeout`.
- Increase `OPENAI_REQUEST_TIMEOUT_MS` only if needed.

## Smoke Test Steps

1. Start backend with `AI_PROVIDER=openai`.
2. Start mobile normally.
3. Log in.
4. Complete onboarding if needed.
5. Open Today.
6. Tap Refresh plan.
7. Watch backend logs.
8. Check `DailyPlan.status` in DBeaver.
9. Check `planJson.debug`.
10. Confirm mobile still renders the plan and does not show debug metadata.

## Optional OpenAI Safety Agent Smoke Test

OpenAI Safety Agent is disabled by default. To test it locally:

```powershell
$env:SAFETY_AGENT_ENABLED='true'
$env:SAFETY_AGENT_PROVIDER='openai'
$env:OPENAI_API_KEY='your-api-key'
$env:OPENAI_DEFAULT_MODEL='your-model'
pnpm --filter @optime/api start:dev
```

Expected successful Safety Agent path:

```text
SafetyAgent enabled=true; provider=openai
SafetyAgent OpenAI request started; provider=openai; model=...
SafetyAgent OpenAI response received; provider=openai
SafetyAgent OpenAI review validated; approved=true; riskLevel=low; reasonCount=0
SafetyAgent review completed; provider=openai; approved=true; riskLevel=low; reasonCount=0
```

In DBeaver, a READY plan reviewed by OpenAI Safety Agent should include:

- `planJson.debug.safetyAgent.enabled = true`
- `planJson.debug.safetyAgent.provider = "openai"`
- `planJson.debug.safetyAgent.approved = true`
- `planJson.debug.safetyAgent.riskLevel = "low"`

If Safety Agent rejects or fails, the plan should be `FALLBACK` with one of:

- `safety_agent_rejected`
- `safety_agent_invalid_review`
- `safety_agent_unavailable`

Deterministic SafetyService still runs first. Allergy, excluded food, minor, dangerous-goal, schema, and training boundary failures should fallback before the Safety Agent is called.

Retry with safety feedback is deferred to Batch 4.4.

## Expected Result

The smoke test is successful only when:

- `DailyPlan.status = READY`
- `planJson.debug.provider = "openai"`
- `planJson.debug.generatedBy = "OpenAiProviderService"`
- `planJson.debug.fallbackReason` is missing or empty
- `planJson.generatedAt` is valid ISO format even if the model returned bad metadata
- user-facing date references align with `planLocalDate`, not `generatedAt`
- backend logs show JSON parse and schema validation passed
- backend logs show `OpenAI metadata normalized`
- backend logs show `SafetyService passed: true`

## Production Note

`planJson.debug` is useful during development and smoke testing. Before production, hide it behind environment config or remove it from persisted user-visible plan JSON.
