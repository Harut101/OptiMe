# Controlled Live AI Benchmark

The live benchmark exercises the complete backend daily-plan pipeline with
synthetic Free, Plus, and Pro users. It covers routed OpenAI generation,
nutrition, training, Safety Agent review, retries, fallback status, token
telemetry, and estimated cost.

## Cost Safety

The command is a dry run by default and makes no OpenAI calls. Real calls need
the explicit `AI_BENCHMARK_REAL_CALLS_ENABLED=true` opt-in.

`AI_BENCHMARK_MAX_COST_USD` has a hard application maximum of `$10`. A higher
value fails at startup. Before every OpenAI request, including retries and
Safety Agent calls, the shared telemetry boundary reserves a conservative
maximum cost. The request is rejected before it starts when that reservation
could cross the budget or request-count limit.

The reservation uses configured model prices, output-token limit, benchmark
input-token assumption, and a safety multiplier. Failed requests consume their
full reservation because provider usage can be absent. This is deliberately
conservative and may stop the run below `$10`.

An application guard cannot replace an OpenAI project budget: a provider-side
pricing change or incorrect configured price can make an estimate inaccurate.
Keep the OpenAI project spend limit at or below `$10` for the isolated benchmark
project as a second boundary.

## Database Isolation

Real mode requires `AI_BENCHMARK_DATABASE_URL`. Its database name must contain
`benchmark` or `test`, and it must not equal `DATABASE_URL`. The runner deletes
only synthetic users created by its own run; it never cleans the development
database. Apply current Prisma migrations to this isolated database first.

```powershell
$env:DATABASE_URL=$env:AI_BENCHMARK_DATABASE_URL
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api exec prisma migrate deploy
```

Run this only when `AI_BENCHMARK_DATABASE_URL` points to the isolated benchmark
database. Do not use `prisma migrate reset`.

## Commands

Safe dry run, with zero external AI cost:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api ai-release:live
```

Controlled real run:

```powershell
$env:AI_BENCHMARK_REAL_CALLS_ENABLED='true'
$env:AI_BENCHMARK_DATABASE_URL='postgresql://optime:optime@localhost:5432/optime_ai_benchmark?schema=public'
$env:AI_BENCHMARK_MAX_COST_USD='10'
$env:AI_BENCHMARK_PROFILES_PER_TIER='2'
$env:AI_BENCHMARK_FLOW_LABEL='nutrition-agent-authoritative-v3'
$env:AI_BENCHMARK_REPORT_PATH='artifacts/ai-benchmark-current.json'
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api ai-release:live
```

`AI_BENCHMARK_REPORT_PATH` is optional. When set, its parent directory must
already exist and the filename must end in `.json`. The saved report contains
only the same safe aggregate metadata printed by the runner. Do not place
reports in a committed directory unless they were reviewed for release notes.

To compare a candidate model for the Free route without spending on Plus or Pro,
set `AI_BENCHMARK_TIERS=FREE`, give the run a safe label, and override only the
Luna route model and prices:

```powershell
$env:AI_BENCHMARK_TIERS='FREE'
$env:AI_BENCHMARK_LABEL='gpt-5.4-mini'
$env:OPENAI_DAILY_PLAN_MODEL_FREE='gpt-5.4-mini'
$env:OPENAI_DAILY_PLAN_FREE_INPUT_COST_PER_1M_USD='0.75'
$env:OPENAI_DAILY_PLAN_FREE_OUTPUT_COST_PER_1M_USD='4.50'
$env:AI_BENCHMARK_MAX_COST_USD='1'
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api ai-release:live
```

Run the same scenarios and profile count for every candidate. A lower price is
not sufficient: compare final READY/degraded/FALLBACK outcomes, retries, request
count, average and p95 latency, deterministic food/training quality, and total
token cost before changing production routing.

The OpenAI API key, either `OPENAI_DEFAULT_MODEL` or all three tier model IDs
(`OPENAI_DAILY_PLAN_MODEL_FREE/PLUS/PRO`), and their tier-specific
per-million-token prices must already be configured. Never commit the API key.
Start with two profiles per tier; increase the sample only after reviewing
READY/FALLBACK outcomes and telemetry.

`AI_BENCHMARK_LABEL` identifies the provider model or experiment. Keep
`AI_BENCHMARK_FLOW_LABEL` stable while comparing models. Change the flow label
when planner ownership or orchestration changes, for example from a legacy
combined planner to `nutrition-agent-authoritative-v1`.

## Output

The JSON report includes completed plan generations, READY/FALLBACK counts,
fallback reasons, request/retry counts, input/output tokens, model routes,
average/p95 request latency, estimated provider cost, and the conservative
budget snapshot. It never emits prompts, plans, profiles, API keys, or raw model
responses.

The quality section evaluates the final structured result without storing full
plan content. Food metrics cover target deviation, catalog coverage, ingredient
clarity, preparation completeness, preferred-food usage, and deterministic
fallbacks. Training metrics cover requested exercise count, ExerciseLibrary
coverage, prescription completeness, muscle coverage, AI retries, and
deterministic fallbacks. Scores are release-comparison signals, not medical or
clinical quality claims.

Report schema `ai-live-benchmark.v2` also includes:

- cost and token totals by subscription tier;
- request, retry, latency, token, and cost totals by AI agent and operation;
- cost per completed daily plan;
- tier-specific menu option contract checks (`1/2/3` for Free/Plus/Pro);
- catalog, ingredient clarity, preparation, exercise prescription, and rest-day
  contract failures;
- a planning-flow label so architecture results are not mixed accidentally.

## Baseline Comparison

Generate baseline and candidate reports with the same tiers, scenarios, profile
count, locale, model configuration, and benchmark budget. Then compare them:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api ai-release:compare -- `
  artifacts/ai-benchmark-baseline.json `
  artifacts/ai-benchmark-current.json
```

The comparison reports deltas for quality, contract pass rate, fallbacks,
retries, tokens, cost per plan, and latency. Its conservative gates reject an
unequal sample size, a missing quality score, an overall quality drop greater
than two points, a lower contract pass rate, or more fallback/degraded READY
plans. Passing this comparison is an engineering
release signal, not a medical-quality claim. Keep both raw versioned reports for
manual review; do not approve a model or workflow from the boolean gates alone.

The old architecture does not need to remain executable in production merely
for A/B testing. Save its benchmark report as the baseline, then compare the new
workflow report against that immutable artifact.

## Initial Free-route comparison

On July 31, 2026, the same six synthetic Free-plan generations were run against
the current Luna baseline and two lower-cost candidates. All three models
produced 6/6 READY plans without a final fallback or degraded result.

| Model          | Requests | Estimated cost | Average latency | p95 latency |
| -------------- | -------: | -------------: | --------------: | ----------: |
| `gpt-5.6-luna` |       22 |      $0.297225 |          13.9 s |      29.8 s |
| `gpt-5.4-mini` |       26 |      $0.187765 |           7.0 s |      16.6 s |
| `gpt-5.4-nano` |       27 |      $0.058222 |          17.3 s |      50.4 s |

This first status-only sample made `gpt-5.4-mini` look like the preferred staged
Free-route candidate. The structured quality run below showed why READY rate
alone is insufficient and supersedes that initial recommendation.

### Structured food and training quality run

The same six-plan sample was repeated with deterministic quality metrics. Three
plans included a 45-minute training day and three were nutrition-only rest days.

| Model          | Overall | Food | Food fallback | Training | Training retry | Training fallback |      Cost | Average latency |
| -------------- | ------: | ---: | ------------: | -------: | -------------: | ----------------: | --------: | --------------: |
| `gpt-5.6-luna` |    95.0 | 96.7 |           2/6 |     93.3 |            2/3 |               0/3 | $0.311141 |          15.7 s |
| `gpt-5.4-mini` |    92.5 | 90.0 |           6/6 |    100.0 |            0/3 |               0/3 | $0.167320 |           5.8 s |
| `gpt-5.4-nano` |    87.5 | 90.0 |           6/6 |     80.0 |            2/3 |               2/3 | $0.056537 |           8.4 s |

Every final plan remained READY, catalog-backed, target-aligned, and structurally
complete because backend validation and deterministic fallbacks worked. However,
`gpt-5.4-mini` and `gpt-5.4-nano` both required deterministic nutrition fallback
for every plan. Nano also required deterministic training fallback for two of
three training plans.

Keep `gpt-5.6-luna` for the combined Free daily-plan route for now. Mini is a
promising lower-cost candidate for training-specific work, but it must not
replace Luna for food generation until the Nutrition Agent contract is improved
and a larger multilingual/safety benchmark passes. Nano is not recommended for
daily planning. Production routing was not changed by this benchmark.

### Authoritative Nutrition Agent A/B rerun

On August 1, 2026, the Free comparison was repeated after meal ownership moved
fully to `NutritionAgentService`. Both candidates used flow label
`nutrition-agent-authoritative-v1`, the same six synthetic profiles, three
training days, three nutrition-only rest days, and report schema
`ai-live-benchmark.v2`.

| Model          | Clean contract | Overall | Food fallback | Training retry | Training fallback | Cost per plan | Average latency | p95 latency |
| -------------- | -------------: | ------: | ------------: | -------------: | ----------------: | ------------: | --------------: | ----------: |
| `gpt-5.6-luna` |            6/6 |   100.0 |           0/6 |            0/3 |               0/3 |     $0.047462 |          12.8 s |      26.8 s |
| `gpt-5.4-mini` |            2/6 |    92.5 |           4/6 |            2/3 |               1/3 |     $0.026582 |           4.5 s |       8.4 s |

Both models returned 6/6 user-visible READY plans because deterministic safety
and catalog fallbacks protected the result. That does not make the candidates
equivalent. Mini reduced estimated cost per plan by about 44%, but its overall
quality fell by 7.5 points and its contract pass rate fell by 66.7 percentage
points. Four plans lost authoritative Nutrition Agent output and one training
plan required deterministic exercise fallback.

The automated comparison therefore passed sample-size and final-status gates
but failed both `noQualityRegression` and `noContractRegression`. Keep Luna on
the Free daily-plan route. Do not trade clean plan quality for Mini's lower cost
until prompt/contract improvements achieve the same contract pass rate in a new
controlled benchmark.

The two runs consumed an estimated `$0.444263` in provider usage telemetry;
their conservative budget accounting remained below `$0.67`, safely under the
combined `$10` test ceiling. Temporary full JSON reports were kept outside the
repository and contain no prompts, profiles, API keys, or raw model responses.

### Nutrition contract optimization

On August 1, 2026, Luna was rerun on the same six Free profiles after the
Nutrition Agent prompt began enforcing exact recipe-template ingredient counts,
role order, and catalog-role compatibility. The retry path now also receives
safe validation reason codes and records correction calls as retries. This flow
is labeled `nutrition-agent-authoritative-v2`.

The optimized flow kept 6/6 READY plans, a 6/6 clean contract rate, and a
100/100 overall quality score. Nutrition generation completed in exactly six
requests with zero retries and zero deterministic fallbacks. Across the complete
pipeline, request count fell from 22 to 18 and estimated cost per completed plan
fell from `$0.047462` to `$0.032911`, a reduction of about 31%. Nutrition Agent
cost fell from `$0.185986` to `$0.099984` for the six-plan run, a reduction of
about 46%.

This result keeps `gpt-5.6-luna` on the Free route. It improves first-pass
contract precision rather than weakening validation or changing the model.
The report remains outside the repository and the sample should be repeated
periodically before changing production pricing assumptions.

### Compact Safety Agent context

The next controlled Luna run kept the Safety Agent enabled for every plan but
sent only user-facing semantic content. Debug metadata, timestamps, checkpoint
facts, catalog IDs, protocol internals, and per-item calculated nutrition values
are no longer duplicated into semantic review. Meal and ingredient wording,
preparation, substitutions, nutrition guidance, exercise cues and safety notes,
training-load messages, recovery guidance, and reminders remain included.

The six-profile run again produced 6/6 READY plans, a 6/6 clean contract rate,
and a 100/100 overall quality score. Safety input tokens fell from `29,387` to
`19,839` (about 32.5%), while estimated Safety Agent cost fell from `$0.036707`
to `$0.026961` (about 26.5%). Safety requests remained 6/6 with zero Safety
Agent retries. One independent Nutrition Agent retry occurred in this sample,
so total pipeline cost is not used to claim the isolated Safety savings.

This flow is labeled `nutrition-agent-authoritative-v3`. It does not skip or
paywall safety review; it removes only technical data that cannot improve a
semantic safety decision.

## Paid-route comparison

On July 31, 2026, the same complete-pipeline benchmark was run for Plus and Pro.
The Pro context was also tested with Terra behind the internal `SOL` route. An
internal route is a product/cost tier; it does not require a different provider
model.

| Tier/context        | Provider model  |             Plans | Clean READY | Quality |      Cost per plan | Average latency | p95 latency |
| ------------------- | --------------- | ----------------: | ----------: | ------: | -----------------: | --------------: | ----------: |
| Plus / Personalized | `gpt-5.6-terra` |                 6 |         6/6 |    98.3 |            $0.1173 |          14.7 s |      36.5 s |
| Pro / Adaptive      | `gpt-5.6-sol`   | 4 across two runs |         0/4 |    95.0 | not representative |          93.0 s |     136.7 s |
| Pro / Adaptive      | `gpt-5.6-terra` |                 6 |         6/6 |   100.0 |            $0.1220 |          15.4 s |      36.9 s |

The Sol samples remained user-visible as READY because backend fallbacks
protected the result, but every plan carried degraded provenance. Across the two
runs, provider timeouts caused seven failed internal requests, one nutrition
fallback per run, and fallback reasons such as `unknown_openai_error`. The low
recorded Sol cost is therefore not a valid estimate for a fully AI-generated Pro
plan.

For launch, keep Terra as the primary complete daily-plan model for both Plus
and Pro contexts. Pro remains more adaptive because its context, entitlements,
history, health signals, and usage allowances differ. Reserve Sol for a later,
bounded escalation path after its timeout/reliability behavior passes a larger
benchmark. Do not call Sol for every Pro daily plan based on model positioning
alone.

### Measured daily-generation floor

Using one complete plan per active user per day, before manual refreshes, meal
or menu regeneration, and checkpoints:

| Tier/model          | Measured cost per plan | 30-day cost per fully active user |
| ------------------- | ---------------------: | --------------------------------: |
| Free / Luna         |                $0.0519 |                             $1.56 |
| Plus / Terra        |                $0.1173 |                             $3.52 |
| Pro context / Terra |                $0.1220 |                             $3.66 |

These are small benchmark samples, not launch approval. Paid-tier full monthly
workload and multilingual/safety fixtures still need the representative sample
described in the unit-economics gate.
