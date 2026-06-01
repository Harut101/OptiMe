# Sprint 1 Backend Verification

## Commands

```powershell
pnpm install
docker compose up -d postgres
$env:DATABASE_URL='postgresql://optime:optime@localhost:5432/optime?schema=public'
pnpm --filter @optime/api prisma:generate
pnpm --filter @optime/api prisma:migrate -- --name sprint_1_initial
pnpm --filter @optime/api build
pnpm --filter @optime/api test:e2e
```

If Docker is not installed, start any local PostgreSQL server and create this database/user or change `DATABASE_URL`:

```text
postgresql://optime:optime@localhost:5432/optime?schema=public
```

## Expected Output

- `prisma:generate`: `Generated Prisma Client`
- `prisma:migrate`: migration applied and database in sync
- `build`: `nest build` exits with code 0
- `test:e2e`: 5 passing e2e tests

## Common Fixes

- `Environment variable not found: DATABASE_URL`
  - Set `$env:DATABASE_URL` in the same terminal before Prisma commands.
- `Can't reach database server at localhost:5432`
  - Start Postgres, verify credentials, and check that port `5432` is reachable.
- `docker is not recognized`
  - Install Docker Desktop or run a local Postgres service manually.
- Jest `spawn EPERM`
  - The e2e script already uses `--runInBand` to avoid worker process spawning.
- Prisma engine download fails
  - Re-run the Prisma command with normal internet access.
