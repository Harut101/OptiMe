# Sprint 4 Summary

Sprint 4 added the monetization and tier foundation without real payments.

## What Sprint 4 Added

Backend:

- `Subscription` schema for future App Store and Google Play history.
- `EntitlementsService`.
- `FeatureAccessService`.
- Backend-resolved `PlanQualityMode`: `BASIC`, `PERSONALIZED`, `ADAPTIVE`.
- `GET /v1/me/entitlements`.
- `UsageLedger`.
- `UsageGuardService`.
- `GET /v1/me/usage`.
- Friendly `USAGE_LIMIT_REACHED` error.

Daily plan behavior:

- `PlanQualityMode` is passed into `AiProvider`.
- OpenAI prompt depth changes by mode.
- `nutrition.menuOptions` varies by tier.
- Existing mobile remains compatible through `nutrition.meals`.
- Usage limits are enforced for generation and refresh.
- Reads and safety checks remain unlimited.

Safety and profile context:

- Gender is available as careful personalization context.
- Pregnancy/postpartum/breastfeeding status is optional and privacy-sensitive.
- Pregnancy/postpartum/breastfeeding safety is deterministic and not paywalled.
- Safety remains equal across Free, Plus, and Pro.

Mobile:

- Gender field visible in Profile onboarding.
- Pregnancy/postpartum context appears only when gender is female.
- Tier/usage placeholders in Settings/Profile.
- Today screen shows usage status when available.
- `USAGE_LIMIT_REACHED` renders friendly copy.
- No real purchase flow.

## Usage And Entitlement Status

Current plan resolution:

- No active subscription: `FREE`.
- Active Plus subscription: `PLUS`.
- Active Pro subscription: `PRO`.
- Overlapping active subscriptions resolve to highest tier.
- Client-provided plan is ignored.

Current usage limits:

- Free: 1 generation/day, 1 refresh/day, 1 AI generation/day.
- Plus: 5/day for those actions.
- Pro: 20/day for those actions.

Usage does not count:

- `GET /v1/daily-plans/today`.
- Returning an existing plan with `forceRegenerate=false`.
- Auth failures.
- Incomplete onboarding.
- Profile/onboarding updates.
- Internal safety checks.

## Mobile Placeholder Status

Mobile now shows:

- Current plan.
- Plan quality mode.
- Generation and refresh limits.
- Generations/refreshes left today.
- Upgrade options coming soon.

This is not a paywall. It is a placeholder until real payment integration.

## Remaining Limitations

- No real App Store or Google Play payments.
- No receipt validation.
- No restore purchases.
- No real paywall.
- No WHOOP.
- No AI Coach chat.
- No embeddings.
- No admin/web.
- No ExerciseLibrary.
- No progressive onboarding yet.
- No check-ins yet.
- No protocol/template layer yet.
