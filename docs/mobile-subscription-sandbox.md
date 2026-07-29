# Mobile Subscription Sandbox QA

## Scope

This guide covers the implemented RevenueCat mobile purchase foundation. It does
not enable production billing. Backend entitlements remain authoritative after
every purchase and restore.

## Required Dashboard Setup

Create the launch products in App Store Connect and Google Play using the
identifiers in
[pricing-subscriptions-release-plan.md](./pricing-subscriptions-release-plan.md).
Then attach them to a RevenueCat current Offering with these custom package
identifiers:

- `plus_monthly`
- `plus_annual`
- `pro_monthly`
- `pro_annual`

RevenueCat may also return the canonical Apple product IDs or Google
product/base-plan IDs; the mobile adapter recognizes both.

## Local Configuration

Keep backend and mobile configuration separate:

```env
# Backend only
BILLING_ENABLED=true
REVENUECAT_SECRET_API_KEY=...
REVENUECAT_WEBHOOK_AUTH_TOKEN=...
REVENUECAT_WEBHOOK_SIGNING_SECRET=...

# Mobile public SDK keys
EXPO_PUBLIC_BILLING_ENABLED=true
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...
```

Never place a RevenueCat secret key in an `EXPO_PUBLIC_` variable.

## Build Requirements

Use a custom iOS or Android development build for store sandbox validation.
Expo Go can preview some RevenueCat SDK UI behavior, but it cannot validate real
App Store or Google Play purchases. Web purchases are intentionally unavailable
in the native mobile flow.

After adding the SDK, regenerate/rebuild the native app so the native RevenueCat
module is included.

## Manual QA

1. Sign in to OptiMe and open Profile, then open Plans.
2. Confirm `/v1/me/entitlements` supplies the current plan.
3. Confirm monthly and annual store-localized prices load for Plus and Pro.
4. Start a sandbox purchase and confirm the button cannot be pressed repeatedly.
5. Cancel a purchase and confirm no error panel or access change appears.
6. Complete a purchase and confirm the app calls
   `POST /v1/me/billing/reconcile`.
7. Confirm paid UI appears only after refreshed backend entitlements report it.
8. Restore purchases and confirm the same backend reconciliation path runs.
9. Open Manage subscription and confirm the store management page opens.
10. Sign out, sign in as another OptiMe user, and confirm RevenueCat identity
    follows the immutable OptiMe user ID.
11. Disable `EXPO_PUBLIC_BILLING_ENABLED` and confirm Plans remains readable but
    purchase actions are safely unavailable.

## Still Required Before Production

- Complete iOS and Android lifecycle QA for renewal, cancellation, expiration,
  grace period, upgrade, downgrade, refund/revocation, restore, and ownership
  conflicts.
- Review store copy, subscription terms, privacy disclosures, and cancellation
  instructions.
- Pass AI quality/economics release gates.
- Enable both backend and mobile billing flags only through a controlled release.
