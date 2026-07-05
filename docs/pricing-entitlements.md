# Pricing / Entitlement Foundation

This foundation prepares OptiMe for `FREE`, `PLUS`, and `PRO` without adding real App Store, Google Play, Stripe, receipt validation, webhooks, or production purchase UI.

## Product Rules

- Safety is never paywalled.
- Nutrition-only users can still receive paid value.
- Training remains optional.
- Backend entitlement checks are the source of truth.
- Mobile upgrade/paywall UI is contextual and placeholder-only.
- No final pricing amounts are shown in this sprint.

## Tier Contract

| Tier | PlanQualityMode | Product Role |
|---|---|---|
| `FREE` | `BASIC` | Useful safe plan with limited premium actions. |
| `PLUS` | `PERSONALIZED` | More regeneration, AI nutrition quality, training-load guidance, and preference use. |
| `PRO` | `ADAPTIVE` | Deeper adaptive context and future advanced wearable/WHOOP/AI Coach features. |

## Entitlement Matrix

The central backend matrix lives at:

```txt
apps/api/src/modules/entitlements/entitlement-matrix.ts
```

Current feature gates:

| Feature | Free | Plus | Pro |
|---|---:|---:|---:|
| Daily plan generation | Yes, limited | Yes, higher limit | Yes, higher limit |
| Daily plan refresh | Yes, limited | Yes, higher limit | Yes, higher limit |
| AI Nutrition Agent / food plan | Yes, limited | Yes | Yes |
| Meal regeneration | Yes, limited | Yes, higher limit | Yes, higher limit |
| Menu regeneration | Yes, limited | Yes, higher limit | Yes, higher limit |
| AI Training Load Agent | Deterministic fallback | Yes, limited | Yes, higher limit |
| Pain-aware replacements | Yes | Yes | Yes |
| Workout execution/history | Yes | Yes | Yes |
| Food tracking | Yes | Yes | Yes |
| Apple Health basic sync/context | Yes | Yes | Yes |
| Advanced wearable insights | No | No | Future Pro |
| WHOOP | No | No | Future Pro |
| AI Coach | No | No | Future Pro |
| Health Connect | Future | Future | Future |

## Usage Limits

Limited AI-heavy actions use `UsageLedger` with a unique period key:

```txt
userId + feature + periodType + periodStart
```

Current daily limits:

| Feature | Free | Plus | Pro |
|---|---:|---:|---:|
| `DAILY_PLAN_GENERATION` | 1 | 5 | 20 |
| `DAILY_PLAN_REFRESH` | 1 | 5 | 20 |
| `AI_DAILY_PLAN_GENERATION` | 1 | 5 | 20 |
| `MENU_REGENERATION` | 1 | 5 | 20 |
| `MEAL_REGENERATION` | 1 | 5 | 20 |
| `AI_TRAINING_LOAD_AGENT` | 0 | 5 | 20 |

Daily plan usage is reserved before expensive generation and refunded if the operation throws before returning a plan. Fallback plans still count when generation work completed.

Food regeneration usage is reserved before the Nutrition Agent runs and refunded if safe regeneration fails. Over-limit requests do not call the agent and do not mutate `DailyPlan`.

## Mobile UX

Mobile can fetch:

```http
GET /v1/me/entitlements
GET /v1/me/usage
```

Profile shows the current plan and “upgrade coming soon” placeholder copy. Today does not show permanent usage clutter. When an action reaches a limit, mobile displays contextual copy and keeps the existing plan visible.

## Deferred

- Real purchases.
- Receipt validation.
- Provider webhooks.
- Production purchase/paywall flow.
- Pricing amounts.
- Promo codes.
- Billing admin UI.
