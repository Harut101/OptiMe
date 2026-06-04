# Local Development

This project uses two local PostgreSQL databases:

- Dev app database: `optime`
- E2E test database: `optime_test`

Keep them separate so test cleanup never deletes your local app users, onboarding, training schedule, or daily plans.

## Environment URLs

Dev:

```env
DATABASE_URL=postgresql://optime:optime@localhost:5432/optime?schema=public
```

E2E tests:

```env
TEST_DATABASE_URL=postgresql://optime:optime@localhost:5432/optime_test?schema=public
```

The e2e bootstrap copies `TEST_DATABASE_URL` into `DATABASE_URL` for the test process. If `TEST_DATABASE_URL` is missing or does not point to `optime_test`, tests fail before cleanup runs.

## Start Postgres

```powershell
docker compose up -d postgres
```

Postgres uses the named Docker volume `optime_postgres_data`, mounted at `/var/lib/postgresql/data`, so dev data survives backend restarts and normal container restarts.

## Stop Postgres Without Deleting Data

```powershell
docker compose stop postgres
```

or:

```powershell
docker compose down
```

Do not run this unless you intentionally want to delete local Postgres data:

```powershell
docker compose down -v
```

`down -v` removes named Docker volumes, including your local dev database.

## Create The Test Database

The Docker image creates the `optime` database automatically from `POSTGRES_DB`. Create `optime_test` once:

```powershell
docker compose exec postgres createdb -U optime optime_test
```

If it already exists, this command may report that the database exists; that is fine.

## Run Migrations

Dev database:

```powershell
pnpm --filter @optime/api prisma:migrate
```

Test database:

```powershell
$env:TEST_DATABASE_URL='postgresql://optime:optime@localhost:5432/optime_test?schema=public'
pnpm --filter @optime/api prisma:migrate:test
```

## Run E2E Tests Safely

```powershell
$env:TEST_DATABASE_URL='postgresql://optime:optime@localhost:5432/optime_test?schema=public'
pnpm --filter @optime/api test:e2e
```

The test cleanup helper refuses to run unless:

- `TEST_DATABASE_URL` exists.
- `TEST_DATABASE_URL` points to `optime_test`.
- the active `DATABASE_URL` equals `TEST_DATABASE_URL` inside the test process.

This prevents tests from cleaning the dev `optime` database by accident.

## Intentionally Reset Dev Data

Preferred reset:

```powershell
pnpm --filter @optime/api prisma:migrate -- --reset
```

Full Docker volume reset:

```powershell
docker compose down -v
docker compose up -d postgres
pnpm --filter @optime/api prisma:migrate
docker compose exec postgres createdb -U optime optime_test
$env:TEST_DATABASE_URL='postgresql://optime:optime@localhost:5432/optime_test?schema=public'
pnpm --filter @optime/api prisma:migrate:test
```

Use the full volume reset only when you intentionally want to delete local dev data.

## Mobile Session Note

If you intentionally reset the dev database, Expo Go or SecureStore may still hold an old JWT for a user that no longer exists. Log out or clear app storage if the app appears authenticated but backend requests return `401`.

Follow-up: if not already handled everywhere, mobile should clear session and route to login when the backend returns `401` for a stale JWT.

## Existing Old Docker Volume Note

The compose file now uses `optime_postgres_data`. If you previously used an older volume name, Docker may start with a fresh database after this change. If you need data from the old volume, export it before deleting any volumes.
