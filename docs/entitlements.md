# Entitlements

Sprint 4 Batch 1 adds backend-owned subscription history and entitlement resolution. It does not add real App Store or Google Play payments yet.

## Pricing Philosophy

Pricing is based on personalization depth and adaptive coaching quality, not on safety.

Safety must never be paywalled. All users get:

- `DailyPlanJson` schema validation.
- Deterministic `SafetyService`.
- Safe fallback plans.
- Allergy checks.
- Excluded food checks.
- Under-18 safety.
- Pregnancy, postpartum, and breastfeeding safety.
- Dangerous goal protection.
- AI Safety Agent review when needed for safety.

Paid plans improve:

- Personalization depth.
- History and feedback usage.
- Plan detail quality.
- Refresh/generation limits.
- Future WHOOP adaptation.
- Future AI Coach access.

## Plans

| Plan | Positioning | PlanQualityMode |
|---|---|---|
| `FREE` | Proves usefulness | `BASIC` |
| `PLUS` | Improves habit consistency | `PERSONALIZED` |
| `PRO` | Adaptive coaching | `ADAPTIVE` |

## PlanQualityMode

`BASIC`:

- Safe daily plan.
- Simple meal guidance.
- Simple training guidance.
- Minimal personalization.

`PERSONALIZED`:

- More detailed meals.
- Better use of preferences.
- Better use of schedule and goals.
- Future feedback-based personalization.

`ADAPTIVE`:

- Deeper personalization.
- Future history, feedback, readiness, WHOOP recovery, sleep, and strain signals.
- Future AI Coach access.

## Subscription History

`Subscription` rows are backend-owned. The client must never be trusted as the source of subscription state.

The schema supports future App Store and Google Play data:

- `providerCustomerId`
- `providerSubscriptionId`
- `providerTransactionId`
- `originalTransactionId`
- `providerProductId`
- `environment`
- `startsAt`
- `expiresAt`
- `canceledAt`
- `status`

Current providers:

- `APP_STORE`
- `GOOGLE_PLAY`
- `DEV`

`DEV` is for local/test records only. It is not real billing.

## Entitlement Resolution

`EntitlementsService` resolves the current plan from subscription history.

Rules:

- No subscription resolves to `FREE`.
- `TRIALING`, `ACTIVE`, and `GRACE_PERIOD` count as active when within dates.
- `CANCELED` remains active only until `expiresAt`.
- `EXPIRED` is inactive.
- `PAST_DUE` is inactive for now.
- Overlapping active subscriptions resolve to the highest plan: `PRO > PLUS > FREE`.
- Future `startsAt` rows are inactive until their start date.
- Expired `expiresAt` rows are inactive.

Summary shape:

```ts
{
  currentPlan: "FREE" | "PLUS" | "PRO";
  planQualityMode: "BASIC" | "PERSONALIZED" | "ADAPTIVE";
  isPremium: boolean;
  activeSubscriptionId?: string;
  source: "subscription" | "default_free";
  features: {
    canGenerateDailyPlan: boolean;
    canRefreshPlan: boolean;
    canUseOpenAIProvider: boolean;
    canUseAdvancedPersonalization: boolean;
    canUseFeedbackPersonalization: boolean;
    canViewHistory: boolean;
    canSubmitFeedback: boolean;
    canUseWeeklyReports: boolean;
    canUseWhoop: boolean;
    canUseAiCoach: boolean;
  };
}
```

## Endpoint

```http
GET /v1/me/entitlements
```

Requirements:

- JWT protected.
- Returns backend-resolved entitlement summary.
- Includes feature flags derived from the backend-resolved plan.
- Ignores query/body/client-provided plan values.

## Feature Access

Batch 2 adds `FeatureAccessService`.

Current MVP behavior:

- `canGenerateDailyPlan`: all tiers.
- `canRefreshPlan`: all tiers.
- `canUseOpenAIProvider`: all tiers.
- `canUseAdvancedPersonalization`: `PLUS` and `PRO`.
- `canUseFeedbackPersonalization`: `PLUS` and `PRO`.
- `canViewHistory`: all tiers.
- `canSubmitFeedback`: all tiers.
- `canUseWeeklyReports`: `PLUS` and `PRO`, future feature.
- `canUseWhoop`: `PRO`, future feature.
- `canUseAiCoach`: `PRO`, future feature.

Safety is not represented as a paid feature gate. It always runs independently of entitlement state.

## DEV Helper Decision

Batch 1 does not add `POST /v1/dev/subscription`.

Reason:

- It is safer to keep runtime API surface small.
- Tests seed `DEV` subscription rows directly through Prisma.
- A dev-only helper can be added later if local QA needs it, guarded by `NODE_ENV !== "production"` and JWT auth.

## Future App Store / Google Play Support

Future payment batches should:

- Validate receipts/server events.
- Normalize provider events into subscription history rows.
- Reconcile status changes.
- Never trust mobile-provided entitlement state.
- Keep safety independent of billing state.

## Still Not Implemented

- `UsageLedger`.
- `UsageGuardService`.
- Real purchases.
- Receipt validation.
- Provider webhooks.
- Paywall UI.
- WHOOP.
- AI Coach chat.
- Embeddings.
- Admin/web.
