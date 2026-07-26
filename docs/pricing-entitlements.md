# Pricing / Entitlement Foundation

This foundation prepares OptiMe for `FREE`, `PLUS`, and `PRO` without adding real App Store, Google Play, Stripe, receipt validation, webhooks, or production purchase UI.

## Product Rules

- Safety is never paywalled.
- Nutrition-only users can still receive paid value.
- Training remains optional.
- Backend entitlement checks are the source of truth.
- Mobile upgrade/paywall UI is contextual and placeholder-only.
- Provisional launch pricing is documented for unit-economics planning, but is
  not shown in the product until billing and production cost validation are
  approved.

## Approved Free-Tier Direction

This direction is now reflected by the backend entitlement and usage matrices.

- Free uses the cost-efficient OpenAI Luna model for its main Basic Daily Plan.
- Free receives one new Basic Daily Plan per local day.
- Free does not receive manual Daily Plan refresh.
- Free receives at most two AI meal regenerations per month.
- Free does not receive full-menu regeneration.
- Deterministic safe substitutions, food tracking, workout execution/history,
  basic plan history, Apple Health/Health Connect access, and all safety behavior
  remain available.
- Free Adaptive Plan Checkpoint behavior is deterministic and safety-oriented; it
  does not provide a paid AI plan rewrite.
- Model names must be selected through backend configuration/routing rather than
  hard-coded into mobile.
- SafetyService and hard safety rules must not use a weaker policy based on tier.

Per-request token/cost telemetry and backend limits are implemented. Production
model IDs, prices, and monthly cost ceilings still require deployment-specific
values and representative cost validation before billing is enabled.

## Provisional Launch Pricing

These are pricing floors for production planning, not yet customer-facing prices:

| Tier | Monthly | Annual | Effective annual monthly |
|---|---:|---:|---:|
| `FREE` | `$0` | `$0` | `$0` |
| `PLUS` | `$19.99` | `$199.99` | about `$16.67` |
| `PRO` | `$39.99` | `$399.99` | about `$33.33` |

The annual price gives approximately two months of value rather than an aggressive
discount that would remove the AI margin. Regional storefront prices may differ,
but no region may be launched below its approved contribution-margin floor.

`PLUS` is the primary paid product. `PRO` is the premium adaptive tier and must
justify its price through deeper context, frontier-quality planning, and adaptive
behavior rather than simply exposing much larger retry limits.

## Production Model Routing

Using one expensive model for every agent would make the product unnecessarily
costly. The planned routing is:

| Workload | Model tier |
|---|---|
| Free Basic Daily Plan | OpenAI Luna |
| Plus Personalized Daily Plan | OpenAI Terra |
| Pro Adaptive Daily Plan | OpenAI Sol |
| Deterministic hard safety | Backend rules, all tiers |
| Semantic Safety Agent | Terra by default |
| Routine classification and concise helper output | Luna |
| Valid-output retry | At most one controlled retry, escalating only when justified |

Sol is reserved for user-visible planning where frontier quality creates paid
value. It is not the default for every sub-agent, safety check, or regeneration.
Model IDs remain backend configuration and must never be hard-coded in mobile.

For illustration, a single request containing 10,000 input tokens and 4,000
output tokens costs approximately `$0.034` on Luna, `$0.085` on Terra, and
`$0.17` on Sol at the documented July 2026 rates. A Daily Plan is a multi-call
pipeline, so its real cost is the sum of the planner, nutrition, training-load,
safety, and retry calls rather than this single-request example.

## Profitability Guardrails

Pricing and usage limits must be approved against net storefront receipts, not
the customer-facing price.

- Reserve at least 15% for App Store or Google Play commission where the
  applicable small-business/subscription terms allow it. Use a 20% channel
  reserve in forecasts until actual regional settlement data is available.
- Target median AI cost at or below 15% of net receipts per paid subscriber.
- Keep p95 AI cost at or below 25% of net receipts.
- Keep total variable cost, including AI, infrastructure, refunds, and payment
  overhead, at or below 35% of net receipts.
- Target at least 65% contribution margin after variable costs.
- Retries do not consume a second user-visible allowance, but their tokens and
  cost must be recorded internally.
- No tier is unlimited. Abuse protection and a monthly cost ceiling apply even
  when the UI describes normal daily use.

At a 15% storefront commission, the provisional monthly prices produce about
`$16.99` net for Plus and `$33.99` net for Pro before taxes, refunds, and other
costs. The corresponding 15% monthly AI budgets are approximately `$2.55` and
`$5.10`. If measured p95 cost exceeds the guardrail, reduce output/retries,
route more work to Luna or Terra, reduce allowances, or raise the price before
launch.

## Production Allowances

The backend enforces these allowances:

| AI-heavy action | Free | Plus | Pro |
|---|---:|---:|---:|
| New Daily Plan | 1 per local day, Luna | 1 per local day, Terra | 1 per local day, Sol |
| Manual full-plan refresh | 0 | 3 per month | 10 per month |
| Meal regeneration | 2 per month | 12 per month | 30 per month |
| Full-menu regeneration | 0 | 2 per month | 6 per month |
| AI Adaptive Plan proposals | 0 | 8 per month | 20 per month |

Free still receives deterministic safety adjustments and deterministic
substitutions. Safety behavior is not included in, or restricted by, the paid
AI allowance.

## Cost Telemetry And Ceiling Gate

`AiRequestLog` records one safe metadata row per OpenAI request or retry. It
includes route, model, agent, operation, latency, token counts, retry state, and
optional estimated micro-USD. It never stores prompts, plans, profiles, health
samples, raw responses, secrets, or private notes.

The production ceiling guard is disabled by default. When explicitly enabled in
OpenAI mode, all route prices and all tier ceilings are required at startup. The
guard sums successful priced requests for the current UTC month before starting a
new user-visible AI operation. Reaching the ceiling returns the safe
`AI_CAPACITY_LIMIT_REACHED` contract without exposing internal costs.

Run the internal median/p95 report with:

```powershell
$env:AI_COST_REPORT_DAYS='30'
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api ai-cost:report
```

The report contains aggregate distributions only; it never emits user IDs.
Billing must remain disabled until representative Free, Plus, and Pro data pass
the profitability guardrails.

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
| Daily plan refresh | No | Yes, limited | Yes, higher limit |
| AI Nutrition Agent / food plan | Yes, limited | Yes | Yes |
| Meal regeneration | Yes, limited | Yes, higher limit | Yes, higher limit |
| Menu regeneration | No | Yes, limited | Yes, higher limit |
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

Current production limits:

| Feature | Period | Free | Plus | Pro |
|---|---|---:|---:|---:|
| `DAILY_PLAN_GENERATION` | Daily | 1 | 1 | 1 |
| `DAILY_PLAN_REFRESH` | Monthly | 0 | 3 | 10 |
| `AI_DAILY_PLAN_GENERATION` | Daily | 1 | 1 | 1 |
| `AI_PLAN_CHECKPOINT_PROPOSAL` | Monthly | 0 | 8 | 20 |
| `MENU_REGENERATION` | Monthly | 0 | 2 | 6 |
| `MEAL_REGENERATION` | Monthly | 2 | 12 | 30 |
| `AI_TRAINING_LOAD_AGENT` | Daily | 0 | 5 | 20 |

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
- Customer-facing pricing and regional storefront products.
- Promo codes.
- Billing admin UI.
- Production model IDs, route prices, and tier cost-ceiling values.
- Representative 30-day median/p95 unit-economics approval.
