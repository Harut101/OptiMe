# Production deployment runbook

This runbook covers the first-release single API instance and PostgreSQL. It is
provider-neutral and does not replace the hosting provider's firewall, disk,
snapshot, monitoring, or secret-management controls.

## Architecture assumptions

- One API process runs behind an HTTPS reverse proxy.
- PostgreSQL uses persistent storage and is not exposed publicly.
- Exercise media is served from the approved CDN package.
- Deployment secrets are injected by the host and never copied into the repo.
- Database migrations are forward-only and use expand/contract changes.

## Required PostgreSQL tools

The deployment operator needs client binaries compatible with the production
PostgreSQL major version:

- `pg_dump` for custom-format backups;
- `pg_restore` for artifact verification and recovery rehearsals;
- `psql` for controlled restore/database administration.

Override `PG_DUMP_BIN` or `PG_RESTORE_BIN` when these tools are not on `PATH`.
The backup command passes the password only through the child process
`PGPASSWORD`; it does not place `DATABASE_URL` or credentials in process
arguments or output.

## Pre-deployment checklist

1. Identify the exact Git commit and retain the previous deployable artifact.
2. Confirm production secrets and non-secret environment values are present.
3. Run the AI production preflight:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api ai-release:preflight
```

4. Inspect migration state without changing the database:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api prisma:migrate:status
```

5. Create and verify a backup on persistent storage outside the checkout:

```powershell
$env:DATABASE_BACKUP_DIRECTORY='D:\optime-backups'
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api db:backup
```

The command writes `*.tmp`, runs `pg_restore --list`, checks that the artifact is
non-empty, and only then atomically renames it to `*.dump`. Failed temporary
artifacts are removed. No retention deletion is automated; configure encrypted
off-host retention through the hosting provider.

6. Record the verified backup path, byte size, database, timestamp, and Git
   commit in the private deployment log. Do not put credentials in that log.

## Deploy sequence

1. Build and validate the exact release artifact before changing production.
2. Remove the API instance from traffic or enable a short maintenance window.
3. Apply committed migrations only:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api prisma:migrate:deploy
```

Never use `prisma migrate dev`, `prisma migrate reset`, `db push`, or manual
schema edits against production.

4. Start the new API process and wait for:

```txt
GET /v1/system/health/live  -> 200
GET /v1/system/health/ready -> 200
```

5. Return the instance to traffic only after readiness passes.
6. Smoke-test registration/login as appropriate, Today plan retrieval, one
   authenticated read endpoint, exercise media, and billing-disabled behavior.
7. Run `ai-release:monitor`; `INSUFFICIENT_DATA` remains valid during an early
   rollout, while `FAIL` requires investigation.
8. Monitor request IDs, `5xx`, readiness, latency, PostgreSQL connections, disk,
   and backup storage during the observation window.

## Migration rules

Every production migration must be safe for the previous and next application
version during deployment:

- add nullable columns or columns with safe defaults first;
- add new tables/indexes without removing old application dependencies;
- deploy code that can read the transitional schema;
- backfill in a bounded separate operation when required;
- remove old columns or constraints only in a later release after usage stops;
- review locks and table size before adding indexes or constraints.

Do not combine a destructive schema change with the code release that first
stops using the old schema. Prisma has no automatic down migration guarantee.

## Code rollback

If health checks or smoke tests fail and the migration is backward compatible:

1. remove the failed instance from traffic;
2. redeploy the previously retained application artifact;
3. do not attempt to reverse the migration automatically;
4. verify liveness/readiness and repeat the smoke checks;
5. preserve request IDs and operational logs for investigation.

Forward-compatible additive migrations may remain in place until a corrected
release. This is safer than improvising a destructive down migration.

## Database recovery

Database restore is an incident operation, not a routine code rollback. Never
restore over the active production database and never run reset commands.

1. Enable maintenance mode and stop all writes.
2. Verify the selected artifact independently:

```powershell
$env:DATABASE_BACKUP_PATH='D:\optime-backups\optime-optime_prod-YYYYMMDDTHHMMSSZ.dump'
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api db:backup:verify
```

3. Create a new empty recovery database with restricted access.
4. Restore into that new database using `pg_restore`, without `--clean` against
   the original database.
5. Run migration status, integrity checks, row-count sanity checks, and a private
   API smoke test against the recovered database.
6. Switch `DATABASE_URL` only after review, restart the API, and verify readiness.
7. Keep the original database isolated until the incident review is complete.

Production restore syntax and credentials depend on the selected PostgreSQL
provider. Rehearse this procedure on staging before launch and at regular
intervals; an untested backup is not a recovery plan.

## External controls still required

- encrypted scheduled off-host backups and retention policy;
- a documented recovery point objective and recovery time objective;
- disk/database alerts and external health monitoring;
- reverse-proxy TLS, firewall, and secret manager configuration;
- at least one staging restore rehearsal before release;
- named operator responsibility for deployment and incident rollback.
