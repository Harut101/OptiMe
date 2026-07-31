# AI model routing and request telemetry

OptiMe uses backend-owned model routes so product tiers can change model quality
without exposing provider model IDs to mobile or scattering model selection across
agents.

## Routes

| PlanQualityMode | Internal route | Product tier |
| --------------- | -------------- | ------------ |
| `BASIC`         | `LUNA`         | Free         |
| `PERSONALIZED`  | `TERRA`        | Plus         |
| `ADAPTIVE`      | `SOL`          | Pro          |

`LUNA`, `TERRA`, and `SOL` remain historical internal telemetry route names.
They are not assumed OpenAI model IDs. Deployment config is named by product
tier so a Pro route can safely use the same provider model as Plus:

```env
OPENAI_DEFAULT_MODEL=
OPENAI_DAILY_PLAN_MODEL_FREE=gpt-5.6-luna
OPENAI_DAILY_PLAN_MODEL_PLUS=gpt-5.6-terra
OPENAI_DAILY_PLAN_MODEL_PRO=gpt-5.6-terra
```

Each tier-specific value falls back to `OPENAI_DEFAULT_MODEL`. Existing
`OPENAI_MODEL_LUNA/TERRA/SOL` values are accepted temporarily as migration
fallbacks, but new deployments must use the tier names. Mock mode does not call
OpenAI and does not require these values.

Legacy route prices are used only while the matching legacy model key is active.
Once a tier model key is configured, configure its new tier input/output prices
as well so telemetry and cost ceilings cannot price one model as another.

The router is used by Daily Plan, Plan Checkpoint, Nutrition, Safety, and Training
Load OpenAI requests. Deterministic nutrition targets, exercise boundaries,
entitlements, safety, and fallback behavior remain backend-owned and unchanged.

## Daily Plan request budget

Daily Plan generation minimizes provider calls without weakening validation:

- the general Daily Plan request and specialized Nutrition Agent request start
  in parallel because they use the same immutable planning context;
- schema validation, deterministic safety, and semantic safety still review the
  fully assembled result;
- a Safety Agent rejection is classified into affected sections:
  `nutrition`, `training`, `recovery`, or `summary`;
- a nutrition-only repair reruns only the Nutrition Agent and reuses the
  accepted general/training output;
- a training, recovery, or summary repair reruns the general provider and reuses
  the accepted catalog-backed food plan;
- mixed or unclassified high-risk feedback uses one conservative full retry;
- no retry bypasses schema validation, deterministic safety, or the Safety
  Agent.

This is bounded repair, not an autonomous retry loop. The orchestrator logs which
sections were affected and which provider calls were repeated, without logging
the plan, prompt, profile, or safety text.

The next efficiency gate is a staging benchmark of complete user-visible
operations. Model changes must be approved from measured READY rate, fallback
rate, request count, token cost, and latency rather than provider price alone.

## Request telemetry

`AiRequestLog` records one metadata-only row for each OpenAI Responses API request,
including bounded retries:

- user ID;
- agent and operation;
- internal model route and resolved model ID;
- success/error status and latency;
- whether the request was a retry;
- input, output, and total token counts;
- optional estimated cost in integer micro-USD;
- a safe provider error reason.

It never stores prompts, plan JSON, profiles, health samples, raw provider
responses, API keys, auth tokens, or user notes. Writes are best-effort and cannot
turn a successful provider response into a failed plan generation.

`AiOperationLog` remains the aggregate record for the complete daily-plan
operation. New operations also record the internal route, `PlanQualityMode`,
resolved model ID, final persisted `READY`/`FALLBACK` status, retry count, and
safe fallback/error reason. This lets release QA compare a cheaper route against
the same user-visible quality outcomes. Historical rows keep these new fields
null and reduce telemetry coverage rather than being assumed successful.

`AiRequestLog` is the request-level source for model, token, retry, and
estimated-cost analysis. Neither table stores plan content, prompts, profiles,
health samples, or user notes. Neither table is billing enforcement or a
UsageLedger.

## Optional cost configuration

Cost estimates use deployment-owned USD-per-one-million-token values:

```env
OPENAI_DAILY_PLAN_FREE_INPUT_COST_PER_1M_USD=
OPENAI_DAILY_PLAN_FREE_OUTPUT_COST_PER_1M_USD=
OPENAI_DAILY_PLAN_PLUS_INPUT_COST_PER_1M_USD=
OPENAI_DAILY_PLAN_PLUS_OUTPUT_COST_PER_1M_USD=
OPENAI_DAILY_PLAN_PRO_INPUT_COST_PER_1M_USD=
OPENAI_DAILY_PLAN_PRO_OUTPUT_COST_PER_1M_USD=
```

If either route price is configured, the available input/output components are
estimated and stored as `estimatedCostMicrousd`. If neither is configured, the
field remains `null`; token counts are still recorded. These estimates support
unit-economics analysis and the optional operational cost ceiling. They never
charge users.

## Operational cost ceiling

The guard is disabled by default and only becomes active in OpenAI mode:

```env
AI_COST_CEILING_ENFORCEMENT_ENABLED=false
AI_MONTHLY_COST_CEILING_FREE_USD=
AI_MONTHLY_COST_CEILING_PLUS_USD=
AI_MONTHLY_COST_CEILING_PRO_USD=
```

When enabled, all route prices and all three positive ceiling values are required.
The guard checks successful priced requests in the current UTC month before a new
Daily Plan, food regeneration, or AI Plan Checkpoint operation. It fails closed
with `AI_CAPACITY_LIMIT_REACHED` when the tier ceiling has already been reached.
The response contains no internal cost amount.

The check is deliberately separate from `UsageLedger`: usage limits describe
product allowances, while the ceiling is a deployment safety valve. Because the
provider cost is known only after a request completes, one final operation may
cross the configured ceiling before later requests are blocked.

## Unit-economics report

Inspect raw aggregate cost:

```powershell
$env:AI_COST_REPORT_DAYS='30'
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api ai-cost:report
```

The JSON report shows request counts and median/p95/total micro-USD by route,
agent, and operation, plus per-user total distributions without emitting user
identifiers. Existing unpriced historical rows are reported as unpriced and are
not included in cost distributions.

Evaluate launch-candidate pricing:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api ai-cost:benchmark
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api ai-cost:gate
```

The benchmark now combines unit economics with final plan quality. The clearer
release aliases are:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api ai-release:benchmark
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api ai-release:gate
```

The benchmark reports `PASS`, `FAIL`, or `INSUFFICIENT_DATA`. The strict release
gate returns non-zero unless cost and quality pass for all tiers. See
[ai-unit-economics.md](./ai-unit-economics.md) for the data-quality requirements
and representative profile matrix.

Before billing:

1. Populate current deployment model IDs, prices, and tier ceilings.
2. Benchmark candidate models against the same representative plan fixtures.
3. Run representative Free, Plus, and Pro traffic for at least 30 days.
4. Require the strict combined quality and unit-economics gate to pass.
5. Approve or revise the launch-candidate paid prices before storefront work.
