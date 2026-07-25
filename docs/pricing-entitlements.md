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

This is the approved product direction for the production pricing/cost-control
batch. It is not yet reflected by the current entitlement and usage matrices.

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

Before these rules are enforced, add per-request token/cost telemetry and validate
Luna plan quality against the same schemas, catalog constraints, exercise
constraints, and safety suite used by paid tiers.

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

## Candidate Production Allowances

These allowances replace the current development matrix only after token/cost
telemetry and product QA are complete:

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

## Cost Telemetry Gate

The existing `AiOperationLog` records provider, model, status, latency, retries,
and fallback reason, but it does not yet record enough data to approve pricing.
Before billing implementation, add safe per-call fields or an equivalent internal
aggregate for:

- input tokens;
- cached input tokens;
- output and reasoning tokens where reported;
- request count;
- model and agent/workload;
- retry cost;
- estimated cost in USD;
- total cost for one user-visible operation.

Run at least a 30-day cost simulation using representative Free, Plus, and Pro
profiles. Approve prices only when median and p95 cost pass the guardrails above.

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

Current development limits (not approved for production):

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
- Customer-facing pricing and regional storefront products.
- Promo codes.
- Billing admin UI.
- Tier-aware OpenAI model routing.
- Per-agent token and estimated-cost telemetry.
- The approved production Free limits above.
