# AI Unit Economics Gate

OptiMe validates AI cost before implementing real billing. This gate is internal
release tooling, not a payment system, customer paywall, or usage charge.

## Source Data

The benchmark reads successful `AiRequestLog` rows and aggregate OpenAI
`AiOperationLog` rows for a rolling period, 30 days by default. It uses:

- internal route: `LUNA`, `TERRA`, or `SOL`;
- agent and operation;
- retry-aware request rows;
- input/output token counts;
- estimated integer micro-USD.
- final persisted Daily Plan status;
- operation-level retry count and safe fallback/error outcome.

It does not read or print prompts, plan JSON, profiles, health samples, user
notes, API keys, raw provider responses, or user IDs.

The tier mapping is:

| Tier | Route |
|---|---|
| `FREE` | `LUNA` |
| `PLUS` | `TERRA` |
| `PRO` | `SOL` |

## Configuration

Model IDs and provider prices remain deployment-owned:

```env
OPENAI_MODEL_LUNA=
OPENAI_MODEL_TERRA=
OPENAI_MODEL_SOL=
OPENAI_LUNA_INPUT_COST_PER_1M_USD=
OPENAI_LUNA_OUTPUT_COST_PER_1M_USD=
OPENAI_TERRA_INPUT_COST_PER_1M_USD=
OPENAI_TERRA_OUTPUT_COST_PER_1M_USD=
OPENAI_SOL_INPUT_COST_PER_1M_USD=
OPENAI_SOL_OUTPUT_COST_PER_1M_USD=
```

Benchmark assumptions:

```env
AI_COST_REPORT_DAYS=30
AI_COST_MIN_TIER_SAMPLES=30
AI_COST_MIN_PRICED_COVERAGE_PERCENT=95
AI_STOREFRONT_COMMISSION_PERCENT=20
AI_MEDIAN_COST_MAX_PERCENT_NET=15
AI_P95_COST_MAX_PERCENT_NET=25
AI_PRICE_PLUS_MONTHLY_USD=19.99
AI_PRICE_PRO_MONTHLY_USD=39.99
AI_MONTHLY_COST_CEILING_FREE_USD=
AI_MONTHLY_COST_CEILING_PLUS_USD=
AI_MONTHLY_COST_CEILING_PRO_USD=
AI_QUALITY_MIN_TIER_SAMPLES=30
AI_QUALITY_MIN_TELEMETRY_COVERAGE_PERCENT=95
AI_QUALITY_MIN_READY_RATE_PERCENT=98
AI_QUALITY_MAX_FALLBACK_RATE_PERCENT=2
AI_QUALITY_MAX_RETRY_RATE_PERCENT=25
```

The documented prices are launch candidates, not live customer-facing storefront
products. Route prices must be copied from the current provider pricing for the
exact deployment model IDs before collecting benchmark data. See
[pricing-subscriptions-release-plan.md](./pricing-subscriptions-release-plan.md)
for the release gates and complete monthly/annual financial model.

## Commands

Inspect the report without failing the shell:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api ai-cost:benchmark
```

Use the strict release gate:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api ai-release:gate
```

`ai-cost:gate` remains a backward-compatible alias. The strict command exits
non-zero unless both unit economics and final plan quality are `PASS`.

## Verdicts

- `PASS`: each tier has enough priced and quality samples and stays inside all
  configured cost, READY, fallback, and retry guardrails.
- `FAIL`: data is sufficient, but a p95 ceiling or paid-tier median/p95
  net-receipt guardrail is exceeded.
- `INSUFFICIENT_DATA`: the gate is missing tier samples, priced coverage,
  operation-quality coverage, or a monthly ceiling. It never converts missing
  data into a green result.

For `PLUS` and `PRO`, median AI cost must be at most 15% of estimated net receipt
and p95 must be at most 25%. The net receipt applies the configured conservative
storefront commission.

`FREE` has no subscription receipt, so it is evaluated against its configured
monthly cost ceiling instead of a revenue percentage.

## Representative Run

A valid pricing decision needs representative full user-visible operations, not
isolated single prompts. The staging sample should include:

- nutrition-only and nutrition-plus-training users;
- training and rest days;
- all supported locales;
- plans with and without wearable context;
- safety review and bounded retry paths;
- meal and menu regeneration within each tier allowance;
- Adaptive Plan Checkpoint proposals for paid tiers.

Each route needs at least the configured number of distinct monthly user samples.
Partial or artificial data may test the command, but it must not approve launch
pricing.

The quality gate uses final persisted plan outcomes rather than treating every
provider response as successful. A complete backend-owned deterministic
replacement may remain user-visible as `READY`, while its aggregate operation
still records fallback provenance. Provider errors and true final `FALLBACK`
plans lower the READY rate. Historical operation rows without route or final
status lower telemetry coverage and cannot silently pass the gate.

## Model Recalibration Gate

`LUNA`, `TERRA`, and `SOL` remain internal routes, not fixed provider model
names. A cheaper Free model is desirable, but it must not be deployed based on
list price alone.

For each candidate model, replay the same anonymized structured fixtures and
compare:

- valid structured output on the first request;
- final READY rate and fallback rate;
- deterministic and semantic safety outcomes;
- mean and p95 request count per complete operation;
- input/output tokens and estimated cost;
- p50/p95 latency;
- supported locale quality;
- catalog-food and trusted-exercise compliance.

A candidate is accepted only if its lower token price is not offset by more
retries, fallbacks, or incomplete plans. Current examples worth benchmarking
from the provider's model catalog are:

| Internal route | Candidate role |
|---|---|
| `LUNA` / Free | low-cost structured-output model |
| `TERRA` / Plus | balanced planning model |
| `SOL` / Pro | highest-quality adaptive planning model |

Exact provider model IDs and current prices must be verified immediately before
the benchmark and set through environment configuration. Documentation must not
silently pin a model that has not passed OptiMe's plan-quality fixtures.

Daily Plan request counts should also be evaluated after section-scoped safety
repair: nutrition-only feedback must not repeat the general/training generation,
and training-only feedback must not repeat nutrition generation. Unclassified
high-risk feedback intentionally retains one conservative full retry.

## Current Limitation

The pre-request operational ceiling and this reporting gate use priced telemetry.
Historical unpriced rows are excluded from cost distributions and reduce priced
coverage. Historical operation rows without quality fields reduce quality
coverage. A provider request may cross the ceiling because its exact cost is only
known after completion; later requests are then blocked.
