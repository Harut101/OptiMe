# Safety Agent Design

Sprint 3 Batch 4.1 adds the Safety Agent boundary only. It does not change mobile behavior, daily plan responses, or current OpenAI daily plan generation behavior.

## Deterministic SafetyService Remains The Authority

`SafetyService` owns hard safety rules:

- Allergies.
- Excluded foods.
- `safeMode`.
- Under-18 behavior.
- Dangerous weight-loss goals.
- Training duration and intensity boundaries.
- Unsafe training description checks.
- `DailyPlanJson` schema validation and fallback behavior.

The Safety Agent must never replace these checks. It runs later only as semantic review.

## Safety Agent Responsibility

The future AI Safety Agent reviews for issues deterministic rules may miss:

- Unsafe diet advice.
- Unsafe training advice.
- Body-shaming language.
- Medical diagnosis language.
- Extreme calorie restriction language.
- Unsafe under-18 recommendations.
- Tone that conflicts with the product voice.
- Semantic conflict with `safeMode`.

## Batch 4.1 Behavior

Current implementation:

- `SAFETY_AGENT_ENABLED=false` by default.
- `SAFETY_AGENT_PROVIDER=mock` by default.
- `MockSafetyAgentService` approves by default.
- No OpenAI Safety Agent calls exist yet.
- `DailyPlansService` does not call the Safety Agent yet.
- No mobile behavior changes.
- No API response shape changes.

## Batch 4.2 Integration

`DailyPlansService` now has an optional semantic safety review stage behind `SAFETY_AGENT_ENABLED`.

Default behavior remains unchanged:

- When `SAFETY_AGENT_ENABLED=false`, the Safety Agent is not called.
- Existing deterministic safety and OpenAI plan generation behavior is unchanged.
- No mobile behavior changes.
- No API response shape changes.

When enabled:

- Safety Agent runs only after schema validation, food name normalization, and deterministic `SafetyService` pass.
- Deterministic safety failures skip Safety Agent and fallback immediately.
- `MockSafetyAgentService` approves by default.
- An approved review saves the plan as `READY`.
- A rejected, invalid, or unavailable review saves a safe fallback plan.

Fallback reasons:

- `safety_agent_rejected`
- `safety_agent_invalid_review`
- `safety_agent_unavailable`

Debug metadata may include:

```json
{
  "safetyAgent": {
    "enabled": true,
    "provider": "mock",
    "approved": true,
    "riskLevel": "low"
  }
}
```

Mobile must not render debug metadata.

OpenAI Safety Agent behavior is still future work. Batch 4.2 does not add OpenAI Safety Agent calls, prompts, or retry with safety feedback.

## Batch 4.3 OpenAI Safety Agent

Batch 4.3 adds `OpenAiSafetyAgentService` behind config only.

Defaults remain:

```env
SAFETY_AGENT_ENABLED=false
SAFETY_AGENT_PROVIDER=mock
```

To enable OpenAI Safety Agent locally:

```env
SAFETY_AGENT_ENABLED=true
SAFETY_AGENT_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_DEFAULT_MODEL=your-model
```

`SAFETY_AGENT_PROVIDER=openai` is only required to have OpenAI credentials when `SAFETY_AGENT_ENABLED=true`. Disabled mode does not require Safety Agent OpenAI config.

The OpenAI Safety Agent:

- Uses the backend OpenAI client only.
- Uses Responses API structured JSON output.
- Returns `SafetyAgentReview` only.
- Validates the review with `safetyAgentReviewSchema`.
- Does not replace deterministic `SafetyService`.
- Does not retry with safety feedback yet.

Semantic review covers:

- Unsafe diet advice.
- Extreme calorie restriction or starvation advice.
- Unsafe training advice.
- Training through pain, illness, dizziness, or exhaustion.
- Body-shaming or guilt language.
- Medical diagnosis language.
- Unsafe under-18 recommendations.
- Conflict with `safeMode`.
- Unsupported supplement or medical claims.
- Overly aggressive weight-loss framing.
- Tone that is not supportive or health-focused.

Expected safe logs:

```text
SafetyAgent enabled=true; provider=openai
SafetyAgent OpenAI request started; provider=openai; model=...
SafetyAgent OpenAI response received; provider=openai
SafetyAgent OpenAI review validated; approved=true; riskLevel=low; reasonCount=0
SafetyAgent review completed; provider=openai; approved=true; riskLevel=low; reasonCount=0
```

Do not log full prompts, full plans, full profiles, API keys, tokens, or raw OpenAI responses.

Fallback reasons:

- `safety_agent_rejected`
- `safety_agent_invalid_review`
- `safety_agent_unavailable`

Retry with safety feedback is intentionally deferred to Batch 4.4. In Batch 4.3, Safety Agent rejection saves fallback.

## Batch 4.4 Retry With Safety Feedback

Batch 4.4 adds one retry when an OpenAI-generated daily plan passes deterministic safety but fails semantic Safety Agent review.

Retry is intentionally narrow. It runs only when all are true:

- `AI_PROVIDER=openai`.
- `SAFETY_AGENT_ENABLED=true`.
- The daily plan provider is `OpenAiProviderService`.
- `DailyPlanJson` schema validation passed.
- Food name normalization completed.
- Deterministic `SafetyService` passed.
- Safety Agent reviewed the plan and rejected it.
- `SafetyAgentReview.requiredChanges` contains actionable items.

Retry does not run when:

- Deterministic `SafetyService` fails.
- Schema validation fails before Safety Agent review.
- Provider is mock.
- Safety Agent is disabled.
- Safety Agent is unavailable or throws.
- Safety Agent returns an invalid review.
- The provider already returned fallback.

Retry behavior:

- The first rejected Safety Agent review is converted into concise `safetyFeedback`.
- `safetyFeedback` includes only `riskLevel`, `reasons`, and `requiredChanges`.
- `OpenAiProviderService` regenerates a complete `DailyPlanJson`; it does not patch partial fields.
- The regenerated plan runs through metadata normalization, food name normalization, schema validation, deterministic `SafetyService`, and Safety Agent review again.
- If the second Safety Agent review approves, the plan is saved as `READY`.
- If the second review rejects, fails, or the retry output is invalid, the plan is saved as `FALLBACK`.

Additional fallback reasons:

- `safety_agent_retry_rejected`
- `safety_agent_retry_failed`
- `safety_agent_retry_invalid_output`

Debug metadata may include:

```json
{
  "safetyAgent": {
    "enabled": true,
    "provider": "openai",
    "approved": true,
    "riskLevel": "low",
    "retryUsed": true,
    "retryResult": "approved"
  }
}
```

`retryResult` can be `approved`, `rejected`, `failed`, or `not_used`. Mobile must not render debug metadata.

Expected retry logs:

```text
SafetyAgent rejected plan; safety retry available=true; reasonCount=...
safety retry triggered=true; reasonCount=...
safety retry generation started
retry SafetyAgent approved=true
daily plan generation completed; fallback used: false; final status=READY
```

Do not log full prompts, full plans, full profiles, API keys, tokens, or raw OpenAI responses.

## SafetyAgentReview

```ts
type SafetyAgentReview = {
  approved: boolean;
  riskLevel: "low" | "medium" | "high";
  reasons: string[];
  requiredChanges: string[];
  safeUserMessage?: string;
};
```

Validation rules:

- `approved=true` requires `riskLevel="low"`.
- `approved=false` requires at least one reason.
- `safeUserMessage`, when present, must avoid shame, guilt, punishment, or body-negative language.

## Logging Rules

Future Safety Agent logging should include only safe operational metadata:

- enabled or disabled state.
- provider name.
- approved or rejected.
- risk level.
- reason count or safe reason codes.

Do not log:

- API keys.
- full prompts.
- full user profiles.
- password hashes.
- auth tokens.
- full generated plans.

## Future Work

Future work can improve Safety Agent cost controls and persistence, but should not replace deterministic hard safety rules.
