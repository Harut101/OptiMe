# Sprint 3 Summary

Sprint 3 added real backend-only OpenAI daily plan generation while preserving the existing mock mode, deterministic safety rules, normalized `DailyPlanJson`, and mobile API contract.

## What Sprint 3 Added

- `OpenAiProviderService` behind the existing `AiProvider` interface.
- `AI_PROVIDER=mock | openai` provider selection.
- Responses API generation with Structured Outputs.
- Backend-owned metadata normalization for `schemaVersion`, `generatedAt`, `mockVersion`, and debug metadata.
- Food name normalization before deterministic safety checks.
- OpenAI Safety Agent semantic review behind config.
- Retry-with-safety-feedback for rejected OpenAI plans.
- Minimal `AiOperationLog` observability table.
- Smoke-test and boundary documentation for OpenAI, Safety Agent, and operational logging.

## Provider Modes

Mock mode is the default:

```env
AI_PROVIDER=mock
```

Mock mode:

- Requires no OpenAI credentials.
- Uses `MockAiProviderService`.
- Produces normalized `DailyPlanJson`.
- Remains useful for local development and tests.

OpenAI mode:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_DEFAULT_MODEL=
```

OpenAI mode:

- Calls OpenAI only from the NestJS backend.
- Uses the Responses API.
- Requests Structured Outputs matching `DailyPlanJson`.
- Validates output before deterministic safety.
- Falls back safely if provider output is invalid or unavailable.

The mobile app never calls OpenAI and never receives OpenAI credentials.

## Daily Plan Safety Pipeline

The final daily plan pipeline is:

```text
DailyPlansService
-> AiProvider.generateDailyPlan()
-> normalize backend metadata
-> normalize food names
-> validate DailyPlanJson schema
-> deterministic SafetyService
-> optional Safety Agent semantic review
-> optional one retry with Safety Agent feedback
-> persist READY or FALLBACK
-> write best-effort AiOperationLog
```

Deterministic `SafetyService` remains the authority for hard rules:

- Allergies.
- Excluded foods.
- `safeMode`.
- Under-18 behavior.
- Dangerous weight-loss goals.
- Training duration and intensity boundaries.
- Unsafe symptom/training wording checks.
- Schema validation and fallback behavior.

The Safety Agent does not replace deterministic checks.

## OpenAI Safety Agent

The Safety Agent is controlled by:

```env
SAFETY_AGENT_ENABLED=false
SAFETY_AGENT_PROVIDER=mock
```

OpenAI Safety Agent local mode:

```env
SAFETY_AGENT_ENABLED=true
SAFETY_AGENT_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_DEFAULT_MODEL=
```

It reviews semantic safety after deterministic checks pass:

- Unsafe diet advice.
- Unsafe training advice.
- Body-shaming or guilt language.
- Medical diagnosis language.
- Extreme calorie restriction language.
- Unsafe under-18 recommendations.
- Tone conflicts with safe, supportive product language.

If it rejects an OpenAI-generated plan and provides actionable `requiredChanges`, the backend retries OpenAI generation once with concise safety feedback.

## AiOperationLog

Sprint 3 added `AiOperationLog` for internal observability only.

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
- Full profiles.
- Password hashes.
- API keys.
- Raw OpenAI responses.
- Auth tokens.
- Sensitive notes.

`AiOperationLog` is not a `UsageLedger`, payment system, subscription feature, entitlement guard, or billing enforcement mechanism.

## Local Environment Variables

Core:

```env
DATABASE_URL=postgresql://optime:optime@localhost:5432/optime?schema=public
TEST_DATABASE_URL=postgresql://optime:optime@localhost:5432/optime_test?schema=public
```

OpenAI provider:

```env
AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_DEFAULT_MODEL=
OPENAI_REQUEST_TIMEOUT_MS=45000
OPENAI_MAX_OUTPUT_TOKENS=4000
```

Safety Agent:

```env
SAFETY_AGENT_ENABLED=false
SAFETY_AGENT_PROVIDER=mock
```

## Smoke Test Steps

1. Start Postgres.
2. Run dev migrations.
3. Start the API with either mock or OpenAI env vars.
4. Start mobile.
5. Register or log in.
6. Complete onboarding.
7. Open Today.
8. Refresh the plan.
9. Confirm `DailyPlan.status = READY` or a safe `FALLBACK`.
10. Confirm mobile does not render `planJson.debug`.
11. Confirm `AiOperationLog` contains safe metadata only.

See `docs/sprint-3-openai-smoke-test.md` for the detailed OpenAI and Safety Agent checklist.

## Known Limitations

- `planJson.debug` is still stored for development verification and should be hidden behind config or removed before production.
- `AiOperationLog.retryCount` captures Safety Agent regeneration retry, not every provider-internal OpenAI retry.
- No cost enforcement exists yet.
- No subscription or entitlement checks exist yet.
- No user-facing AI Coach chat exists yet.
- No WHOOP integration exists yet.
- No admin dashboard exists yet.

## Out Of Scope In Sprint 3

- WHOOP.
- Payments.
- Subscriptions.
- `UsageLedger`.
- `EntitlementService`.
- `UsageGuardService`.
- AI Coach chat.
- Embeddings.
- Weekly reports.
- Admin panel.
- Web app.

## Sprint 4 Preview

Sprint 4 should focus on pricing, feature access, subscriptions, and usage limits.

Recommended Sprint 4 scope:

- Subscription and entitlement schema.
- App Store / Google Play subscription event model.
- `EntitlementService`.
- `UsageLedger` with daily/monthly periods.
- `UsageGuardService` for daily plan and AI features.
- Plan-based feature gates for Free, Plus, and Pro.
- Mobile paywall/pricing placeholders only after backend entitlements are stable.

Do not start Sprint 4 implementation until the Sprint 4 plan is approved.
