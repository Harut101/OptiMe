# Exercise seed data

The initial catalog contains 46 reviewable exercises across strength, mobility, cardio, and recovery. Definitions live in `apps/api/prisma/seeds/exercises` and are split by domain rather than stored in one generated blob.

Every seed exercise has a URL-safe stable slug, deterministic sort order, equipment, specific target muscles, training levels, movement pattern, conservative planning tags, and localized content for all four supported locales. The initial catalog intentionally has zero media; no fake or unlicensed URL is created to fill that gap.

The seed upserts exercises by slug and translations by exercise/locale. Reruns update seed-controlled fields, do not duplicate records, do not delete custom exercises, and do not touch users or plans.

```powershell
$env:DATABASE_URL='postgresql://optime:optime@localhost:5432/optime?schema=public'
pnpm --filter @optime/api exercise:seed
pnpm --filter @optime/api exercise:validate:db
```

Use the isolated `optime_test` URL to seed and validate test data. `exercise:validate` checks catalog definitions without a database; `exercise:validate:db` additionally validates seeded persistence and requires `DATABASE_URL`.

Do not use `prisma migrate reset` or `docker compose down -v` for this workflow.

