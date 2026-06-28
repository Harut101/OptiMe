# Codex Desktop Local Commands

This project pins `pnpm@9.15.4` in the root `package.json`. If Codex Desktop resolves a bundled pnpm version instead, dependency-state checks can create a project-local `.pnpm-store/` and may hang before running the actual build script.

## Quick Diagnostics

Run this from the repo root:

```powershell
.\scripts\diagnose-pnpm-env.ps1
```

Check that:

- `packageManager` is `pnpm@9.15.4`.
- `pnpm store path` is not inside the repository.
- `.pnpm-store/` does not exist in the repository.

## Safe Codex Setup

Use a user-level pnpm store so Codex does not write `.pnpm-store/` into the project:

```powershell
$env:CI='true'
$env:PNPM_HOME="$env:LOCALAPPDATA\pnpm"
pnpm config set store-dir "$env:LOCALAPPDATA\pnpm-store" --location user
pnpm store path
```

If `where.exe pnpm` shows Codex's bundled pnpm before your normal pnpm, prefer the pinned local pnpm command when running checks from Codex:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --version
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api build
```

Then run short checks:

```powershell
pnpm --filter @optime/api build
pnpm --filter @optime/mobile typecheck
```

Run E2E only when the short checks are clean:

```powershell
$env:TEST_DATABASE_URL='postgresql://optime:optime@localhost:5432/optime_test?schema=public'
pnpm --filter @optime/api test:e2e
```

## Manual Recovery

If Codex created a local `.pnpm-store/`, first stop any running API, test, Expo, or Node processes that may be using project files. Then remove only the generated store folder:

```powershell
Remove-Item -Recurse -Force .pnpm-store
```

If dependency metadata needs to be refreshed, run install from your normal local PowerShell:

```powershell
pnpm install --reporter=append-only --no-frozen-lockfile --config.offline=false --registry=https://registry.npmjs.org/
```

If `node_modules` was recreated and the API build reports missing Prisma Client exports, regenerate the client before building:

```powershell
pnpm --filter @optime/api prisma:generate
pnpm --filter @optime/api build
```

Do not use `git reset --hard`, `git clean -fd`, `prisma migrate reset`, or `docker compose down -v` for this recovery.

## Why This Matters

Build scripts such as `pnpm --filter @optime/api build` ultimately run simple package scripts like `nest build`. If the command hangs or fails before output from `nest build`, the issue is usually pnpm environment or dependency-state handling rather than application code.

In Codex Desktop, the bundled pnpm may be a newer major version than the project pin. For this repo, `packageManager` is `pnpm@9.15.4`; using pnpm 11 can trigger dependency-state checks, build-script approval prompts, or `node_modules` relinking before the actual project command starts.
