# AI model routing and request telemetry

OptiMe uses backend-owned model routes so product tiers can change model quality
without exposing provider model IDs to mobile or scattering model selection across
agents.

## Routes

| PlanQualityMode | Internal route | Product tier |
| --- | --- | --- |
| `BASIC` | `LUNA` | Free |
| `PERSONALIZED` | `TERRA` | Plus |
| `ADAPTIVE` | `SOL` | Pro |

`LUNA`, `TERRA`, and `SOL` are OptiMe route names. They are not assumed OpenAI
model IDs. The actual model for each route is configured at deployment:

```env
OPENAI_DEFAULT_MODEL=
OPENAI_MODEL_LUNA=
OPENAI_MODEL_TERRA=
OPENAI_MODEL_SOL=
```

Each route-specific value falls back to `OPENAI_DEFAULT_MODEL`. This preserves
existing local environments while allowing production to assign different models.
Mock mode does not call OpenAI and does not require these route values.

The router is used by Daily Plan, Plan Checkpoint, Nutrition, Safety, and Training
Load OpenAI requests. Deterministic nutrition targets, exercise boundaries,
entitlements, safety, and fallback behavior remain backend-owned and unchanged.

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
operation. `AiRequestLog` is the request-level source for model, token, retry, and
estimated-cost analysis. Neither table is billing enforcement or a UsageLedger.

## Optional cost configuration

Cost estimates use deployment-owned USD-per-one-million-token values:

```env
OPENAI_LUNA_INPUT_COST_PER_1M_USD=
OPENAI_LUNA_OUTPUT_COST_PER_1M_USD=
OPENAI_TERRA_INPUT_COST_PER_1M_USD=
OPENAI_TERRA_OUTPUT_COST_PER_1M_USD=
OPENAI_SOL_INPUT_COST_PER_1M_USD=
OPENAI_SOL_OUTPUT_COST_PER_1M_USD=
```

If either route price is configured, the available input/output components are
estimated and stored as `estimatedCostMicrousd`. If neither is configured, the
field remains `null`; token counts are still recorded. These estimates support
unit-economics analysis only. They do not enforce limits or charge users.

## Next operational gate

Before changing production limits or enabling billing:

1. Populate current deployment model IDs and prices.
2. Run a representative 30-day simulation.
3. Review median and p95 request cost by route, agent, and operation.
4. Set monthly cost ceilings and approved production limits separately.
