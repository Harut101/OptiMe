# Mobile Usage UI Placeholder

Sprint 4 Batch 5 adds lightweight mobile visibility for plan tier and usage limits.

This is a placeholder UX only:

- No real payments.
- No App Store or Google Play purchase flow.
- No receipt validation.
- No paywall screen.

## Settings/Profile

The Profile tab shows backend-resolved entitlement information:

- Current plan.
- Plan quality mode.
- Daily plan generation limit.
- Daily refresh limit.
- `Upgrade options coming soon.`

If entitlement or usage fetch fails, the app shows `Plan details unavailable` and keeps the rest of the app usable.

## Today

The Today screen fetches `GET /v1/me/usage` and shows a subtle usage card when available:

- Generations left today.
- Refreshes left today.

The Today screen still works if usage fetch fails.

## Limit Reached UX

When the backend returns:

```ts
{
  code: "USAGE_LIMIT_REACHED",
  feature: string,
  currentPlan: string,
  limit: number,
  periodType: "DAILY" | "MONTHLY",
  resetAt: string,
  upgradeSuggestion: "PLUS" | "PRO" | null
}
```

Mobile shows friendly copy instead of raw JSON:

- `You've reached today's limit for this plan.`
- `Your Free plan includes 1 refresh per day.`
- `Try again after ...`
- `Upgrade options coming soon.`

If a plan is already visible, the existing plan stays visible after a refresh limit error.

## Future Payment Integration

A future batch can replace the placeholder with:

- Paywall screen.
- App Store / Google Play subscriptions.
- Restore purchases.
- Receipt validation through the backend.
- Tier comparison UI.

Safety behavior remains separate from payment and usage limits.
