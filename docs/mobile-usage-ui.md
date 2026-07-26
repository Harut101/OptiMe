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
- Monthly refresh limit.
- `Upgrade options coming soon.`

If entitlement or usage fetch fails, the app shows `Plan details unavailable` and keeps the rest of the app usable.

## Today

The Today screen fetches `GET /v1/me/usage` and shows a subtle usage card when available:

- Generations left today.
- Refreshes left in the configured period.

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

Mobile shows period-aware friendly copy instead of raw JSON:

- `You've reached today's limit for this plan.` for daily limits.
- `You've reached this month's limit for this plan.` for monthly limits.
- `Try again after ...`
- `Upgrade options coming soon.`

If a plan is already visible, the existing plan stays visible after a refresh limit error.

`AI_CAPACITY_LIMIT_REACHED` uses a generic temporary-capacity message and reset
date. It never exposes the deployment's internal cost or ceiling values.

## Future Payment Integration

A future batch can replace the placeholder with:

- Paywall screen.
- App Store / Google Play subscriptions.
- Restore purchases.
- Receipt validation through the backend.
- Tier comparison UI.

Safety behavior remains separate from payment and usage limits.
