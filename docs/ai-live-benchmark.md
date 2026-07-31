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
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api ai-release:live
```

The OpenAI API key, `OPENAI_DEFAULT_MODEL`, all three routed model IDs
(`OPENAI_MODEL_LUNA`, `OPENAI_MODEL_TERRA`, `OPENAI_MODEL_SOL`), and their
per-million-token prices must already be configured. Never commit the API key.
Start with two profiles per tier; increase the sample only after reviewing
READY/FALLBACK outcomes and telemetry.

## Output

The JSON report includes completed plan generations, READY/FALLBACK counts,
fallback reasons, request/retry counts, input/output tokens, model routes,
estimated provider cost, and the conservative budget snapshot. It never emits
prompts, plans, profiles, API keys, or raw model responses.
