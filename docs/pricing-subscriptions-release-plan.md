# Pricing And Subscriptions Release Plan

## Status

This document freezes the launch-candidate pricing and purchase architecture for
implementation planning. It does not enable billing, add a paywall, create store
products, or grant paid access from the mobile client.

Real purchases remain blocked until the AI quality/economics gate, store setup,
sandbox lifecycle QA, legal review, and release configuration are complete.

## Product Principles

- Safety is never paywalled.
- Free must remain useful, safe, and complete enough to demonstrate OptiMe.
- Paid tiers add personalization, choice, adaptation, and higher-cost actions.
- No tier is unlimited.
- Mobile may start or restore a purchase, but it never grants an entitlement.
- Backend-resolved entitlements remain the authority for API access.
- Store and purchase-provider state must be reconciled, not trusted from a single
  client callback.

## Launch-Candidate Prices

| Tier | Monthly | Annual | Effective monthly | Annual discount |
|---|---:|---:|---:|---:|
| `FREE` | `$0` | `$0` | `$0` | n/a |
| `PLUS` | `$19.99` | `$199.99` | `$16.67` | about `16.6%` |
| `PRO` | `$39.99` | `$399.99` | `$33.33` | about `16.7%` |

These are the canonical USD launch candidates. Apple and Google own localized
storefront pricing and tax display. Regional products must not be activated
below the approved contribution-margin floor.

No introductory trial is included in the first implementation. A trial can be
added later only after conversion, refund, support, and abuse behavior are
measured.

## Customer-Facing Tier Contract

### Free / Basic

- One safe Basic Daily Plan per local day.
- Cost-efficient `LUNA` route.
- Nutrition and optional training guidance.
- Food tracking, workout execution/history, plan history, and check-ins.
- Apple Health basic sync/context where available.
- Deterministic substitutions and all safety behavior.
- No manual full-plan refresh.
- Up to two AI meal regenerations per month.
- No full-menu regeneration or AI checkpoint rewrite.

### Plus / Personalized

- Everything in Free.
- Personalized `TERRA` planning.
- Preference- and feedback-aware nutrition/training recommendations.
- Up to three manual full-plan refreshes per month.
- Up to twelve meal regenerations and two menu regenerations per month.
- Up to eight AI Adaptive Plan Checkpoint proposals per month.
- Weekly summaries and bounded AI Training Load guidance.

### Pro / Adaptive

- Everything in Plus.
- Adaptive planning through the internal `SOL` route. The launch benchmark
  currently favors Terra as the provider model behind this route.
- Deeper use of history, feedback, current health context, and recovery context.
- Up to ten manual full-plan refreshes per month.
- Up to thirty meal regenerations and six menu regenerations per month.
- Up to twenty AI Adaptive Plan Checkpoint proposals per month.
- WHOOP integration and advanced wearable insights after provider approval.
- Future AI Coach access when that product is implemented and approved.

The entitlement and usage matrices in the backend are the executable contract.
Marketing copy must not promise a feature that is only represented by a future
entitlement flag.

## Financial Guardrails

Forecasts use a conservative `20%` storefront reserve until actual regional
settlement reports are available. This reserve is deliberately higher than
qualifying 15% small-business/subscription rates and does not replace local tax,
refund, infrastructure, support, or purchase-platform cost modeling.

| Tier/period | Gross monthly equivalent | Planning net after 20% reserve | Median AI ceiling (15%) | p95 AI ceiling (25%) | Total variable ceiling (35%) |
|---|---:|---:|---:|---:|---:|
| Plus monthly | `$19.99` | `$15.99` | `$2.40` | `$4.00` | `$5.60` |
| Plus annual | `$16.67` | `$13.33` | `$2.00` | `$3.33` | `$4.67` |
| Pro monthly | `$39.99` | `$31.99` | `$4.80` | `$8.00` | `$11.20` |
| Pro annual | `$33.33` | `$26.67` | `$4.00` | `$6.67` | `$9.33` |

The strict `ai-release:gate` must pass with representative usage for every tier.
Free is evaluated against an explicitly configured acquisition-cost ceiling,
not paid revenue. Its ceiling must be based on measured complete operations,
including retries and fallback paths, rather than an assumed per-request price.

RevenueCat's current public pricing is free up to `$2,500` monthly tracked
revenue and then `1%` of tracked revenue. Treat this as another variable cost,
verify it again immediately before launch, and include it in the 35% total
variable-cost ceiling.

### Measured 1,700-user scenario

The July 31, 2026 controlled benchmark measured a complete daily generation at
about `$0.0519` for Free/Luna, `$0.1173` for Plus/Terra, and `$0.1220` for a
Pro/Adaptive context using Terra. At 1,000 Free, 500 monthly Plus, and 200
monthly Pro users, with every user generating one plan on all 30 days:

| Item | Monthly amount |
| --- | ---: |
| Gross subscription revenue | `$17,993` |
| Net after conservative 20% storefront reserve | `$14,394` |
| Measured daily-plan AI cost | `$4,047` |
| RevenueCat reserve at 1% of gross | `$180` |
| Initial infrastructure allowance | `$500` |
| Contribution before salaries, marketing, tax, refunds, and support | `$9,668` |

This is the daily-generation floor, not a maximum-usage forecast. For an active
allowance scenario, use the existing p95 AI ceilings of `$4` per Plus user and
`$8` per Pro user while retaining the measured `$1.56` Free cost. That produces
about `$5,156` total AI cost and `$8,559` monthly contribution under the same
storefront, RevenueCat, and infrastructure assumptions. Treat `$8.6k-$9.7k` as
the current planning range, not accounting profit. Annual-plan mix, regional
prices, tax, refunds, payroll, marketing, support, and higher infrastructure
reduce it further.

References:

- [Apple App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/)
- [Google Play service fees](https://support.google.com/googleplay/android-developer/answer/112622)
- [RevenueCat pricing](https://www.revenuecat.com/pricing)

## Purchase Architecture Decision

Use RevenueCat for the first-release cross-platform purchase lifecycle.

```txt
App Store / Google Play
          |
          v
RevenueCat SDK and subscription backend
          |
          | signed/authorized webhook + server reconciliation
          v
OptiMe Billing boundary
          |
          v
Subscription -> EntitlementsService -> FeatureAccessService / UsageGuardService
```

Responsibilities:

- App Store and Google Play process payment and remain the transaction source.
- RevenueCat normalizes StoreKit/Google Play purchase and lifecycle behavior.
- Mobile displays store-owned products and starts purchase/restore operations.
- OptiMe backend verifies webhook/reconciliation data and persists normalized
  subscription state.
- `EntitlementsService` remains the final authorization source for OptiMe APIs.

Why not implement StoreKit 2 and Google Play Billing independently first:

- It duplicates lifecycle, restore, proration, grace-period, and receipt work.
- It creates more release-critical native and backend paths for a small team.
- RevenueCat supports React Native and both stores while preserving an exit path
  because OptiMe keeps its own normalized subscription contract.

Direct store integrations remain a future migration option, not a parallel
first-release implementation.

## Identity And Trust Boundary

- Purchases require a signed-in, email-verified OptiMe account.
- Configure RevenueCat with the immutable OptiMe `user.id` as App User ID.
- Do not use email, display name, or another mutable/private field as identity.
- Do not grant access from a mobile `purchase completed` callback alone.
- Mobile refreshes `GET /v1/me/entitlements` after purchase or restore.
- Backend webhook/reconciliation updates the normalized `Subscription`.
- Webhook processing must be authenticated, idempotent, and safe to replay.
- Never log receipts, raw purchase tokens, full webhook payloads, or store secrets.
- Never expose RevenueCat secret API keys to mobile. Only platform public SDK keys
  may be shipped in their corresponding apps.

RevenueCat restore/transfer behavior must be configured to avoid silently moving
a subscription between different OptiMe accounts on a shared store account.
Ambiguous ownership requires an explicit support/recovery flow.

## Canonical Product Catalog

Internal product keys are store-independent:

| Internal key | Tier | Period | Apple product ID | Google subscription/base plan |
|---|---|---|---|---|
| `PLUS_MONTHLY` | Plus | Monthly | `com.optime.app.plus.monthly` | `optime_plus` / `monthly` |
| `PLUS_ANNUAL` | Plus | Annual | `com.optime.app.plus.annual` | `optime_plus` / `annual` |
| `PRO_MONTHLY` | Pro | Monthly | `com.optime.app.pro.monthly` | `optime_pro` / `monthly` |
| `PRO_ANNUAL` | Pro | Annual | `com.optime.app.pro.annual` | `optime_pro` / `annual` |

RevenueCat entitlements:

- `plus`
- `pro`

The dashboard must map every store product to exactly one internal product and
entitlement. Plus and Pro products should share one store subscription group so
the stores can apply upgrade/downgrade behavior correctly.

Store products, localized descriptions, price tiers, subscription groups, and
RevenueCat offerings are deployment configuration. They are not hard-coded as
the source of truth in mobile.

## Subscription Lifecycle Rules

- Initial purchase: activate the purchased entitlement after reconciliation.
- Renewal: extend `expiresAt` and keep access.
- Cancellation: keep access through the paid period; do not downgrade immediately.
- Grace period: retain access until the verified grace end.
- Billing failure without grace: revoke when the verified entitlement expires.
- Upgrade: apply the higher tier when the store reports it effective.
- Downgrade: retain the current tier until the store-reported effective date.
- Refund/revocation: remove paid access when verified by the provider.
- Restore: reconcile store ownership to the signed-in OptiMe account, then refresh
  backend entitlements.
- Out-of-order webhook: compare provider event/effective timestamps and never
  overwrite newer state with an older event.

RevenueCat documents cancellation, grace-period, renewal, product-change, and
transfer flows; implementation tests must cover each relevant state:
[common webhook flows](https://www.revenuecat.com/docs/integrations/webhooks/event-flows).

## Backend Additions For The Implementation Batches

The existing `Subscription` model is a strong base. Before live purchases, add:

- A canonical billing product/period mapping in shared backend code.
- A replay-safe `BillingEvent`/`SubscriptionEvent` table with unique provider
  event ID, event type, received/processed timestamps, status, and safe error code.
- `willRenew`, `graceEndsAt`, and `lastVerifiedAt` where needed for support and
  lifecycle correctness.
- A billing provider adapter interface isolated from `EntitlementsService`.
- RevenueCat webhook authentication, parsing, idempotency, and reconciliation.
- A server reconciliation endpoint/use case for purchase/restore completion.
- Metrics for purchase success, restore success, webhook lag/failure, and
  entitlement mismatch without storing purchase payloads.

Do not add a separate usage ledger for billing. Existing `UsageLedger` remains
feature-allowance enforcement, not invoicing.

## Mobile Additions For The Implementation Batches

- RevenueCat SDK in a custom iOS/Android development build, never Expo Go only.
- A localized paywall using store-provided localized price strings.
- Monthly/annual choice for Plus and Pro.
- Restore purchases.
- Manage subscription deep link.
- Loading/disabled state for every purchase and restore action.
- Friendly pending, canceled, unavailable, and reconciliation states.
- Entitlement refresh from the backend before showing paid access.
- No hard-coded currency conversion or manually formatted storefront price.

## Release Gates

Billing remains disabled until all gates pass:

1. `ai-release:gate` is `PASS` for representative Free/Plus/Pro traffic.
2. Final model IDs, route prices, and monthly tier ceilings are configured.
3. Store products and RevenueCat mappings are reviewed in sandbox.
4. Purchase, renewal, cancellation, expiration, grace period, upgrade, downgrade,
   refund/revocation, restore, and account-conflict scenarios pass.
5. Webhook replay and out-of-order delivery tests pass.
6. Backend entitlement state matches RevenueCat/store state after reconciliation.
7. Legal subscription terms, privacy disclosures, pricing copy, and cancellation
   instructions are reviewed.
8. App Store and Google Play release builds pass physical-device QA.
9. Monitoring and a safe billing kill switch are available.

## Implementation Batches

### Batch 2: Shared Billing Contract (Implemented)

- Add canonical product keys, periods, lifecycle types, and provider adapter
  interfaces.
- Add provider-event persistence/migration and configuration validation.
- Keep billing disabled and make no mobile purchase calls.

Implemented foundation:

- Shared store-independent product, period, provider, store, lifecycle, and
  subscription-status types.
- Canonical App Store/Google Play/RevenueCat product mapping.
- `BillingProviderAdapter` boundary without a live provider implementation.
- `BillingEvent` replay protection using unique provider event identity.
- Safe event metadata only; no receipt, purchase token, or raw webhook payload.
- Billing configuration disabled by default and fail-fast when enabled without
  backend RevenueCat credentials.

Configuration:

```env
BILLING_ENABLED=false
BILLING_PROVIDER=revenuecat
BILLING_RECONCILIATION_TIMEOUT_MS=10000
REVENUECAT_API_BASE_URL=https://api.revenuecat.com/v1
REVENUECAT_SECRET_API_KEY=
REVENUECAT_WEBHOOK_AUTH_TOKEN=
REVENUECAT_WEBHOOK_SIGNING_SECRET=
```

`BILLING_ENABLED` must remain `false` until the later reconciliation, mobile
sandbox, store lifecycle, and release-gate batches are complete.

### Batch 3: RevenueCat Backend Reconciliation (Implemented)

- Add authenticated webhook handling and idempotent state transitions.
- Add server reconciliation after purchase/restore.
- Extend tests for lifecycle, ownership, replay, and out-of-order events.

Implemented backend behavior:

- `POST /v1/billing/webhooks/revenuecat` verifies both the configured
  `Authorization` value and RevenueCat's timestamped HMAC signature over the
  unmodified raw request body.
- `POST /v1/me/billing/reconcile` requires OptiMe JWT authentication and
  reconciles the signed-in immutable user ID against RevenueCat.
- Webhook IDs are replay-safe through `BillingEvent`; repeated delivery returns
  success without applying the lifecycle transition twice.
- `lastProviderEventAt` prevents an older event from replacing newer
  subscription state.
- Cancellation stores `CANCELED` while retaining the verified `expiresAt`, so
  existing entitlement resolution keeps access through the paid period.
- Grace, renewal, expiration, refund/revocation, and trial state normalize into
  the existing `SubscriptionStatus` contract.
- Product-change and transfer notifications are recorded but do not directly
  grant or move access. Their effective state must arrive through a subsequent
  lifecycle event or authenticated reconciliation.
- A provider subscription already linked to a different OptiMe user is rejected
  as an ownership conflict and is never silently transferred.
- Raw webhook bodies, receipts, purchase tokens, store secrets, and complete
  subscriber responses are never persisted or logged.

Billing remains disabled by default. Enabling it requires all three backend-only
RevenueCat secrets. The webhook endpoint must be configured with the same auth
header and signing secret in the RevenueCat dashboard.

References:

- [RevenueCat webhooks and authentication](https://www.revenuecat.com/docs/integrations/webhooks)
- [RevenueCat webhook event fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields)
- [RevenueCat subscriber API](https://www.revenuecat.com/docs/api-v1)

### Batch 4: Mobile Sandbox Purchase UX (Implemented, Disabled By Default)

- `react-native-purchases` is isolated behind the mobile billing adapter and is
  configured only when `EXPO_PUBLIC_BILLING_ENABLED=true`.
- RevenueCat receives the immutable OptiMe `user.id`; email and profile fields
  are not used as billing identity.
- The localized Plans screen uses RevenueCat/store-provided localized prices for
  the four launch products and supports monthly/annual selection.
- Purchase, restore, and manage actions have loading/disabled states and friendly
  canceled, pending, unavailable, network, and reconciliation states.
- Purchase and restore always call authenticated
  `POST /v1/me/billing/reconcile`, then refresh `/v1/me/entitlements`.
- RevenueCat `CustomerInfo.entitlements` never grants product access in mobile.
  Backend `EntitlementsService` remains authoritative.
- Web and builds without platform public SDK keys show a safe unavailable state.
- Mobile billing is still disabled by default and is not production-enabled by
  this batch.

Mobile public configuration:

```env
EXPO_PUBLIC_BILLING_ENABLED=false
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=
```

These are platform public SDK keys. `REVENUECAT_SECRET_API_KEY`,
`REVENUECAT_WEBHOOK_AUTH_TOKEN`, and `REVENUECAT_WEBHOOK_SIGNING_SECRET` remain
backend-only and must never use the `EXPO_PUBLIC_` prefix.

See [mobile subscription sandbox QA](./mobile-subscription-sandbox.md).

### Batch 5: Store Sandbox QA

- Configure App Store Connect, Google Play Console, and RevenueCat products.
- Verify complete iOS and Android lifecycle scenarios on physical devices.
- Validate account transfer policy and customer support procedures.

### Batch 6: Production Rollout

- Pass economics, quality, legal, privacy, and store-review gates.
- Enable purchases behind a server-controlled release flag.
- Roll out gradually and monitor entitlement mismatches, fallback rates, cost,
  refunds, and support incidents.

## Batch 1 Acceptance Criteria

- Launch-candidate prices and annual discounts are explicit.
- Benefits and existing limits are aligned with backend matrices.
- RevenueCat is selected as the first-release purchase adapter.
- Backend authorization remains authoritative.
- Product IDs, lifecycle rules, security boundaries, and release gates are defined.
- No purchase SDK, receipt validation, webhook endpoint, paywall, migration, or
  production billing behavior is implemented in this batch.
