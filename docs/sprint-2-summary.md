# Sprint 2 Summary

Sprint 2 added the backend safety and daily-plan foundation needed before real AI integration. The product still uses mock planning only; no external AI calls exist yet.

## Added

- Deterministic `SafetyModule` and `SafetyService`.
- Backend-managed `safeMode` derived from `Profile.dateOfBirth`.
- Under-18 safe behavior.
- Dangerous weight-loss validation.
- Allergy and excluded-food enforcement.
- Training duration, intensity, and unsafe wording checks.
- Normalized `DailyPlanJson` contract with `schemaVersion: "sprint-2.v1"`.
- Safe fallback daily plan template using the same normalized contract.
- Backward compatibility for older Sprint 1 `planJson`.
- Daily plan history endpoint.
- Daily plan feedback endpoint and mobile feedback UI.
- `AiProvider` boundary with `MockAiProviderService`.

## Safety Foundation

Safety is deterministic and backend-controlled. User input is validated before persistence where practical, and provider output is validated after generation before it is persisted or returned.

Current protected areas:

- Age and safe mode.
- Weight-loss goal pace and total target.
- Minor-safe wellness behavior.
- Allergy and excluded food conflicts.
- Training duration and intensity boundaries.
- Unsafe workout descriptions involving pain, illness, dizziness, exhaustion, injury, fever, fainting, or chest pain.

## DailyPlanJson

Daily plans now use one stable contract for backend and mobile:

- `schemaVersion: "sprint-2.v1"`
- `summary`
- `nutrition`
- `training`
- `recovery`
- `reminders`
- `safety`

Backend generation, fallback plans, history, Today, and Plan Details all use this normalized shape.

## History And Feedback

Sprint 2 added:

- `GET /v1/daily-plans/history?limit=10`
- `POST /v1/daily-plans/:id/feedback`

Feedback is one record per user and daily plan. Submitting again updates the existing feedback. Users cannot access or submit feedback for another user's plan.

## AiProvider Seam

`DailyPlansService` now depends on `AiProvider`, injected through `AI_PROVIDER`.

Current implementation:

- `MockAiProviderService`
- No OpenAI SDK.
- No API keys.
- No external AI calls.

Future real AI must plug into this provider boundary and return valid `DailyPlanJson`.

## Out Of Scope

Still not implemented:

- Real OpenAI integration.
- OpenAI SDK.
- WHOOP.
- Payments.
- Subscriptions.
- `UsageLedger`.
- `EntitlementService`.
- `UsageGuardService`.
- Weekly reports.
- AI Coach chat.
- Embeddings.
- Admin panel.
- Web app.

## Verification

Expected checks:

```powershell
pnpm --filter @optime/api build
$env:DATABASE_URL='postgresql://optime:optime@localhost:5432/optime?schema=public'; pnpm --filter @optime/api test:e2e
pnpm --filter @optime/mobile typecheck
```
