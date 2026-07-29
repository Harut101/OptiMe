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
- Adaptive `SOL` planning.
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

### Batch 2: Shared Billing Contract

- Add canonical product keys, periods, lifecycle types, and provider adapter
  interfaces.
- Add provider-event persistence/migration and configuration validation.
- Keep billing disabled and make no mobile purchase calls.

### Batch 3: RevenueCat Backend Reconciliation

- Add authenticated webhook handling and idempotent state transitions.
- Add server reconciliation after purchase/restore.
- Extend tests for lifecycle, ownership, replay, and out-of-order events.

### Batch 4: Mobile Sandbox Purchase UX

- Add the SDK in development builds.
- Replace the placeholder with localized paywall, purchase, restore, and manage
  subscription actions.
- Keep backend entitlements authoritative.

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
